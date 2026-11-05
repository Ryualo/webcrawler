/**
 * SPIDAR v2.6 - Continuous Arachnid Walking Gait, Multi-Phrase Scanner & Breathing Kinematics Engine
 * - Spider walks and crawls downward smoothly with an alternating tetrapod stepping gait (never teleports).
 * - Long wireframe-style legs step rhythmically as the page scrolls, planting on nearby phrases during stance phase.
 * - Organic breathing idle animation when stationary.
 */

import {
  DownwardCrawlWaypoint,
  CrawlEngineState,
  SalientKeyword,
  SpiderLegJoints,
  LegDefinition,
  ContextualLine,
  KnowledgeTriplet,
  DomWordTarget,
  DetectedPhrase,
  LegTargetVector
} from '../types';

/**
 * 240x240 SVG coordinate space (Spider center at 120, 120)
 * Long, spindly multi-jointed arachnid legs.
 */
export const BASE_LEGS: LegDefinition[] = [
  // Left 4 long articulated legs
  { id: 'L1', side: -1, index: 0, group: 0, hip: { x: 110, y: 115 }, knee: { x: 64, y: 74 }, ankle: { x: 34, y: 38 }, foot: { x: 16, y: 14 } },
  { id: 'L2', side: -1, index: 1, group: 1, hip: { x: 108, y: 120 }, knee: { x: 52, y: 102 }, ankle: { x: 22, y: 88 }, foot: { x: 6, y: 76 } },
  { id: 'L3', side: -1, index: 2, group: 0, hip: { x: 108, y: 126 }, knee: { x: 54, y: 146 }, ankle: { x: 24, y: 168 }, foot: { x: 8, y: 188 } },
  { id: 'L4', side: -1, index: 3, group: 1, hip: { x: 111, y: 132 }, knee: { x: 72, y: 174 }, ankle: { x: 46, y: 204 }, foot: { x: 28, y: 228 } },
  // Right 4 long articulated legs
  { id: 'R1', side: 1, index: 0, group: 1, hip: { x: 130, y: 115 }, knee: { x: 176, y: 74 }, ankle: { x: 206, y: 38 }, foot: { x: 224, y: 14 } },
  { id: 'R2', side: 1, index: 1, group: 0, hip: { x: 132, y: 120 }, knee: { x: 188, y: 102 }, ankle: { x: 218, y: 88 }, foot: { x: 234, y: 76 } },
  { id: 'R3', side: 1, index: 2, group: 1, hip: { x: 132, y: 126 }, knee: { x: 186, y: 146 }, ankle: { x: 216, y: 168 }, foot: { x: 232, y: 188 } },
  { id: 'R4', side: 1, index: 3, group: 0, hip: { x: 129, y: 132 }, knee: { x: 168, y: 174 }, ankle: { x: 194, y: 204 }, foot: { x: 212, y: 228 } }
];

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'are', 'was', 'were',
  'have', 'has', 'had', 'not', 'but', 'what', 'all', 'when', 'where', 'who',
  'will', 'more', 'about', 'into', 'than', 'them', 'some', 'could', 'other',
  'which', 'their', 'there', 'they', 'been', 'each', 'such', 'would', 'also',
  'these', 'after', 'then', 'over', 'most', 'only', 'very', 'even', 'through',
  'its', 'our', 'can', 'may', 'via', 'per', 'any', 'now', 'out', 'one', 'two',
  'often', 'rely', 'across', 'while', 'every', 'both', 'between', 'without',
  'below', 'above', 'under', 'upon', 'onto', 'within', 'along', 'around', 'because',
  'however', 'therefore', 'instead', 'allow', 'allows', 'using', 'used', 'make',
  'is', 'be', 'by', 'to', 'of', 'in', 'on', 'at', 'as', 'an', 'a', 'or', 'if',
  'introduces', 'initiates', 'evaluates', 'combines', 'compresses', 'embeds',
  'supports', 'locks', 'extends', 'activates', 'descends', 'traverses', 'raising'
]);

/**
 * Extracts precise, self-contained 2-4 word technical and conceptual phrases from a sentence
 */
