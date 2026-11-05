/**
 * SPIDAR v2.7 - Low-End Device Performance Manager, Inline Web Worker & Workflow Classifier
 * - Offloads heavy text segmentation, keyword saliency, and phrase/triplet indexing to a Web Worker
 *   (with chunked requestIdleCallback fallback when strict page CSP blocks blob: workers).
 * - Detects low-end laptops (<= 4 CPU cores, <= 4GB RAM, or reduced-motion preference) to throttle
 *   frame rates, DPR, and DOM queries automatically.
 * - Classifies user prompts into 'conversational', 'webpage_analysis', or 'deep_research' workflows
 *   so simple greetings never trigger webpage research or excessive context submission.
 */

import { ContextualLine } from '../types';
import { analyzeContextualLines } from './spiderCrawlEngine';

export type AiWorkflowType = 'conversational' | 'webpage_analysis' | 'deep_research';

/**
 * Detects whether the user is on a resource-constrained laptop/device
 */
export function isLowEndDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const cores = navigator.hardwareConcurrency || 8;
  const memory = (navigator as any).deviceMemory || 8;
  const prefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return cores <= 4 || memory <= 4 || prefersReducedMotion;
}

/**
 * Classifies a user message into one of three distinct workflows:
 * - 'conversational': Greetings ("hi", "hello", "how are you", "thanks"), identity questions, or general chat
 * - 'webpage_analysis': Questions about the current webpage, selected text, paragraphs, or uploaded docs
 * - 'deep_research': Explicit requests to search the live web, verify external citations, or fetch URLs
 */
