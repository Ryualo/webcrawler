import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

declare const chrome: any;

import {
  SalientKeyword,
  WebSummaryResult,
  ChatMessage,
  NeuralKnowledgeBase,
  ApiConfig,
  ContextualLine,
  LegTargetVector,
  ChunkExplanationResult,
  MemoryNeuron
} from './types';
import {
  analyzeContextualLines,
  computeSpiderLegJoints
} from './utils/spiderCrawlEngine';
import {
  loadNeuralKnowledgeBase,
  saveNeuralKnowledgeBase,
  feedContextToBrain,
  ingestLineContextToBrain,
  ingestChunkAsNeuron,
  ingestFullDocumentManualRead,
  createDefaultKnowledgeBase,
  trainSpidarFromChatTurn
} from './utils/neuralMemory';
import {
  generateAiSummary,
  askAiQuestion,
  explainChunkWithAi
} from './utils/apiProxy';
import { getProviderDefinition } from './utils/aiProviders';
import {
  persistConfigEverywhere,
  subscribeToCrossContextSync
} from './utils/chromeBridge';
import {
  SpidarCompanionOverlay,
  NearbyHighlightOverlay
} from './components/SpidarCompanionOverlay';
import {
  isLowEndDevice,
  analyzeContextualLinesNonBlocking
} from './utils/performanceWorker';

interface PageChunkElement {
  index: number;
  text: string;
  element: HTMLElement;
}

const elementTextNodeCache = new WeakMap<HTMLElement, Text[]>();

function getCachedTextNodes(rootEl: HTMLElement): Text[] {
  let cached = elementTextNodeCache.get(rootEl);
  if (cached) return cached;
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    if (node.nodeValue && node.nodeValue.trim().length > 0) {
      nodes.push(node);
    }
    node = walker.nextNode() as Text | null;
  }
  elementTextNodeCache.set(rootEl, nodes);
  return nodes;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractReadableChunksFromDOM(): PageChunkElement[] {
  const candidates = Array.from(
    document.querySelectorAll(
      'article p, main p, [role="main"] p, .prose p, .markdown-body p, section p, p, article li, main li, blockquote, dd, td, h1, h2, h3'
    )
  ) as HTMLElement[];

  const seenElements = new Set<HTMLElement>();
  const seenTexts = new Set<string>();
  const results: PageChunkElement[] = [];

  for (const el of candidates) {
    if (seenElements.has(el)) continue;
    if (el.closest('#spidar-v2-root, nav, footer, header, aside, [role="navigation"]')) continue;
    // Skip container elements that wrap another matched paragraph/heading candidate
    if (
      (el.tagName === 'LI' || el.tagName === 'BLOCKQUOTE' || el.tagName === 'TD' || el.tagName === 'DD') &&
      el.querySelector('p, h1, h2, h3')
    ) {
      continue;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width < 110 || rect.height < 12) continue;
    const style = window.getComputedStyle(el);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity || '1') < 0.1
    ) {
      continue;
    }
    const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length < 28) continue;

    const normalizedKey = text.toLowerCase().slice(0, 180);
    if (seenTexts.has(normalizedKey)) continue;

    seenElements.add(el);
    seenTexts.add(normalizedKey);
    const index = results.length;
    el.setAttribute('data-spidar-chunk-idx', String(index));
    results.push({ index, text, element: el });
    if (results.length >= 250) break;
  }

  if (results.length === 0 && document.body) {
    const rawText = (document.body.innerText || '').trim();
    const paragraphs = rawText
      .split(/\n{2,}/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter((p) => p.length >= 40)
      .slice(0, 40);
    paragraphs.forEach((text, index) => {
      results.push({ index, text, element: document.body });
    });
  }

  return results;
}

function findTextRangeRectInElement(
  rootEl: HTMLElement,
  targetTerm: string
): DOMRect | null {
  const cleanTarget = targetTerm.trim();
  if (!cleanTarget || cleanTarget.length < 2) return null;

  const textNodes = getCachedTextNodes(rootEl);
  const boundaryRegex = new RegExp(`\\b${escapeRegExp(cleanTarget)}\\b`, 'i');

  for (const textNode of textNodes) {
    const val = textNode.nodeValue || '';
    const match = boundaryRegex.exec(val);
    const idx = match ? match.index : val.toLowerCase().indexOf(cleanTarget.toLowerCase());
    if (idx !== -1) {
      try {
        const range = document.createRange();
        range.setStart(textNode, idx);
        range.setEnd(textNode, Math.min(val.length, idx + cleanTarget.length));
        const clientRects = range.getClientRects();
        const rect = clientRects.length > 0 ? clientRects[0] : range.getBoundingClientRect();
        if (rect && rect.width > 8 && rect.height > 6) {
          return rect;
        }
      } catch {
        // Ignore malformed text range
      }
    }
  }
  return null;
}