export function extractContextualPhrases(
  sentence: string,
  lineIndex: number,
  paragraphIndex: number
): DetectedPhrase[] {
  const clean = sentence.trim().replace(/\s+/g, ' ');
  if (clean.length < 15) return [];

  const phrases: DetectedPhrase[] = [];
  const seen = new Set<string>();

  // 1. High-precision technical compounds, metrics, and model identifiers
  const metricOrModelRegex =
    /\b((?:\d+(?:,\d+)*(?:\.\d+)?(?:%|ms|s|x|k|m|gb|mb|\$)?\s+[a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)?)|(?:qwen2\.5:[a-z0-9-]+|qwen3:[a-z0-9-]+|qwen-2\.5\s+cognitive\s+synthesis|subject-relation-object\s+triplets|openai-compatible\s+bridge|neural\s+memory\s+vault|real-time\s+saliency\s+engine|line-level\s+context\s+detection|relational\s+triplet\s+extraction|biomimetic\s+downward\s+web-crawler|active\s+reading\s+locus|dom\s+word\s+coordinates|quantitative\s+metrics|syntactic\s+centrality|intrusive\s+cloud\s+telemetry|document\s+hierarchy))\b/gi;
  let mMatch: RegExpExecArray | null;
  while ((mMatch = metricOrModelRegex.exec(clean)) !== null) {
    const raw = mMatch[1].trim().replace(/^[.,"'()-]+|[.,"'()-]+$/g, '');
    const lower = raw.toLowerCase();
    if (raw.length >= 8 && !seen.has(lower) && phrases.length < 3) {
      seen.add(lower);
      const style: DetectedPhrase['style'] =
        (lineIndex + phrases.length) % 2 === 0 ? 'cyan_box' : 'pink_highlight';
      phrases.push({
        id: `phrase-${lineIndex}-${phrases.length}`,
        phrase: raw,
        lineIndex,
        paragraphIndex,
        style,
        category: 'metric_phrase',
        score: 4.8
      });
    }
  }

  // 2. Extract tight, contiguous non-stopword noun/concept chunks (2 to 3 content words)
  const rawTokens = clean.split(/\s+/).filter(Boolean);
  let currentRun: string[] = [];

  const flushRun = (runIdx: number) => {
    if (currentRun.length >= 2 && phrases.length < 3) {
      const trimmedRun = currentRun.slice(0, 3);
      const candidate = trimmedRun.join(' ');
      const lower = candidate.toLowerCase();
      if (
        candidate.length >= 10 &&
        candidate.length <= 36 &&
        !seen.has(lower)
      ) {
        seen.add(lower);
        const style: DetectedPhrase['style'] =
          (lineIndex + runIdx + phrases.length) % 2 === 0 ? 'pink_highlight' : 'cyan_box';
        phrases.push({
          id: `phrase-${lineIndex}-${phrases.length}`,
          phrase: candidate,
          lineIndex,
          paragraphIndex,
          style,
          category: style === 'pink_highlight' ? 'mechanism_phrase' : 'thesis_phrase',
          score: 3.8
        });
      }
    }
    currentRun = [];
  };

  rawTokens.forEach((tok, idx) => {
    const stripped = tok.replace(/^[.,"'()[\]]+|[.,"'()[\]:;?!]+$/g, '');
    const lower = stripped.toLowerCase();
    const hasPunctBreak = /[,;:.?!)]$/.test(tok);

    if (
      stripped.length >= 3 &&
      !STOP_WORDS.has(lower) &&
      !/^(?:l\d|r\d|\d+)$/i.test(stripped)
    ) {
      currentRun.push(stripped);
      if (hasPunctBreak || currentRun.length === 3) {
        flushRun(idx);
      }
    } else {
      flushRun(idx);
    }
  });
  flushRun(rawTokens.length);

  return phrases.slice(0, 3);
}

/**
 * Validates that a token is a clean, uncorrupted word or technical metric
 */
function isCleanSalientToken(raw: string): boolean {
  const lower = raw.toLowerCase().replace(/^[%-]+|[%-]+$/g, '');
  if (lower.length < 3 || lower.length > 26) return false;
  if (STOP_WORDS.has(lower)) return false;
  if (/^(http|https|www|com|org|net|html|href|mailto|localhost|undefined|null|true|false)$/i.test(lower)) {
    return false;
  }
  // Reject tokens with excessive symbols or repeated hyphens/underscores
  if (/[-_%]{2,}/.test(lower)) return false;
  // Allow valid quantitative metrics (e.g., 60fps, 98%, 42ms, 2.5x, 72b)
  if (/^\d+(?:\.\d+)?(?:%|ms|s|x|k|m|b|gb|mb|khz|hz|fps)?$/i.test(lower)) {
    return lower.length >= 2 && /[a-z%]/i.test(lower);
  }
  // Pure alphabetic/hyphenated word must contain at least one vowel (or 'y') to avoid corrupted consonant strings
  if (!/[aeiouy]/i.test(lower)) return false;
  return true;
}

/**
 * Extracts top salient keywords from text without corrupted tokens or filler words
 */
export function extractSalientKeywords(text: string, maxKeywords = 8): SalientKeyword[] {
  if (!text || text.trim().length === 0) return [];

  const cleanedText = text.replace(/https?:\/\/[^\s]+/gi, ' ');
  const sentences = cleanedText.split(/(?<=[.?!])\s+/).filter(Boolean);
  const wordFreq: Record<string, { count: number; sentence: string; lineIndex: number }> = {};

  const tokenRegex = /\b[A-Za-z0-9][A-Za-z0-9_%-]{2,25}\b/g;
  sentences.forEach((sentence, sIdx) => {
    const matches = sentence.match(tokenRegex) || [];
    matches.forEach((token) => {
      const cleanTok = token.replace(/^[-_%]+|[-_]+$/g, '');
      const lower = cleanTok.toLowerCase();
      if (isCleanSalientToken(cleanTok) && (lower.length >= 4 || /\d/.test(lower))) {
        if (!wordFreq[lower]) {
          wordFreq[lower] = { count: 0, sentence, lineIndex: sIdx };
        }
        const metricBoost = /\d|%|\$|ms|gb|mb|khz|fps/i.test(cleanTok) ? 2 : 1;
        wordFreq[lower].count += metricBoost;
      }
    });
  });

  const entries = Object.entries(wordFreq);
  if (entries.length === 0) return [];

  entries.sort((a, b) => {
    const scoreA = a[1].count * Math.log2(a[0].length + 1);
    const scoreB = b[1].count * Math.log2(b[0].length + 1);
    return scoreB - scoreA;
  });

  return entries.slice(0, maxKeywords).map(([word, meta], idx) => {
    let category: SalientKeyword['category'] = 'concept';
    if (/\d/.test(word) || /%|\$|mb|gb|ms|sec/i.test(word)) {
      category = 'metric';
    } else if (word[0] === word[0].toUpperCase()) {
      category = 'entity';
    } else if (/(ing|ed|ize|ify|tion|sion)$/i.test(word)) {
      category = 'action';
    }

    return {
      word,
      score: meta.count,
      lineIndex: meta.lineIndex,
      contextSentence: meta.sentence,
      category,
      highlightStyle: idx % 2 === 0 ? 'cyan_box' : 'pink_highlight'
    };
  });
}

/**
 * Extracts a genuine Subject -> Relation -> Object knowledge triplet from a contextual sentence
 */
export function extractTripletFromLine(sentence: string, lineNumber: number): KnowledgeTriplet | undefined {
  const clean = sentence.trim().replace(/\s+/g, ' ');
  if (clean.length < 24) return undefined;

  const relationRegex =
    /\b(introduces|evaluates|initiates|combines|compresses|embeds|reinforces|supports|achieves|reduces|processes|demonstrates|allows|requires|sustains|builds|connects|uses|enables|improves|eliminates|accelerates|transforms|establishes)\b/i;
  const match = clean.match(relationRegex);

  if (match && match.index !== undefined) {
    const relation = match[1].toLowerCase();
    const leftRaw = clean
      .slice(0, match.index)
      .replace(/^[^a-zA-Z0-9]+/, '')
      .replace(/^(the|a|an|this|these|that|those|while|because|when|by)\s+/i, '')
      .trim();
    const rightRaw = clean
      .slice(match.index + match[0].length)
      .replace(/[.?!]+$/, '')
      .replace(/^(the|a|an)\s+/i, '')
      .trim();

    const subjectWords = leftRaw
      .split(/[,;:]/)
      .pop()
      ?.trim()
      .split(/\s+/)
      .slice(-4)
      .join(' ')
      .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9%]+$/g, '');
    const objectWords = rightRaw
      .split(/[,;:]|(?:\band\b)|(?:\bwhich\b)|(?:\bthat\b)/i)[0]
      .trim()
      .split(/\s+/)
      .slice(0, 5)
      .join(' ')
      .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9%]+$/g, '');

    if (
      subjectWords &&
      objectWords &&
      subjectWords.length >= 3 &&
      objectWords.length >= 3 &&
      subjectWords.toLowerCase() !== objectWords.toLowerCase()
    ) {
      return {
        subject: subjectWords,
        relation,
        object: objectWords,
        lineNumber,
        confidence: 0.92
      };
    }
  }

  return undefined;
}