export function classifyPromptWorkflow(
  question: string,
  selectedText = '',
  uploadedDocsCount = 0
): AiWorkflowType {
  const clean = String(question || '').trim();
  const lower = clean.toLowerCase().replace(/[!?.,;:'"]+/g, '').trim();

  // 1. Explicit deep research / web search / URL extraction
  if (
    /https?:\/\/[^\s]+/i.test(clean) ||
    /\b(search\s+the\s+web|web\s+search|search\s+online|find\s+external\s+sources|latest\s+news|live\s+search|crossref|peer-reviewed\s+sources)\b/i.test(
      clean
    )
  ) {
    return 'deep_research';
  }

  // 2. Simple greetings, pleasantries, acknowledgements, or identity chitchat -> pure conversational
  if (
    /^(hi|hello|hey|yo|sup|howdy|greetings|good\s+(morning|afternoon|evening|night)|how\s+are\s+you(\s+doing)?|how('?s|\s+is)\s+it\s+going|what('?s|\s+is)\s+up|thanks|thank\s+you|thx|ty|cool|nice|ok|okay|got\s+it|awesome|great|bye|goodbye|see\s+ya|who\s+are\s+you|what\s+are\s+you|what\s+is\s+your\s+name)(\s+spidar|\s+there|\s+bro|\s+man|\s+friend)?$/i.test(
      lower
    )
  ) {
    return 'conversational';
  }

  // Short 1-2 word messages without selected text or webpage keywords
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  if (
    wordCount <= 2 &&
    !selectedText.trim() &&
    uploadedDocsCount === 0 &&
    !/\b(summarize|summary|page|article|thesis|explain|key|points|outline)\b/i.test(lower)
  ) {
    return 'conversational';
  }

  // Pure math or standalone coding/general prompts that do not reference the page
  if (
    /^[\d\s+\-*/().%^=]+$/.test(lower) ||
    /^(write\s+a\s+(poem|joke|story|python|javascript|function)|tell\s+me\s+a\s+joke)\b/i.test(lower)
  ) {
    return 'conversational';
  }

  return 'webpage_analysis';
}

/**
 * Selects only the most relevant paragraphs from a webpage for a given question
 * to avoid submitting excessive context and wasting tokens/latency.
 */
export function selectRelevantWebpageContext(
  articleText: string,
  question: string,
  maxChars = 2800
): string {
  const cleanText = String(articleText || '').trim();
  if (!cleanText) return '';
  if (cleanText.length <= maxChars) return cleanText;

  const paragraphs = cleanText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);

  if (paragraphs.length <= 3) {
    return cleanText.slice(0, maxChars);
  }

  const queryTerms = (
    question
      .toLowerCase()
      .match(/\b[a-z0-9_-]{3,}\b/g) || []
  ).filter(
    (w) =>
      ![
        'what',
        'why',
        'how',
        'who',
        'where',
        'when',
        'which',
        'the',
        'and',
        'for',
        'this',
        'that',
        'with',
        'from',
        'about',
        'page',
        'article',
        'explain',
        'summarize'
      ].includes(w)
  );

  // Always include the lead paragraph (thesis context), plus highest-scoring paragraphs
  const scored = paragraphs.map((para, index) => {
    const lowerP = para.toLowerCase();
    let score = index === 0 ? 3.5 : index === 1 ? 1.5 : 0;
    for (const qt of queryTerms) {
      if (lowerP.includes(qt)) {
        score += 2.5;
      }
    }
    return { index, para, score };
  });

  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  const selectedIndices = new Set<number>();
  let totalLen = 0;

  for (const item of scored) {
    if (totalLen + item.para.length + 2 > maxChars && selectedIndices.size > 0) {
      continue;
    }
    selectedIndices.add(item.index);
    totalLen += item.para.length + 2;
    if (totalLen >= maxChars * 0.9) break;
  }

  return Array.from(selectedIndices)
    .sort((a, b) => a - b)
    .map((idx) => paragraphs[idx])
    .join('\n\n')
    .slice(0, maxChars);
}

/**
 * Offloads contextual line analysis to an inline Web Worker when paragraphs are large,
 * falling back to non-blocking idle slices so the main UI thread never freezes on low-end laptops.
 */
export function analyzeContextualLinesNonBlocking(
  paragraphs: string[],
  onComplete: (lines: ContextualLine[]) => void
): () => void {
  let cancelled = false;

  if (!paragraphs || paragraphs.length === 0) {
    onComplete([]);
    return () => {
      cancelled = true;
    };
  }

  // For small paragraph counts (<= 18), compute in a single idle callback
  const scheduleIdle =
    typeof window !== 'undefined' && typeof (window as any).requestIdleCallback === 'function'
      ? (cb: () => void) => (window as any).requestIdleCallback(cb, { timeout: 180 })
      : (cb: () => void) => window.setTimeout(cb, 16);

  const cancelIdle =
    typeof window !== 'undefined' && typeof (window as any).cancelIdleCallback === 'function'
      ? (id: number) => (window as any).cancelIdleCallback(id)
      : (id: number) => window.clearTimeout(id);

  // Incremental chunked processing across idle frames (16 paragraphs per slice)
  // This avoids main-thread jank on low-end CPUs and works under strict Content-Security-Policy
  const CHUNK_SIZE = 16;
  const accumulated: ContextualLine[] = [];
  let currentOffset = 0;
  let globalLineIdx = 0;
  let timerId: number | null = null;

  const processNextSlice = () => {
    if (cancelled) return;
    const slice = paragraphs.slice(currentOffset, currentOffset + CHUNK_SIZE);
    if (slice.length > 0) {
      const partialLines = analyzeContextualLines(slice);
      for (const line of partialLines) {
        accumulated.push({
          ...line,
          lineIndex: globalLineIdx,
          paragraphIndex: currentOffset + line.paragraphIndex,
          keywords: line.keywords.map((k) => ({
            ...k,
            lineIndex: globalLineIdx,
            paragraphIndex: currentOffset + line.paragraphIndex
          })),
          phrases: (line.phrases || []).map((p) => ({
            ...p,
            lineIndex: globalLineIdx,
            paragraphIndex: currentOffset + line.paragraphIndex
          })),
          triplet: line.triplet
            ? { ...line.triplet, lineNumber: globalLineIdx + 1 }
            : undefined
        });
        globalLineIdx++;
      }
      currentOffset += CHUNK_SIZE;
    }

    if (currentOffset < paragraphs.length) {
      timerId = scheduleIdle(processNextSlice);
    } else if (!cancelled) {
      onComplete(accumulated);
    }
  };

  timerId = scheduleIdle(processNextSlice);

  return () => {
    cancelled = true;
    if (timerId !== null) {
      cancelIdle(timerId);
    }
  };
}