const SpidarContentScriptApp: React.FC = () => {
  const [pageChunks, setPageChunks] = useState<PageChunkElement[]>([]);
  const [pageTitle, setPageTitle] = useState<string>(
    () => document.title || window.location.hostname || 'Active Webpage'
  );
  const [minimalistMode, setMinimalistMode] = useState<boolean>(false);

  const [knowledgeBase, setKnowledgeBase] = useState<NeuralKnowledgeBase>(() =>
    loadNeuralKnowledgeBase()
  );
  const [apiConfig, setApiConfig] = useState<ApiConfig>(() => {
    try {
      const saved = localStorage.getItem('spidar_api_config_v2_5');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          spiderSpeed: typeof parsed.spiderSpeed === 'number' ? parsed.spiderSpeed : 1.0,
          reasoningEffort: parsed.reasoningEffort || 'medium',
          customHeaders: Array.isArray(parsed.customHeaders) ? parsed.customHeaders : [],
          streamingEnabled: parsed.streamingEnabled ?? true
        };
      }
    } catch {
      // ignore
    }
    return {
      provider: 'qwen-free',
      baseUrl: 'https://text.pollinations.ai/openai',
      apiKey: '',
      selectedModel: 'qwen2.5-72b-instruct-free',
      availableModels: [
        'qwen2.5-72b-instruct-free',
        'qwen2.5-coder-32b-free',
        'qwq-32b-reasoning-free',
        'gemini-3.8-flash',
        'gpt-4o-mini'
      ],
      temperature: 0.35,
      maxTokens: 2048,
      spiderSpeed: 1.0,
      reasoningEffort: 'medium',
      customHeaders: [],
      streamingEnabled: true
    };
  });

  const spiderSpeed = Math.max(0.4, Math.min(3.0, apiConfig.spiderSpeed ?? 1.0));
  const activeProviderDef = useMemo(
    () => getProviderDefinition(apiConfig.provider || 'qwen-free'),
    [apiConfig.provider]
  );

  const getSpiderCornerPos = useCallback(() => {
    if (typeof window === 'undefined') return { x: 96, y: 790 };
    return {
      x: 96,
      y: Math.max(240, window.innerHeight - 96)
    };
  }, []);

  const [spiderPos, setSpiderPos] = useState<{ x: number; y: number }>(() => ({
    x: 96,
    y: typeof window !== 'undefined' ? Math.max(240, window.innerHeight - 96) : 790
  }));
  const [spiderTilt, setSpiderTilt] = useState<number>(0);
  const [legPhase, setLegPhase] = useState<number>(0);
  const [sleeping] = useState<boolean>(false);
  const [isDraggingSpider, setIsDraggingSpider] = useState<boolean>(false);
  const [isReturningToCorner, setIsReturningToCorner] = useState<boolean>(false);
  const [hoveredChunkIndex, setHoveredChunkIndex] = useState<number | null>(null);

  const [isCrawling, setIsCrawling] = useState<boolean>(false);
  const [crawlPaused, setCrawlPaused] = useState<boolean>(false);
  const [crawlProgress, setCrawlProgress] = useState<number>(0);
  const [activeKeyword, setActiveKeyword] = useState<SalientKeyword | null>(null);
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
  const [isTouchingKeyword, setIsTouchingKeyword] = useState<boolean>(false);
  const [legTouchProgress, setLegTouchProgress] = useState<number>(0);
  const [legReachVectors, setLegReachVectors] = useState<{
    leftFrontDx: number;
    leftFrontDy: number;
    rightFrontDx: number;
    rightFrontDy: number;
    multiLegTargets?: LegTargetVector[];
  }>({ leftFrontDx: -52, leftFrontDy: 32, rightFrontDx: 52, rightFrontDy: 32 });
  const [nearbyHighlights, setNearbyHighlights] = useState<NearbyHighlightOverlay[]>([]);
  const [touchedKeywordList, setTouchedKeywordList] = useState<string[]>([]);

  const [selectedChunkExplanation, setSelectedChunkExplanation] =
    useState<ChunkExplanationResult | null>(null);
  const [isExplainingChunk, setIsExplainingChunk] = useState<boolean>(false);

  const [radialMenuOpen, setRadialMenuOpen] = useState<boolean>(false);
  const [intelligenceCardOpen, setIntelligenceCardOpen] = useState<boolean>(false);
  const [intelligenceInitialTab, setIntelligenceInitialTab] = useState<
    'summary' | 'qa' | 'keywords' | 'vault'
  >('summary');
  const [vaultModalOpen, setVaultModalOpen] = useState<boolean>(false);

  const [currentSummary, setCurrentSummary] = useState<WebSummaryResult | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState<boolean>(false);

  const spiderPosRef = useRef<{ x: number; y: number }>({
    x: 96,
    y: typeof window !== 'undefined' ? Math.max(240, window.innerHeight - 96) : 790
  });
  const crawlElapsedRef = useRef<number>(0);
  const crawlDurationRef = useRef<number>(7200);
  const lastIngestedLineRef = useRef<number>(-1);
  const draggingRef = useRef<boolean>(false);
  const dragMovedRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const refreshPageChunks = useCallback(() => {
    const extracted = extractReadableChunksFromDOM();
    setPageChunks(extracted);
    setPageTitle(document.title || window.location.hostname || 'Active Webpage');
    return extracted;
  }, []);

  useEffect(() => {
    const chunks = refreshPageChunks();
    const unsubscribe = subscribeToCrossContextSync({
      onApiConfigSync: (nextCfg) => {
        setApiConfig((prev) => ({
          ...prev,
          ...nextCfg,
          spiderSpeed: typeof nextCfg.spiderSpeed === 'number' ? nextCfg.spiderSpeed : prev.spiderSpeed
        }));
      },
      onKnowledgeBaseSync: (nextKb) => {
        setKnowledgeBase(nextKb);
      }
    });

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({
        spidar_active_tab_context_v2_7: {
          id: `live-tab-${Date.now()}`,
          title: document.title || window.location.hostname || 'Active Webpage',
          url: window.location.href,
          category: 'Live Browser Tab',
          readTime: `${Math.max(1, Math.round(chunks.length * 0.4))} min read`,
          paragraphs: chunks.map((c) => c.text),
          capturedAt: Date.now()
        }
      });
    }

    // Observe dynamic DOM mutations (infinite scroll / SPA content loading) with debounce
    let mutationTimer: number | null = null;
    const observer = new MutationObserver(() => {
      if (mutationTimer !== null) window.clearTimeout(mutationTimer);
      mutationTimer = window.setTimeout(() => {
        const updated = refreshPageChunks();
        if (updated.length > chunks.length) {
          crawlDurationRef.current = Math.max(
            crawlDurationRef.current,
            Math.max(5500, updated.length * 1100)
          );
        }
      }, 650);
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      unsubscribe();
      observer.disconnect();
      if (mutationTimer !== null) window.clearTimeout(mutationTimer);
    };
  }, [refreshPageChunks]);

  const activeParagraphs = useMemo(() => {
    return pageChunks.map((c) => c.text);
  }, [pageChunks]);

  const getFullActiveTabText = useCallback(() => {
    return activeParagraphs.join('\n\n');
  }, [activeParagraphs]);

  const [contextualLines, setContextualLines] = useState<ContextualLine[]>(() =>
    analyzeContextualLines(activeParagraphs.slice(0, 12))
  );

  useEffect(() => {
    if (activeParagraphs.length <= 14) {
      setContextualLines(analyzeContextualLines(activeParagraphs));
      return;
    }
    // Seed initial visible paragraphs immediately, then index the full page across idle frames
    setContextualLines(analyzeContextualLines(activeParagraphs.slice(0, 12)));
    const cancel = analyzeContextualLinesNonBlocking(activeParagraphs, (fullLines) => {
      setContextualLines(fullLines);
    });
    return cancel;
  }, [activeParagraphs]);

  const wordTargetsMeta = useMemo(() => {
    const list: {
      targetIdx: number;
      word: string;
      lineIndex: number;
      paragraphIndex: number;
      lineContext: ContextualLine;
      keywordObj: SalientKeyword;
    }[] = [];
    const seenWordsInParagraph = new Map<number, Set<string>>();

    contextualLines.forEach((line) => {
      const paraSet = seenWordsInParagraph.get(line.paragraphIndex) || new Set<string>();
      seenWordsInParagraph.set(line.paragraphIndex, paraSet);

      const lineKws = line.keywords.filter((kw) => !paraSet.has(kw.word.toLowerCase()));
      if (lineKws.length > 0) {
        lineKws.slice(0, 2).forEach((kw) => {
          const w = kw.word.toLowerCase();
          paraSet.add(w);
          list.push({
            targetIdx: list.length,
            word: w,
            lineIndex: line.lineIndex,
            paragraphIndex: line.paragraphIndex,
            lineContext: line,
            keywordObj: kw
          });
        });
      } else {
        const fallbackWords = (line.text.match(/\b[a-zA-Z]{5,}\b/g) || []).filter(
          (w) => !paraSet.has(w.toLowerCase())
        );
        const chosen = (fallbackWords[0] || line.text.split(/\s+/)[0] || 'context').replace(
          /[^a-zA-Z0-9_-]/g,
          ''
        );
        if (chosen) {
          const w = chosen.toLowerCase();
          paraSet.add(w);
          list.push({
            targetIdx: list.length,
            word: w,
            lineIndex: line.lineIndex,
            paragraphIndex: line.paragraphIndex,
            lineContext: line,
            keywordObj: {
              word: chosen,
              score: 0.72,
              category: 'concept',
              contextSentence: line.text.slice(0, 120)
            }
          });
        }
      }
    });

    return list;
  }, [contextualLines]);

  const handleSpiderSpeedChange = useCallback((newSpeed: number) => {
    const clamped = Math.round(Math.max(0.4, Math.min(3.0, newSpeed)) * 10) / 10;
    setApiConfig((prev) => {
      const next = { ...prev, spiderSpeed: clamped };
      persistConfigEverywhere(next);
      return next;
    });
  }, []);

  const scanNearbyDomPhrases = useCallback(
    (centerX: number, centerY: number) => {
      const viewportH = window.innerHeight;
      const nearby: {
        rect: DOMRect;
        scoreDist: number;
        dx: number;
        dy: number;
        text: string;
        style: 'cyan_box' | 'pink_highlight';
      }[] = [];

      for (const line of contextualLines) {
        const chunk = pageChunks[line.paragraphIndex];
        if (!chunk) continue;
        const elRect = chunk.element.getBoundingClientRect();
        if (elRect.bottom < -40 || elRect.top > viewportH + 40) continue;

        const candidates: { text: string; style: 'cyan_box' | 'pink_highlight' }[] = [
          ...(line.phrases || []).map((p) => ({ phrase: p.phrase, style: p.style })).map((p) => ({
            text: p.phrase,
            style: p.style
          })),
          ...line.keywords.slice(0, 2).map((kw, idx) => ({
            text: kw.word,
            style: (idx % 2 === 0 ? 'cyan_box' : 'pink_highlight') as 'cyan_box' | 'pink_highlight'
          }))
        ];

        for (const cand of candidates) {
          const rect = findTextRangeRectInElement(chunk.element, cand.text);
          if (!rect) continue;
          const elCenterX = rect.left + rect.width / 2;
          const elCenterY = rect.top + rect.height / 2;
          const dx = elCenterX - centerX;
          const dy = elCenterY - centerY;
          const maxDx = Math.max(380, window.innerWidth * 0.42);
          const rawDist = Math.hypot(dx, dy);

          if (Math.abs(dy) <= 135 && Math.abs(dx) <= maxDx && rawDist <= maxDx + 40) {
            const scoreDist = Math.hypot(dx * 0.65, dy * 1.45);
            nearby.push({
              rect,
              scoreDist,
              dx,
              dy,
              text: cand.text,
              style: cand.style
            });
          }
        }
      }

      nearby.sort((a, b) => a.scoreDist - b.scoreDist);
      const selected = nearby.slice(0, 5);

      setNearbyHighlights(
        selected.map((item, i) => ({
          id: `hl-${i}-${item.text}`,
          text: item.text,
          left: item.rect.left,
          top: item.rect.top,
          width: item.rect.width,
          height: item.rect.height,
          style: item.style
        }))
      );

      const leftItems = selected.filter((s) => s.dx <= 12);
      const rightItems = selected.filter((s) => s.dx > -12);

      const multiLegTargets: LegTargetVector[] = [];
      for (let legIdx = 0; legIdx < 8; legIdx++) {
        const isLeft = legIdx < 4;
        const pool = isLeft ? leftItems : rightItems;
        const item =
          pool[legIdx % Math.max(1, pool.length)] ||
          selected[legIdx % Math.max(1, selected.length)];
        if (item) {
          multiLegTargets.push({
            dx: item.dx,
            dy: item.dy,
            phrase: item.text,
            style: item.style
          });
        }
      }

      if (multiLegTargets.length > 0) {
        setLegReachVectors((prev) => ({
          ...prev,
          multiLegTargets
        }));
      }
    },
    [contextualLines, pageChunks]
  );

  const handleExplainDroppedChunk = useCallback(
    async (chunkIdx: number) => {
      const chunkText = activeParagraphs[chunkIdx];
      if (!chunkText) return;

      setIsExplainingChunk(true);
      setIntelligenceInitialTab('summary');
      setIntelligenceCardOpen(true);

      let createdNeuronId: string | undefined;
      setKnowledgeBase((prevKb) => {
        const nextKb = { ...prevKb };
        const neuron = ingestChunkAsNeuron(
          nextKb,
          chunkText,
          pageTitle,
          `Chunk #${chunkIdx + 1}: ${chunkText.split(/\s+/).slice(0, 4).join(' ')}`
        );
        createdNeuronId = neuron?.id;
        return nextKb;
      });

      const explanation = await explainChunkWithAi(
        chunkText,
        chunkIdx,
        knowledgeBase.neurons || [],
        apiConfig
      );
      setSelectedChunkExplanation({
        ...explanation,
        neuronId: createdNeuronId
      });
      setIsExplainingChunk(false);
    },
    [activeParagraphs, pageTitle, knowledgeBase.neurons, apiConfig]
  );

  const finishCrawlAndSummarize = useCallback(
    async (mode: 'full-tab' | 'visible' = 'full-tab', openTab: 'summary' | 'qa' = 'summary') => {
      setIsCrawling(false);
      setCrawlPaused(false);
      setIsTouchingKeyword(false);
      setActiveKeyword(null);
      setActiveLineIndex(null);
      setNearbyHighlights([]);
      setCrawlProgress(1);
      setIsReturningToCorner(true);

      const fullText = getFullActiveTabText() || document.body.innerText || '';
      const textToAnalyze =
        mode === 'visible'
          ? fullText.slice(0, Math.max(450, Math.floor(fullText.length * 0.55)))
          : fullText;

      setIsThinking(true);
      setIntelligenceInitialTab(openTab);
      setIntelligenceCardOpen(true);

      const summary = await generateAiSummary(
        textToAnalyze,
        pageTitle,
        apiConfig,
        contextualLines
      );
      setIsThinking(false);

      setCurrentSummary(summary);
      const allTouched = Array.from(
        new Set([
          ...touchedKeywordList,
          ...summary.touchedKeywords.map((k) => k.word.toLowerCase())
        ])
      );
      setTouchedKeywordList(allTouched);

      const updatedKb = {
        ...knowledgeBase,
        neurons: [...(knowledgeBase.neurons || [])],
        facts: [...knowledgeBase.facts],
        triplets: [...(knowledgeBase.triplets || [])],
        manuallyReadTabs: [...(knowledgeBase.manuallyReadTabs || [])]
      };
      updatedKb.totalTabsScanned += 1;
      ingestFullDocumentManualRead(updatedKb, pageTitle, activeParagraphs, contextualLines);
      feedContextToBrain(updatedKb, summary.coreThesis, 'tab_crawl');
      setKnowledgeBase({ ...updatedKb });
    },
    [
      getFullActiveTabText,
      pageTitle,
      apiConfig,
      contextualLines,
      touchedKeywordList,
      knowledgeBase,
      activeParagraphs
    ]
  );

  const startDownwardCrawl = useCallback(
    (mode: 'full-tab' | 'visible' = 'full-tab') => {
      const chunks = refreshPageChunks();
      setRadialMenuOpen(false);
      setIntelligenceCardOpen(false);
      setIsReturningToCorner(false);
      setTouchedKeywordList([]);
      lastIngestedLineRef.current = -1;

      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'auto' });
        const startPos = {
          x: window.innerWidth * 0.5,
          y: window.innerHeight * 0.25
        };
        spiderPosRef.current = startPos;
        setSpiderPos(startPos);

        crawlElapsedRef.current = 0;
        const targetCount =
          mode === 'visible'
            ? Math.max(4, Math.ceil(Math.max(chunks.length, wordTargetsMeta.length) * 0.55))
            : Math.max(5, Math.max(chunks.length, wordTargetsMeta.length));
        // Calibrate base duration so 1.0x crawls & scrolls briskly and scales linearly with spiderSpeed
        crawlDurationRef.current = Math.max(3800, Math.min(11000, targetCount * 380));

        setCrawlProgress(0);
        setCrawlPaused(false);
        setIsCrawling(true);
      }, 20);
    },
    [refreshPageChunks, wordTargetsMeta.length]
  );

  useEffect(() => {
    if (!isReturningToCorner || isCrawling || isDraggingSpider) return;

    let rafId: number;
    let lastTime = performance.now();

    const stepToCorner = (now: number) => {
      const dtMs = Math.min(50, Math.max(4, now - lastTime));
      lastTime = now;

      const corner = getSpiderCornerPos();
      const cur = spiderPosRef.current;
      const dx = corner.x - cur.x;
      const dy = corner.y - cur.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= 3) {
        spiderPosRef.current = corner;
        setSpiderPos(corner);
        setSpiderTilt(0);
        setIsReturningToCorner(false);
        return;
      }

      const maxStep = dtMs * 1.15 * spiderSpeed;
      const ratio = dist > maxStep ? maxStep / dist : 1;
      const nextX = cur.x + dx * ratio;
      const nextY = cur.y + dy * ratio;

      spiderPosRef.current = { x: nextX, y: nextY };
      setSpiderPos({ x: nextX, y: nextY });
      setSpiderTilt(Math.max(-8, Math.min(8, dx * 0.04)));
      setLegPhase((prev) => (prev + dtMs * 0.038 * spiderSpeed) % (Math.PI * 40));

      rafId = requestAnimationFrame(stepToCorner);
    };

    rafId = requestAnimationFrame(stepToCorner);
    return () => cancelAnimationFrame(rafId);
  }, [isReturningToCorner, isCrawling, isDraggingSpider, getSpiderCornerPos, spiderSpeed]);

  const finishCrawlRef = useRef(finishCrawlAndSummarize);
  useEffect(() => {
    finishCrawlRef.current = finishCrawlAndSummarize;
  }, [finishCrawlAndSummarize]);

  // 60FPS Center-Locked Webpage Crawler Loop (Monotonic sequential target traversal + throttled DOM scanning)
  useEffect(() => {
    if (!isCrawling || crawlPaused) return;

    let rafId: number;
    let lastTime = performance.now();
    let lastScanTime = 0;
    let highestTargetIdx = 0;

    const tick = (now: number) => {
      const dtMs = Math.min(50, Math.max(4, now - lastTime));
      lastTime = now;

      const scaledDtMs = dtMs * spiderSpeed;
      crawlElapsedRef.current += scaledDtMs;
      const safeDuration = Math.max(3200, crawlDurationRef.current);
      const progress = Math.min(1, crawlElapsedRef.current / safeDuration);
      setCrawlProgress(progress);

      const totalTargets = Math.max(1, wordTargetsMeta.length);
      const syncedWalkStepPx = ((220 * spiderSpeed) * dtMs) / 1000;

      const columnCenterX = window.innerWidth * 0.5;
      const downwardCrawlY = window.innerHeight * (0.24 + progress * 0.52);

      const floatTarget = progress * totalTargets;
      const rawIdx = Math.min(totalTargets - 1, Math.floor(floatTarget));
      if (rawIdx > highestTargetIdx) {
        highestTargetIdx = rawIdx;
      }
      const currentIdx = highestTargetIdx;
      const segmentFrac = floatTarget - Math.floor(floatTarget);

      const curMeta = wordTargetsMeta[currentIdx];
      const activeChunkEl =
        curMeta && pageChunks[curMeta.paragraphIndex]
          ? pageChunks[curMeta.paragraphIndex].element
          : null;

      // Simultaneously scroll the webpage at exact spiderSpeed while the spider crawls downward
      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight
      );
      const continuousScrollY = progress * maxScroll;
      if (activeChunkEl && maxScroll > 0) {
        const chunkRect = activeChunkEl.getBoundingClientRect();
        const elOffsetScroll =
          window.scrollY + (chunkRect.top + chunkRect.height * 0.5 - downwardCrawlY);
        const blendedTargetScrollY = Math.max(
          0,
          Math.min(maxScroll, continuousScrollY * 0.62 + elOffsetScroll * 0.38)
        );
        const catchupRate = Math.min(1, (dtMs / 16.67) * 0.44 * Math.max(0.85, spiderSpeed));
        const nextScrollY =
          window.scrollY + (blendedTargetScrollY - window.scrollY) * catchupRate;
        window.scrollTo({
          top: Math.max(continuousScrollY * 0.9, nextScrollY),
          behavior: 'auto'
        });
      } else if (maxScroll > 0) {
        window.scrollTo({ top: continuousScrollY, behavior: 'auto' });
      }

      const isWalkingPhase = segmentFrac < 0.2;
      const walkU = isWalkingPhase ? segmentFrac / 0.2 : 1;
      const smoothWalkU = walkU * walkU * (3 - 2 * walkU);
      const touchU = isWalkingPhase ? 0 : (segmentFrac - 0.2) / 0.8;

      let wordBiasX = 0;
      let wordBiasY = 0;
      let activeColumnX = columnCenterX;
      if (activeChunkEl && curMeta) {
        const chunkRect = activeChunkEl.getBoundingClientRect();
        if (chunkRect.width > 80) {
          activeColumnX = chunkRect.left + chunkRect.width * 0.5;
        }
        const chunkCenterY = chunkRect.top + chunkRect.height * 0.5;
        wordBiasX = Math.max(-44, Math.min(44, (activeColumnX - columnCenterX) * 0.45));
        wordBiasY = Math.max(-28, Math.min(28, (chunkCenterY - downwardCrawlY) * 0.28));
      }

      const desiredX =
        activeColumnX + Math.sin(progress * Math.PI * 10) * 16 + wordBiasX * 0.15 * smoothWalkU;
      const desiredY = downwardCrawlY + wordBiasY * smoothWalkU;

      const prevPos = spiderPosRef.current;
      const dx = desiredX - prevPos.x;
      const dy = desiredY - prevPos.y;
      const maxStepX = Math.max(3.0, syncedWalkStepPx * 0.95);
      const maxStepY = Math.max(3.0, syncedWalkStepPx * 0.95);
      const nextX = Math.abs(dx) > maxStepX ? prevPos.x + Math.sign(dx) * maxStepX : desiredX;
      const nextY = Math.abs(dy) > maxStepY ? prevPos.y + Math.sign(dy) * maxStepY : desiredY;

      spiderPosRef.current = { x: nextX, y: nextY };
      setSpiderPos({ x: nextX, y: nextY });

      const walkHeadingTilt =
        Math.sin(progress * Math.PI * 14) * 4.2 + Math.max(-6, Math.min(6, dx * 0.08));
      setSpiderTilt(walkHeadingTilt);

      if (curMeta) {
        setActiveLineIndex((prev) => (prev === curMeta.lineIndex ? prev : curMeta.lineIndex));
      }

      // Scale DOM phrase scanning interval with spiderSpeed & low-end device profile
      const baseScanMs = isLowEndDevice() ? 85 : 52;
      const scanIntervalMs = Math.max(28, Math.round(baseScanMs / Math.max(0.6, spiderSpeed)));
      if (now - lastScanTime >= scanIntervalMs) {
        lastScanTime = now;
        scanNearbyDomPhrases(nextX, nextY);
      }

      if (!isWalkingPhase && curMeta) {
        setIsTouchingKeyword(true);
        setActiveKeyword(curMeta.keywordObj);
        setLegTouchProgress(touchU);

        setTouchedKeywordList((prev) =>
          prev.includes(curMeta.word) ? prev : [...prev, curMeta.word]
        );

        if (lastIngestedLineRef.current !== curMeta.lineIndex) {
          lastIngestedLineRef.current = curMeta.lineIndex;
          setKnowledgeBase((prevKb) => {
            const nextKb = { ...prevKb };
            ingestLineContextToBrain(nextKb, curMeta.lineContext);
            return nextKb;
          });
        }
      } else {
        setIsTouchingKeyword(false);
        setActiveKeyword(null);
      }

      setLegPhase((prev) => (prev + syncedWalkStepPx * 0.16) % (Math.PI * 40));

      if (progress >= 1) {
        finishCrawlRef.current('full-tab');
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isCrawling, crawlPaused, wordTargetsMeta, pageChunks, scanNearbyDomPhrases, spiderSpeed]);

  // Low-End Device Friendly Idle Animation: only animate when radial menu is open or dragging,
  // and pause completely when stationary or tab is hidden to consume 0% background CPU/GPU
  useEffect(() => {
    if (isCrawling || isReturningToCorner || sleeping || !radialMenuOpen) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    if (isLowEndDevice()) return;
    const interval = setInterval(() => {
      setLegPhase((prev) => (prev + 0.08) % (Math.PI * 40));
    }, 120);
    return () => clearInterval(interval);
  }, [isCrawling, isReturningToCorner, sleeping, radialMenuOpen]);

  // Listen for Chrome Extension Runtime Messages (from Popup or Background Service Worker)
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;

    const listener = (
      msg: {
        type?: string;
        mode?: 'full-tab' | 'visible';
        speed?: number;
        spiderSpeed?: number;
      },
      _sender: unknown,
      sendResponse: (res?: unknown) => void
    ) => {
      if (!msg || !msg.type) return false;

      if (msg.type === 'SPIDAR_TRIGGER_CRAWL' || msg.type === 'SPIDAR_START_CRAWL') {
        const requestedSpeed =
          typeof msg.speed === 'number'
            ? msg.speed
            : typeof msg.spiderSpeed === 'number'
            ? msg.spiderSpeed
            : undefined;
        if (typeof requestedSpeed === 'number') {
          handleSpiderSpeedChange(requestedSpeed);
        }
        startDownwardCrawl(msg.mode || 'full-tab');
        sendResponse({ status: 'crawling_started', ok: true });
        return false;
      }

      if (
        msg.type === 'SPIDAR_CAPTURE_PAGE_CONTEXT' ||
        msg.type === 'SPIDAR_EXTRACT_PAGE_CONTEXT'
      ) {
        const chunks = refreshPageChunks();
        const selection = window.getSelection()?.toString().trim() || '';
        sendResponse({
          title: document.title || window.location.hostname || 'Active Webpage',
          url: window.location.href,
          paragraphs: chunks.map((c) => c.text),
          selectedText: selection
        });
        return false;
      }

      if (msg.type === 'SPIDAR_OPEN_INTELLIGENCE') {
        setRadialMenuOpen(false);
        setIntelligenceCardOpen(true);
        sendResponse({ ok: true });
        return false;
      }

      return false;
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [handleSpiderSpeedChange, startDownwardCrawl, refreshPageChunks]);

  const handleSendMessage = async (questionText: string) => {
    const cleanQ = questionText.trim();
    if (!cleanQ || isThinking) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: cleanQ,
      timestamp: Date.now()
    };
    const streamMsgId = `msg-${Date.now() + 1}`;
    const placeholderAssistantMsg: ChatMessage = {
      id: streamMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true
    };

    const nextHistory = [...chatMessages, userMsg];
    setChatMessages([...nextHistory, placeholderAssistantMsg]);
    setIsThinking(true);

    const updatedKb: NeuralKnowledgeBase = {
      ...knowledgeBase,
      neurons: [...(knowledgeBase.neurons || [])],
      facts: [...knowledgeBase.facts],
      triplets: [...(knowledgeBase.triplets || [])]
    };
    updatedKb.totalConversations += 1;

    const isOrdinaryQuestion =
      cleanQ.endsWith('?') ||
      /^(what|why|how|who|where|when|which|explain|summarize|compare|can\s+you|could\s+you|tell\s+me)\b/i.test(
        cleanQ
      );

    const localTrained = !isOrdinaryQuestion
      ? trainSpidarFromChatTurn(updatedKb, cleanQ, chatMessages, null)
      : { trainedNeuron: null, newFact: null, iqGain: 0 };
    setKnowledgeBase({ ...updatedKb });

    const fullText = getFullActiveTabText() || document.body.innerText || '';
    const isTabManuallyRead = (updatedKb.manuallyReadTabs || []).includes(pageTitle);

    const response = await askAiQuestion(
      cleanQ,
      fullText,
      updatedKb.facts,
      apiConfig,
      {
        articleTitle: pageTitle,
        selectedText: window.getSelection()?.toString().trim() || '',
        uploadedDocs: [],
        lineContexts: contextualLines,
        learnedTriplets: updatedKb.triplets,
        neurons: updatedKb.neurons || [],
        history: nextHistory,
        isTabManuallyRead
      },
      (_delta, fullSoFar) => {
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === streamMsgId ? { ...m, content: fullSoFar, isStreaming: true } : m
          )
        );
      }
    );

    let finalTrainedSummary = localTrained.trainedNeuron
      ? {
          id: localTrained.trainedNeuron.id,
          title: localTrained.trainedNeuron.title,
          insight: localTrained.trainedNeuron.distilledInsight,
          keyPhrases: localTrained.trainedNeuron.keyPhrases,
          iqGain: localTrained.iqGain
        }
      : undefined;

    if (response.trainedNeuron && !finalTrainedSummary && !isOrdinaryQuestion) {
      const aiTrained = trainSpidarFromChatTurn(
        updatedKb,
        cleanQ,
        chatMessages,
        response.trainedNeuron
      );
      if (aiTrained.trainedNeuron) {
        finalTrainedSummary = {
          id: aiTrained.trainedNeuron.id,
          title: aiTrained.trainedNeuron.title,
          insight: aiTrained.trainedNeuron.distilledInsight,
          keyPhrases: aiTrained.trainedNeuron.keyPhrases,
          iqGain: aiTrained.iqGain
        };
        setKnowledgeBase({ ...updatedKb });
      }
    }

    const finalAssistantMsg: ChatMessage = {
      id: streamMsgId,
      role: 'assistant',
      content: response.answer,
      timestamp: Date.now(),
      isStreaming: false,
      usedMemoryFacts: response.matchedFacts,
      activatedNeurons: response.activatedNeurons,
      webSources: response.webSources,
      citedLines: response.citedLines,
      modelUsed: response.modelUsed,
      cognitiveMode: response.cognitiveMode,
      trainedNeuron: finalTrainedSummary,
      errorState: response.errorState
    };

    setChatMessages((prev) =>
      prev.map((m) => (m.id === streamMsgId ? finalAssistantMsg : m))
    );
    setIsThinking(false);
  };

  const handleAddMemoryFact = (factText: string) => {
    const updatedKb = { ...knowledgeBase };
    feedContextToBrain(updatedKb, factText, 'user_prompt');
    setKnowledgeBase({ ...updatedKb });
  };

  const handleAddNeuron = (chunkText: string, customTitle?: string) => {
    const updatedKb = {
      ...knowledgeBase,
      neurons: [...(knowledgeBase.neurons || [])]
    };
    ingestChunkAsNeuron(updatedKb, chunkText, pageTitle, customTitle);
    setKnowledgeBase({ ...updatedKb });
  };

  const handleDeleteNeuron = (neuronId: string) => {
    const updatedKb = {
      ...knowledgeBase,
      neurons: (knowledgeBase.neurons || []).filter((n) => n.id !== neuronId)
    };
    saveNeuralKnowledgeBase(updatedKb);
    setKnowledgeBase(updatedKb);
  };

  const handleDeleteMemoryFact = (factId: string) => {
    const updatedKb = {
      ...knowledgeBase,
      facts: knowledgeBase.facts.filter((f) => f.id !== factId)
    };
    saveNeuralKnowledgeBase(updatedKb);
    setKnowledgeBase(updatedKb);
  };

  const handleResetVault = () => {
    const fresh = createDefaultKnowledgeBase();
    saveNeuralKnowledgeBase(fresh);
    setKnowledgeBase(fresh);
  };

  const handleSpiderPointerDown = (e: React.PointerEvent) => {
    if (isCrawling) return;
    draggingRef.current = true;
    dragMovedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleSpiderPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dist = Math.hypot(
      e.clientX - dragStartRef.current.x,
      e.clientY - dragStartRef.current.y
    );
    if (dist > 6) {
      dragMovedRef.current = true;
      setIsDraggingSpider(true);
      const clampedX = Math.max(60, Math.min(window.innerWidth - 60, e.clientX));
      const clampedY = Math.max(70, Math.min(window.innerHeight - 60, e.clientY));
      spiderPosRef.current = { x: clampedX, y: clampedY };
      setSpiderPos({ x: clampedX, y: clampedY });
      setLegPhase((prev) => prev + 0.35);

      scanNearbyDomPhrases(clampedX, clampedY);

      const els = document.elementsFromPoint(e.clientX, e.clientY);
      const chunkEl = els.find((el) => el.hasAttribute('data-spidar-chunk-idx'));
      if (chunkEl) {
        const idx = Number(chunkEl.getAttribute('data-spidar-chunk-idx'));
        setHoveredChunkIndex(Number.isNaN(idx) ? null : idx);
      } else {
        setHoveredChunkIndex(null);
      }
    }
  };

  const handleSpiderPointerUp = () => {
    if (draggingRef.current && dragMovedRef.current && hoveredChunkIndex !== null) {
      const targetChunk = hoveredChunkIndex;
      setHoveredChunkIndex(null);
      setIsDraggingSpider(false);
      setNearbyHighlights([]);
      draggingRef.current = false;
      handleExplainDroppedChunk(targetChunk);
      setIsReturningToCorner(true);
      return;
    }
    setHoveredChunkIndex(null);
    setIsDraggingSpider(false);
    setNearbyHighlights([]);
    draggingRef.current = false;
  };

  const handleSpiderClick = () => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    if (isCrawling) {
      setCrawlPaused((p) => !p);
    } else {
      setRadialMenuOpen((o) => !o);
    }
  };

  const handleOpenFullStudio = (
    view: 'analyzer' | 'outline-studio' | 'neural-graph' | 'extension-options' = 'analyzer'
  ) => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      window.open(chrome.runtime.getURL(`index.html?view=${view}`), '_blank', 'noopener,noreferrer');
    }
  };

  const activeCrawlingAnimation = isCrawling || isReturningToCorner;
  const currentJoints = computeSpiderLegJoints({
    phase: legPhase,
    isCrawling: activeCrawlingAnimation,
    isTouchingKeyword,
    touchProgress: legTouchProgress,
    downwardProgress: crawlProgress,
    legReachVectors
  });

  return (
    <SpidarCompanionOverlay
      showSpiderActor={true}
      showHighlightBoxes={true}
      spiderPos={spiderPos}
      spiderTilt={spiderTilt}
      legPhase={legPhase}
      sleeping={sleeping}
      currentJoints={currentJoints}
      activeCrawlingAnimation={activeCrawlingAnimation}
      isCrawling={isCrawling}
      crawlPaused={crawlPaused}
      crawlProgress={crawlProgress}
      spiderSpeed={spiderSpeed}
      isTouchingKeyword={isTouchingKeyword}
      activeKeyword={activeKeyword}
      activeLineIndex={activeLineIndex}
      isDraggingSpider={isDraggingSpider}
      hoveredChunkIndex={hoveredChunkIndex}
      nearbyHighlights={nearbyHighlights}
      onSpiderClick={handleSpiderClick}
      onSpiderPointerDown={handleSpiderPointerDown}
      onSpiderPointerMove={handleSpiderPointerMove}
      onSpiderPointerUp={handleSpiderPointerUp}
      onSpiderSpeedChange={handleSpiderSpeedChange}
      onToggleCrawlPause={() => setCrawlPaused((p) => !p)}
      onFinishCrawlNow={() => finishCrawlAndSummarize('full-tab')}
      onStartCrawl={() => startDownwardCrawl('full-tab')}
      radialMenuOpen={radialMenuOpen}
      onToggleRadialMenu={handleSpiderClick}
      onCloseRadialMenu={() => setRadialMenuOpen(false)}
      onOpenIntelligenceTab={(tab) => {
        setIntelligenceInitialTab(tab);
        setIntelligenceCardOpen(true);
      }}
      onExplainActiveChunk={() => handleExplainDroppedChunk(hoveredChunkIndex ?? 0)}
      intelligenceCardOpen={intelligenceCardOpen}
      intelligenceInitialTab={intelligenceInitialTab}
      onCloseIntelligenceCard={() => setIntelligenceCardOpen(false)}
      currentSummary={currentSummary}
      chatMessages={chatMessages}
      onSendMessage={handleSendMessage}
      onClearChat={() => setChatMessages([])}
      isThinking={isThinking}
      knowledgeBase={knowledgeBase}
      minimalistMode={minimalistMode}
      onToggleMinimalist={() => setMinimalistMode((m) => !m)}
      activeModelLabel={apiConfig.selectedModel || activeProviderDef.shortLabel}
      contextualLines={contextualLines}
      selectedChunkExplanation={selectedChunkExplanation}
      isExplainingChunk={isExplainingChunk}
      onClearChunkExplanation={() => setSelectedChunkExplanation(null)}
      vaultModalOpen={vaultModalOpen}
      onOpenVaultModal={() => setVaultModalOpen(true)}
      onCloseVaultModal={() => setVaultModalOpen(false)}
      onAddMemoryFact={handleAddMemoryFact}
      onAddNeuron={handleAddNeuron}
      onDeleteNeuron={handleDeleteNeuron}
      onDeleteMemoryFact={handleDeleteMemoryFact}
      onResetVault={handleResetVault}
      onAskAboutNeuron={(neuron: MemoryNeuron) => {
        setIntelligenceInitialTab('qa');
        setIntelligenceCardOpen(true);
        handleSendMessage(
          `Provide a detailed explanation of the "${neuron.title}" neuron in my Second Brain.`
        );
      }}
      onOpenFullStudio={handleOpenFullStudio}
    />
  );
};

function mountSpidarContentScript() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (document.getElementById('spidar-v2-root')) return;
  if (document.querySelector('[data-spidar-workbench="true"]')) return;

  const host = document.createElement('div');
  host.id = 'spidar-v2-root';
  host.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483640;overflow:visible;';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href =
    typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('styles.css')
      : '/styles.css';
  shadow.appendChild(styleLink);

  const mountPoint = document.createElement('div');
  mountPoint.id = 'spidar-shadow-app';
  mountPoint.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;color:#f1f5f9;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
  shadow.appendChild(mountPoint);

  const root = createRoot(mountPoint);
  root.render(<SpidarContentScriptApp />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountSpidarContentScript, { once: true });
} else {
  mountSpidarContentScript();
}