/**
 * Analyzes paragraphs into ContextualLines with both multi-word phrases and keywords
 */
export function analyzeContextualLines(paragraphs: string[]): ContextualLine[] {
  const lines: ContextualLine[] = [];
  let globalLineIndex = 0;

  paragraphs.forEach((para, pIdx) => {
    const rawSentences = para
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    rawSentences.forEach((sent) => {
      const kws = extractSalientKeywords(sent, 3);
      const phrases = extractContextualPhrases(sent, globalLineIndex, pIdx);
      const hasMetrics = /\b\d+(?:\.\d+)?(?:%|ms|s|x|k|m|gb|mb|\$)?\b/i.test(sent) || /\$\d+/i.test(sent);
      const hasCausalMechanism =
        /\b(by combining|whenever|because|therefore|achieves|introduces|evaluates|compresses|sustains|enables|eliminates|demonstrates)\b/i.test(
          sent
        );
      const isThesis =
        (pIdx === 0 && globalLineIndex <= 1) ||
        /\b(introduces|shifted decisively|specification|core|crucially|beyond)\b/i.test(sent);
      const isConclusion =
        /\b(ultimately|in conclusion|extract this|grounds model|auditability|fallback)\b/i.test(sent);

      let contextType: ContextualLine['contextType'] = 'general';
      let contextReason = 'Supporting descriptive context';
      let hasHighContext = kws.length >= 2 || phrases.length >= 1;

      if (hasMetrics) {
        contextType = 'metric_evidence';
        contextReason = 'Quantitative metric & empirical benchmark line';
        hasHighContext = true;
      } else if (isThesis) {
        contextType = 'thesis';
        contextReason = 'Core thesis & architectural premise';
        hasHighContext = true;
      } else if (hasCausalMechanism) {
        contextType = 'mechanism';
        contextReason = 'Causal mechanism & operational workflow';
        hasHighContext = true;
      } else if (isConclusion) {
        contextType = 'conclusion';
        contextReason = 'Key synthesis & actionable takeaway';
        hasHighContext = true;
      }

      const enrichedKws = kws.map((k, kIdx) => ({
        ...k,
        lineIndex: globalLineIndex,
        paragraphIndex: pIdx,
        contextSentence: sent,
        contextType,
        highlightStyle: ((globalLineIndex + kIdx) % 2 === 0 ? 'cyan_box' : 'pink_highlight') as
          | 'cyan_box'
          | 'pink_highlight'
      }));

      lines.push({
        lineIndex: globalLineIndex,
        paragraphIndex: pIdx,
        text: sent,
        hasHighContext,
        contextType,
        contextReason,
        keywords: enrichedKws,
        phrases,
        triplet: hasHighContext ? extractTripletFromLine(sent, globalLineIndex + 1) : undefined
      });

      globalLineIndex += 1;
    });
  });

  return lines;
}

export interface DownwardTrajectoryConfig {
  startY: number;
  endY: number;
  centerX: number;
  width: number;
  keywords: SalientKeyword[];
  stepsPerKeyword?: number;
}

/**
 * Computes downward crawl trajectory waypoints where the spider walks continuously down the center
 */
export function generateDownwardTrajectory(config: DownwardTrajectoryConfig): DownwardCrawlWaypoint[] {
  const { startY, endY, centerX, width, keywords, stepsPerKeyword = 8 } = config;
  const totalDistance = Math.max(80, endY - startY);
  const waypoints: DownwardCrawlWaypoint[] = [];

  const keywordCount = Math.max(1, keywords.length);
  const distancePerKeyword = totalDistance / (keywordCount + 1);

  waypoints.push({
    x: centerX,
    y: startY,
    progress: 0,
    milestoneType: 'crawl'
  });

  keywords.forEach((kw, kwIdx) => {
    const targetY = startY + (kwIdx + 1) * distancePerKeyword;
    const slightWeaveX = centerX + Math.sin((kwIdx + 1) * 1.35) * Math.min(20, width * 0.045);

    const preSteps = 4;
    for (let s = 1; s <= preSteps; s++) {
      const u = s / preSteps;
      const prevKwY = kwIdx === 0 ? startY : startY + kwIdx * distancePerKeyword;
      const prevWeaveX =
        kwIdx === 0
          ? centerX
          : centerX + Math.sin(kwIdx * 1.35) * Math.min(20, width * 0.045);
      const curY = prevKwY + (targetY - prevKwY) * u;
      const curX = prevWeaveX + (slightWeaveX - prevWeaveX) * u;
      waypoints.push({
        x: curX,
        y: curY,
        progress: Math.min(1, (curY - startY) / totalDistance),
        milestoneType: 'crawl',
        lineIndex: kw.lineIndex
      });
    }

    const legSpan = Math.max(42, Math.min(92, kw.word.length * 7));
    for (let t = 0; t < stepsPerKeyword; t++) {
      const stepSubY = targetY + (t / stepsPerKeyword) * (distancePerKeyword * 0.25);
      waypoints.push({
        x: slightWeaveX,
        y: stepSubY,
        progress: Math.min(1, (stepSubY - startY) / totalDistance),
        milestoneType: 'touch_keyword',
        keyword: kw,
        lineIndex: kw.lineIndex,
        legReachVectors: {
          leftFrontDx: -legSpan,
          leftFrontDy: 34,
          rightFrontDx: legSpan,
          rightFrontDy: 34
        },
        targetLegs: {
          leftFoot: { x: slightWeaveX - legSpan, y: stepSubY + 28 },
          rightFoot: { x: slightWeaveX + legSpan, y: stepSubY + 28 }
        }
      });
    }
  });

  waypoints.push({
    x: centerX,
    y: endY,
    progress: 1,
    milestoneType: 'crawl'
  });

  return waypoints;
}

/**
 * Generates DOM-anchored trajectory where the spider walks continuously down the center
 */
export function generateDomAnchoredTrajectory(
  domTargets: DomWordTarget[],
  containerViewportHeight: number,
  containerScrollHeight: number,
  contextualLines: ContextualLine[],
  columnCenterX?: number
): DownwardCrawlWaypoint[] {
  if (domTargets.length === 0) return [];

  const waypoints: DownwardCrawlWaypoint[] = [];
  const maxScroll = Math.max(0, containerScrollHeight - containerViewportHeight);

  const avgX =
    columnCenterX ??
    domTargets.reduce((acc, t) => acc + t.offsetLeft + t.width / 2, 0) / domTargets.length;

  const firstTarget = domTargets[0];
  const initialY = Math.max(36, firstTarget.offsetTop - 18);

  waypoints.push({
    x: avgX,
    y: initialY,
    progress: 0,
    milestoneType: 'crawl',
    lineIndex: firstTarget.lineIndex,
    targetScrollTop: Math.max(0, Math.min(maxScroll, initialY - containerViewportHeight * 0.42))
  });

  domTargets.forEach((target, idx) => {
    const wordCenterX = target.offsetLeft + target.width / 2;
    const offsetFromCenter = wordCenterX - avgX;
    const subtleWeaveX =
      avgX + Math.max(-24, Math.min(24, offsetFromCenter * 0.16)) + Math.sin(idx * 1.4) * 10;
    const spiderHoverY = Math.max(36, target.offsetTop - 10);
    const prevWp = waypoints[waypoints.length - 1];
    const lineCtx = contextualLines.find((l) => l.lineIndex === target.lineIndex);

    const walkSteps = 6;
    for (let s = 1; s <= walkSteps; s++) {
      const u = s / walkSteps;
      const curX = prevWp.x + (subtleWeaveX - prevWp.x) * u;
      const curY = prevWp.y + (spiderHoverY - prevWp.y) * u;
      const curProgress = Math.min(0.99, (idx + u * 0.5) / domTargets.length);
      const centeredScroll = Math.max(0, Math.min(maxScroll, curY - containerViewportHeight * 0.44));

      waypoints.push({
        x: curX,
        y: curY,
        progress: curProgress,
        milestoneType: 'crawl',
        lineIndex: target.lineIndex,
        lineContext: lineCtx,
        targetScrollTop: centeredScroll
      });
    }

    const reachDx = wordCenterX - subtleWeaveX;
    const halfWordW = Math.max(20, Math.min(54, target.width * 0.55));
    const centeredScrollAtWord = Math.max(
      0,
      Math.min(maxScroll, spiderHoverY - containerViewportHeight * 0.44)
    );

    const kwObj: SalientKeyword = {
      word: target.word,
      score: 3,
      lineIndex: target.lineIndex,
      paragraphIndex: target.paragraphIndex,
      contextSentence: target.lineText,
      contextType: target.contextType
    };

    const touchHoldSteps = 9;
    for (let t = 0; t < touchHoldSteps; t++) {
      waypoints.push({
        x: subtleWeaveX,
        y: spiderHoverY,
        progress: Math.min(0.99, (idx + 0.5 + (t / touchHoldSteps) * 0.5) / domTargets.length),
        milestoneType: 'touch_keyword',
        keyword: kwObj,
        lineIndex: target.lineIndex,
        lineContext: lineCtx,
        targetScrollTop: centeredScrollAtWord,
        legReachVectors: {
          leftFrontDx: Math.max(-105, Math.min(-24, reachDx - halfWordW)),
          leftFrontDy: 24,
          rightFrontDx: Math.max(24, Math.min(105, reachDx + halfWordW)),
          rightFrontDy: 24
        },
        targetLegs: {
          leftFoot: { x: wordCenterX - halfWordW, y: target.offsetTop + target.height * 0.5 },
          rightFoot: { x: wordCenterX + halfWordW, y: target.offsetTop + target.height * 0.5 }
        }
      });
    }
  });

  const last = waypoints[waypoints.length - 1];
  waypoints.push({
    ...last,
    progress: 1,
    milestoneType: 'crawl'
  });

  return waypoints;
}

/**
 * Computes the spider's 8 long, spindly leg joints (in a 240x240 viewBox centered at 120, 120):
 * - When crawling/scrolling (isCrawling === true), EVERY leg performs a continuous, lively
 *   alternating tetrapod walking stride (lifting, swinging downward, planting on words, and pushing back)
 *   so the spider visibly crawls as it moves and scrolls—never freezing or teleporting!
 * - When stationary (!isCrawling), performs a lifelike rhythmic breathing animation.
 */
export function computeSpiderLegJoints(params: {
  phase: number;
  isCrawling: boolean;
  isTouchingKeyword: boolean;
  touchProgress?: number;
  downwardProgress?: number;
  legReachVectors?: DownwardCrawlWaypoint['legReachVectors'];
}): SpiderLegJoints[] {
  const {
    phase,
    isCrawling,
    isTouchingKeyword,
    touchProgress = 0,
    legReachVectors
  } = params;

  const multiTargets: LegTargetVector[] = legReachVectors?.multiLegTargets || [];

  return BASE_LEGS.map((leg, idx) => {
    // 1. IDLE BREATHING ANIMATION (when stationary and not touching a keyword)
    if (!isCrawling && !isTouchingKeyword) {
      const breathCycle = Math.sin(phase * 0.85 + leg.index * 0.35);
      const secondaryPulse = Math.cos(phase * 0.85 + leg.side * 0.4);

      const kneeExpandX = breathCycle * 4.8 * leg.side;
      const kneeRiseY = -breathCycle * 4.0;
      const ankleExpandX = breathCycle * 3.4 * leg.side;
      const ankleRiseY = -breathCycle * 2.6;
      const footMicroShiftX = secondaryPulse * 2.0 * leg.side;
      const footMicroShiftY = breathCycle * 1.8;

      return {
        kx: (leg.knee.x + kneeExpandX).toFixed(1),
        ky: (leg.knee.y + kneeRiseY).toFixed(1),
        ax: (leg.ankle.x + ankleExpandX).toFixed(1),
        ay: (leg.ankle.y + ankleRiseY).toFixed(1),
        fx: (leg.foot.x + footMicroShiftX).toFixed(1),
        fy: (leg.foot.y + footMicroShiftY).toFixed(1),
        isTouchingWord: false
      };
    }

    // 2. CONTINUOUS ARACHNID TETRAPOD WALKING & CRAWLING GAIT
    // Alternating tetrapod groups (Group 0: L1, L3, R2, R4 vs Group 1: L2, L4, R1, R3)
    const groupOffset = leg.group === 0 ? 0 : Math.PI;
    const pairPhase = leg.index * 0.42;
    const gaitAngle = phase + groupOffset + pairPhase;

    // swingWave: -1 (pulled back at end of stance) -> +1 (reaching forward/downward at end of swing)
    const swingWave = Math.sin(gaitAngle);
    // liftWave: > 0 when leg is lifted in the air swinging forward; 0 when planted on the page pushing downward
    const liftWave = Math.max(0, Math.cos(gaitAngle));
    // stanceWeight: 1 when foot is planted on the text, 0 when lifted mid-stride
    const stanceWeight = Math.max(0, -Math.cos(gaitAngle));

    // Pronounced, unmistakable spider walking stride along Y (downward crawl) and X (lateral clawing)
    const strideY = swingWave * 22.0;
    const strideX = (liftWave * 14.0 - stanceWeight * 4.5) * leg.side;

    let fxNum = leg.foot.x + strideX;
    let fyNum = leg.foot.y + strideY;

    // Knee & ankle flex dynamically during lift and push phases
    let kxNum = leg.knee.x + strideX * 0.58 + liftWave * 8.5 * leg.side;
    let kyNum = leg.knee.y + strideY * 0.55 - liftWave * 11.0;
    let axNum = leg.ankle.x + strideX * 0.85 + liftWave * 5.0 * leg.side;
    let ayNum = leg.ankle.y + strideY * 0.82 - liftWave * 8.0;

    let touchingWord = false;
    let highlightStyle: SpiderLegJoints['highlightStyle'] = 'cyan_box';
    let targetWord: string | undefined;

    // 3. Blend tactile word/phrase reach smoothly into the walking cycle so legs step ONTO words without freezing!
    const customTarget = multiTargets[idx];
    if (customTarget && stanceWeight > 0.15) {
      // Only blend toward the phrase when this leg is in its downward stance/plant phase
      const plantEnvelope = stanceWeight * 0.48;
      const clampedDx = Math.max(-108, Math.min(108, customTarget.dx));
      const clampedDy = Math.max(-98, Math.min(108, customTarget.dy));

      const phraseFootX = Math.max(8, Math.min(232, 120 + clampedDx));
      const phraseFootY = Math.max(8, Math.min(232, 120 + clampedDy));

      fxNum = fxNum + (phraseFootX - fxNum) * plantEnvelope;
      fyNum = fyNum + (phraseFootY - fyNum) * plantEnvelope;
      kxNum = leg.hip.x + (fxNum - leg.hip.x) * 0.44 + leg.side * 16;
      kyNum = leg.hip.y + (fyNum - leg.hip.y) * 0.34 - 10;
      axNum = leg.hip.x + (fxNum - leg.hip.x) * 0.76 + leg.side * 8;
      ayNum = leg.hip.y + (fyNum - leg.hip.y) * 0.72 - 4;

      touchingWord = stanceWeight > 0.45;
      highlightStyle = customTarget.style || 'cyan_box';
      targetWord = customTarget.phrase;
    } else if (isTouchingKeyword && leg.index === 0) {
      // Front feeler legs (L1 & R1) reach down onto active keyword while still pulsing with the crawl gait
      const envelope = Math.sin(Math.min(1, Math.max(0.25, touchProgress)) * Math.PI);
      const targetDx =
        leg.side === -1
          ? legReachVectors?.leftFrontDx ?? -56
          : legReachVectors?.rightFrontDx ?? 56;
      const targetDy =
        leg.side === -1
          ? legReachVectors?.leftFrontDy ?? 38
          : legReachVectors?.rightFrontDy ?? 38;

      const desiredFootX = Math.max(8, Math.min(232, 120 + targetDx + strideX * 0.25));
      const desiredFootY = Math.max(12, Math.min(232, 146 + targetDy + strideY * 0.25));

      fxNum = leg.foot.x + (desiredFootX - leg.foot.x) * envelope;
      fyNum = leg.foot.y + (desiredFootY - leg.foot.y) * envelope;
      kxNum = leg.hip.x + (fxNum - leg.hip.x) * 0.42 + leg.side * 16 * envelope;
      kyNum = leg.hip.y + (fyNum - leg.hip.y) * 0.32 - 12 * envelope;
      axNum = leg.hip.x + (fxNum - leg.hip.x) * 0.76 + leg.side * 8 * envelope;
      ayNum = leg.hip.y + (fyNum - leg.hip.y) * 0.72;

      touchingWord = true;
      highlightStyle = 'cyan_box';
    }

    return {
      kx: kxNum.toFixed(1),
      ky: kyNum.toFixed(1),
      ax: axNum.toFixed(1),
      ay: ayNum.toFixed(1),
      fx: fxNum.toFixed(1),
      fy: fyNum.toFixed(1),
      isTouchingWord: touchingWord,
      targetWord,
      highlightStyle
    };
  });
}

/**
 * Evaluates current state during downward crawl animation
 */
export function evaluateDownwardCrawlProgress(
  waypoints: DownwardCrawlWaypoint[],
  elapsedMs: number,
  totalDurationMs: number
): CrawlEngineState {
  if (waypoints.length === 0) {
    return {
      x: 0,
      y: 0,
      tiltDeg: 0,
      progress: 1,
      isComplete: true,
      activeKeyword: null,
      activeLineIndex: null,
      activeLineContext: null,
      isTouchingKeyword: false,
      legTouchProgress: 0,
      currentScrollY: 0,
      targetScrollY: 0
    };
  }

  const safeDuration = Math.max(500, totalDurationMs);
  const clampedElapsed = Math.max(0, Math.min(safeDuration, elapsedMs));
  const progress = clampedElapsed / safeDuration;
  const isComplete = progress >= 1;

  const floatIndex = progress * (waypoints.length - 1);
  const idxA = Math.min(waypoints.length - 1, Math.floor(floatIndex));
  const idxB = Math.min(waypoints.length - 1, idxA + 1);
  const frac = floatIndex - idxA;
  const smoothFrac = frac * frac * (3 - 2 * frac);

  const wpA = waypoints[idxA];
  const wpB = waypoints[idxB];

  const x = wpA.x + (wpB.x - wpA.x) * smoothFrac;
  const y = wpA.y + (wpB.y - wpA.y) * smoothFrac;

  const isTouching = wpA.milestoneType === 'touch_keyword' || wpB.milestoneType === 'touch_keyword';
  const activeKeyword = wpA.keyword || wpB.keyword || null;
  const activeLineIndex =
    typeof wpA.lineIndex === 'number'
      ? wpA.lineIndex
      : typeof wpB.lineIndex === 'number'
      ? wpB.lineIndex
      : null;
  const activeLineContext = wpA.lineContext || wpB.lineContext || null;

  const dx = wpB.x - wpA.x;
  const dy = Math.max(0.1, Math.abs(wpB.y - wpA.y));
  const bankDeg = Math.atan2(dx, dy) * (180 / Math.PI) * 0.25;
  const tiltDeg = isTouching ? 0 : Math.max(-8, Math.min(8, bankDeg));

  const scrollA = wpA.targetScrollTop ?? Math.max(0, y - 220);
  const scrollB = wpB.targetScrollTop ?? Math.max(0, y - 220);
  const currentScrollY = scrollA + (scrollB - scrollA) * smoothFrac;

  return {
    x,
    y,
    tiltDeg,
    progress,
    isComplete,
    activeKeyword,
    activeLineIndex,
    activeLineContext,
    isTouchingKeyword: isTouching,
    legTouchProgress: isTouching ? (floatIndex % 1) : 0,
    legReachVectors: wpA.legReachVectors || wpB.legReachVectors,
    currentScrollY,
    targetScrollY: currentScrollY
  };
}
