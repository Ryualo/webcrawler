/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowDownCircle,
  Download,
  Globe,
  Code2,
  Eye,
  PlusCircle,
  Minimize2,
  Maximize2,
  Bot,
  Network,
  Search,
  Zap,
  Sliders,
  PenTool
} from 'lucide-react';
import {
  SalientKeyword,
  WebSummaryResult,
  ChatMessage,
  NeuralKnowledgeBase,
  ApiConfig,
  ContextualLine,
  KnowledgeTriplet,
  LegTargetVector,
  ChunkExplanationResult,
  UploadedDocument,
  MemoryNeuron,
  NeuronRelationType
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
  downloadExtractedBrainFile,
  createDefaultKnowledgeBase,
  trainSpidarFromChatTurn,
  updateMemoryNeuron,
  connectNeuronsWithRelation,
  removeNeuronConnection
} from './utils/neuralMemory';
import {
  generateAiSummary,
  askAiQuestion,
  explainChunkWithAi
} from './utils/apiProxy';
import { getProviderDefinition } from './utils/aiProviders';
import { generateAndDownloadExtensionZip } from './utils/extensionGenerator';
import { isLowEndDevice } from './utils/performanceWorker';
import {
  getInitialSurfaceMode,
  syncUrlSurfaceMode,
  navigateToSpidarSurface,
  persistConfigEverywhere,
  subscribeToCrossContextSync,
  captureLiveActiveChromeTab,
  triggerActiveChromeTabCrawl,
  LiveBrowserTabSnapshot,
  SpidarSurfaceMode
} from './utils/chromeBridge';
import { CheckCircle2 } from 'lucide-react';
import { NeuralBrainGraph } from './components/NeuralBrainGraph';
import { ApiConfigModal, ExtensionOptionsPanel } from './components/ApiConfigModal';
import { ExtensionStudioModal } from './components/ExtensionStudioModal';
import { OutlineStudioPanel } from './components/OutlineStudioPanel';
import { ExtensionPopupSurface } from './components/ExtensionPopupSurface';
import {
  SpidarCompanionOverlay,
  NearbyHighlightOverlay
} from './components/SpidarCompanionOverlay';

interface SimulatedBrowserTab {
  id: string;
  title: string;
  url: string;
  category: string;
  readTime: string;
  paragraphs: string[];
}

const DEMO_TABS: SimulatedBrowserTab[] = [
  {
    id: 'tab-quantum-agents',
    title: 'Autonomous Cyber-Arachnid Agents & Multi-Provider Cognitive Architecture',
    url: 'https://research.spidar.ai/v2.7/center-crawler-and-second-brain-neurons',
    category: 'Systems Architecture',
    readTime: '4 min read',
    paragraphs: [
      'Modern browser companions often rely on intrusive cloud telemetry and static sidebars that disconnect users from the underlying document hierarchy. SPIDAR introduces a biomimetic downward web-crawler architecture that traverses DOM viewports line-by-line while centralizing scroll around the active reading locus.',
      'As the spider descends through long-form technical articles, its real-time saliency engine evaluates lexical density, quantitative metrics, and syntactic centrality. Whenever a high-context line is encountered, the spider locks onto the exact DOM word coordinates and extends its front legs (L1 and R1) to physically bracket the target concept.',
      'When the user activates the universal Analyse Tab mode, SPIDAR initiates synchronized centralized scrolling across the entire webpage. By combining line-level context detection with cognitive synthesis and relational triplet extraction, the engine compresses thousands of words into an executive thesis in milliseconds.',
      'Beyond single-page summarization, SPIDAR embeds a progressive Second Brain Neural Graph that grows more connected with every line it reads. Each scanned sentence extracts Subject-Relation-Object triplets and links associative concepts inside browser storage.',
      'For teams running cloud or local LLMs, the multi-provider bridge supports Gemini, OpenAI, Anthropic, OpenRouter, and local Qwen models (qwen2.5:7b-instruct, qwen2.5-coder:7b, and qwen3:8b via Ollama or LM Studio) with real-time token streaming and automatic cognitive fallback.'
    ]
  },
  {
    id: 'tab-sovereign-compute',
    title: 'Decentralized Inference Economics & Hybrid Model Routing in 2026',
    url: 'https://journal.edgecompute.org/2026/hybrid-inference-benchmarks',
    category: 'AI Infrastructure',
    readTime: '5 min read',
    paragraphs: [
      'Enterprise deployment of large language models has shifted decisively toward hybrid edge-cloud routing. Organizations now process 68% of routine document classification, summarization, and entity extraction directly on local workstation daemons to eliminate token latency and safeguard proprietary context.',
      'Benchmark telemetry across 14,000 production workloads demonstrates that progressive line-context extraction paired with Qwen-2.5-7B-Instruct achieves 94% parity with frontier cloud models on analytical reasoning tasks, while reducing operational expenditure by $42,000 per million requests.',
      'By standardizing on OpenAI-compatible REST schemas, engineering teams can hot-swap inference backends between local Ollama instances, Google Gemini, Anthropic Claude, OpenAI, and OpenRouter aggregators without refactoring client application code.',
      'Crucially, portable Second Brain vaults allow user preferences, architectural constraints, and relational triplets to travel across heterogeneous tools. Instead of re-prompting every assistant from scratch, developers inject a structured memory bundle that grounds model outputs immediately.'
    ]
  },
  {
    id: 'tab-custom-sandbox',
    title: 'Interactive Custom Document & Webpage Sandbox',
    url: 'spidar://sandbox/custom-tab-analyzer',
    category: 'Custom Input',
    readTime: 'Live Editable',
    paragraphs: [
      'Paste or edit any article, research paper, or project specification below and click "Analyse Tab (Auto-Scroll)" or drag SPIDAR onto any paragraph to watch its long legs highlight nearby phrases and store Neurons in your Second Brain.'
    ]
  }
];

type WorkbenchTabId = 'analyzer' | 'outline-studio' | 'neural-graph' | 'extension-options';

export default function App() {
  const [surfaceMode, setSurfaceMode] = useState<SpidarSurfaceMode>(() => getInitialSurfaceMode());
  const [activeWorkbenchTab, setActiveWorkbenchTab] = useState<WorkbenchTabId>(() => {
    const init = getInitialSurfaceMode();
    if (
      init === 'outline-studio' ||
      init === 'neural-graph' ||
      init === 'extension-options' ||
      init === 'analyzer'
    ) {
      return init;
    }
    return 'analyzer';
  });
  const [liveChromeTab, setLiveChromeTab] = useState<LiveBrowserTabSnapshot | null>(null);
  const [activeBrowserTabId, setActiveBrowserTabId] = useState<string>(DEMO_TABS[0].id);
  const [customText, setCustomText] = useState<string>(
    `Project Titan Specification: We are building a real-time distributed telemetry pipeline in TypeScript and Rust. The system sustains 120,000 events per second with sub-15ms p99 latency. Multi-provider AI models synthesize line-by-line context triplets so engineers receive natural architectural answers. All mission-critical state transitions are persisted as Neurons in the Second Brain Vault for cross-project auditability.`
  );
  const [relatedSearchQuery, setRelatedSearchQuery] = useState<string>('');
  const [selectedWebText, setSelectedWebText] = useState<string>('');
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([]);
  const [graphNotice, setGraphNotice] = useState<string | null>(null);

  // Minimalist view state
  const [minimalistMode, setMinimalistMode] = useState<boolean>(false);

  // Persistent Second Brain & Multi-Provider API Config
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

  // Helper for spider resting corner position (bottom-left dock, clear of the right-hand Neural Graph)
  const getSpiderCornerPos = useCallback(() => {
    if (typeof window === 'undefined') return { x: 96, y: 790 };
    return {
      x: 96,
      y: Math.max(240, window.innerHeight - 96)
    };
  }, []);

  // Spider physical, breathing & center-biased walking state
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

  // Web-crawler DOM phrase/word targeting & line-context state
  const [isCrawling, setIsCrawling] = useState<boolean>(false);
  const [crawlPaused, setCrawlPaused] = useState<boolean>(false);
  const [crawlProgress, setCrawlProgress] = useState<number>(0);
  const [activeKeyword, setActiveKeyword] = useState<SalientKeyword | null>(null);
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
  const [, setActiveLineContext] = useState<ContextualLine | null>(null);
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
  const [scannedLineIndices, setScannedLineIndices] = useState<number[]>([]);
  const [, setLiveLearnedTriplets] = useState<KnowledgeTriplet[]>([]);

  // Chunk Explainer state (when user drags spider onto a chunk of text)
  const [selectedChunkExplanation, setSelectedChunkExplanation] =
    useState<ChunkExplanationResult | null>(null);
  const [isExplainingChunk, setIsExplainingChunk] = useState<boolean>(false);

  // Full Modals, Radial Menu & Intelligence Card state
  const [radialMenuOpen, setRadialMenuOpen] = useState<boolean>(false);
  const [intelligenceCardOpen, setIntelligenceCardOpen] = useState<boolean>(false);
  const [intelligenceInitialTab, setIntelligenceInitialTab] = useState<
    'summary' | 'qa' | 'keywords' | 'vault'
  >('summary');
  const [vaultModalOpen, setVaultModalOpen] = useState<boolean>(false);
  const [apiModalOpen, setApiModalOpen] = useState<boolean>(false);
  const [extStudioOpen, setExtStudioOpen] = useState<boolean>(false);

  // Q&A & Summary state
  const [currentSummary, setCurrentSummary] = useState<WebSummaryResult | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newNeuronInput, setNewNeuronInput] = useState<string>('');
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [zipDownloading, setZipDownloading] = useState<boolean>(false);

  // Refs
  const articleScrollRef = useRef<HTMLDivElement | null>(null);
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

  const availableBrowserTabs = useMemo<SimulatedBrowserTab[]>(() => {
    if (liveChromeTab) {
      return [liveChromeTab, ...DEMO_TABS];
    }
    return DEMO_TABS;
  }, [liveChromeTab]);

  const activeTabObj =
    availableBrowserTabs.find((t) => t.id === activeBrowserTabId) || availableBrowserTabs[0];

  const activeParagraphs = useMemo(() => {
    if (activeBrowserTabId === 'tab-custom-sandbox') {
      return customText.split(/\n\s*\n/).filter(Boolean);
    }
    return activeTabObj.paragraphs;
  }, [activeBrowserTabId, activeTabObj.paragraphs, customText]);

  const getFullActiveTabText = useCallback(() => {
    return activeParagraphs.join('\n\n');
  }, [activeParagraphs]);

  // Synchronize state across Chrome Extension contexts (Popup, Options, Content Script, Studio Tabs)
  useEffect(() => {
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
      },
      onActiveTabSnapshotSync: (snapshot) => {
        setLiveChromeTab(snapshot);
        if (snapshot.selectedText) {
          setSelectedWebText(snapshot.selectedText);
        }
      }
    });

    captureLiveActiveChromeTab().then((snapshot) => {
      if (snapshot) {
        setLiveChromeTab(snapshot);
        setActiveBrowserTabId(snapshot.id);
        if (snapshot.selectedText) {
          setSelectedWebText(snapshot.selectedText);
        }
      }
    });

    return unsubscribe;
  }, []);

  const handleSwitchWorkbenchTab = useCallback(
    (target: WorkbenchTabId) => {
      navigateToSpidarSurface(target, surfaceMode, (nextTab) => {
        setSurfaceMode(nextTab);
        setActiveWorkbenchTab(nextTab);
      });
    },
    [surfaceMode]
  );

  // Analyze contextual lines & phrases for the active tab
  const contextualLines = useMemo(() => {
    return analyzeContextualLines(activeParagraphs);
  }, [activeParagraphs]);

  // Ordered list of real word/phrase targets across ALL contextual lines without skipping paragraphs or repeating words
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
        // Guarantee every eligible line/paragraph is scanned even if no high-salience keyword matched
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

  const handleSaveApiConfig = useCallback((newConfig: ApiConfig) => {
    setApiConfig(newConfig);
    persistConfigEverywhere(newConfig);
  }, []);

  const handleSpiderSpeedChange = useCallback((newSpeed: number) => {
    const clamped = Math.round(Math.max(0.4, Math.min(3.0, newSpeed)) * 10) / 10;
    setApiConfig((prev) => {
      const next = { ...prev, spiderSpeed: clamped };
      persistConfigEverywhere(next);
      return next;
    });
  }, []);

  // Precision scan of nearby DOM phrase and word elements around a given (x, y) spider position
  const scanNearbyDomPhrases = useCallback((centerX: number, centerY: number) => {
    const container = articleScrollRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const candidateEls = Array.from(
      container.querySelectorAll('[data-spidar-phrase], [data-spidar-target-idx]')
    ) as HTMLElement[];

    const nearby: {
      el: HTMLElement;
      rect: DOMRect;
      scoreDist: number;
      dx: number;
      dy: number;
      text: string;
      style: 'cyan_box' | 'pink_highlight';
    }[] = [];

    candidateEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 8) return;
      if (rect.top < containerRect.top + 6 || rect.bottom > containerRect.bottom - 6) return;

      const elCenterX = rect.left + rect.width / 2;
      const elCenterY = rect.top + rect.height / 2;
      const dx = elCenterX - centerX;
      const dy = elCenterY - centerY;
      const rawDist = Math.hypot(dx, dy);

      if (Math.abs(dy) <= 135 && Math.abs(dx) <= 360 && rawDist <= 385) {
        const rawStyle = el.getAttribute('data-spidar-style');
        const style: 'cyan_box' | 'pink_highlight' =
          rawStyle === 'pink_highlight' ? 'pink_highlight' : 'cyan_box';
        const scoreDist = Math.hypot(dx * 0.65, dy * 1.45);
        nearby.push({
          el,
          rect,
          scoreDist,
          dx,
          dy,
          text: (el.textContent || '').trim(),
          style
        });
      }
    });

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
  }, []);

  // Summarize & explain a specific chunk when the user drags & drops the spider onto it
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
          activeTabObj.title,
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
    [activeParagraphs, activeTabObj.title, knowledgeBase.neurons, apiConfig]
  );

  // Finish crawl, return spider to corner dock, and synthesize summary + Second Brain neurons
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

      const fullText = getFullActiveTabText();
      const textToAnalyze =
        mode === 'visible'
          ? fullText.slice(0, Math.max(450, Math.floor(fullText.length * 0.55)))
          : fullText;

      setIsThinking(true);
      const summary = await generateAiSummary(
        textToAnalyze,
        activeTabObj.title,
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
      setIntelligenceInitialTab(openTab);
      setIntelligenceCardOpen(true);

      const updatedKb = {
        ...knowledgeBase,
        neurons: [...(knowledgeBase.neurons || [])],
        facts: [...knowledgeBase.facts],
        triplets: [...(knowledgeBase.triplets || [])],
        manuallyReadTabs: [...(knowledgeBase.manuallyReadTabs || [])]
      };
      updatedKb.totalTabsScanned += 1;
      ingestFullDocumentManualRead(
        updatedKb,
        activeTabObj.title,
        activeParagraphs,
        contextualLines
      );
      feedContextToBrain(updatedKb, summary.coreThesis, 'tab_crawl');
      setKnowledgeBase({ ...updatedKb });
    },
    [
      getFullActiveTabText,
      activeTabObj.title,
      apiConfig,
      contextualLines,
      touchedKeywordList,
      knowledgeBase,
      activeParagraphs
    ]
  );

  // Start Center-Locked Downward Crawl
  const startDownwardCrawl = useCallback(
    (mode: 'full-tab' | 'visible' = 'full-tab') => {
      setActiveWorkbenchTab('analyzer');
      setRadialMenuOpen(false);
      setIntelligenceCardOpen(false);
      setIsReturningToCorner(false);
      setTouchedKeywordList([]);
      setScannedLineIndices([]);
      setLiveLearnedTriplets([]);
      lastIngestedLineRef.current = -1;

      setTimeout(() => {
        if (articleScrollRef.current) {
          articleScrollRef.current.scrollTop = 0;
          const rect = articleScrollRef.current.getBoundingClientRect();
          const startPos = {
            x: rect.left + rect.width * 0.5,
            y: rect.top + rect.height * 0.25
          };
          spiderPosRef.current = startPos;
          setSpiderPos(startPos);
        }

        crawlElapsedRef.current = 0;
        const targetCount =
          mode === 'visible'
            ? Math.max(4, Math.ceil(wordTargetsMeta.length * 0.55))
            : Math.max(5, wordTargetsMeta.length);
        // Calibrate base duration so 1.0x crawls & scrolls briskly and scales linearly with spiderSpeed
        crawlDurationRef.current = Math.max(3800, Math.min(11000, targetCount * 380));

        setCrawlProgress(0);
        setCrawlPaused(false);
        setIsCrawling(true);
      }, 20);
    },
    [wordTargetsMeta.length]
  );

  // Scroll handler: when user scrolls manually, do NOT auto-select words or crawl
  const handleArticleScroll = useCallback(() => {
    if (isCrawling) {
      const curPos = spiderPosRef.current;
      scanNearbyDomPhrases(curPos.x, curPos.y);
    } else if (!draggingRef.current && nearbyHighlights.length > 0) {
      setNearbyHighlights([]);
    }
  }, [isCrawling, nearbyHighlights.length, scanNearbyDomPhrases]);

  // Smoothly walk the spider back to its resting corner after reading finishes
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      finishCrawlRef.current('full-tab');
    }
  }, []);

  // 60FPS Center-Locked Crawler Loop (Monotonic sequential target traversal + throttled DOM scanning)
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

      const container = articleScrollRef.current;
      const totalTargets = wordTargetsMeta.length;
      const syncedWalkStepPx = ((220 * spiderSpeed) * dtMs) / 1000;

      if (container && totalTargets > 0) {
        const floatTarget = progress * totalTargets;
        const rawIdx = Math.min(totalTargets - 1, Math.floor(floatTarget));
        if (rawIdx > highestTargetIdx) {
          highestTargetIdx = rawIdx;
        }
        const currentIdx = highestTargetIdx;
        const segmentFrac = floatTarget - Math.floor(floatTarget);

        const curMeta = wordTargetsMeta[currentIdx];
        const curEl = container.querySelector(
          `[data-spidar-target-idx="${currentIdx}"]`
        ) as HTMLElement | null;

        const containerRect = container.getBoundingClientRect();
        const columnCenterX = containerRect.left + containerRect.width * 0.5;
        const downwardCrawlY =
          containerRect.top + containerRect.height * (0.24 + progress * 0.52);

        // Simultaneously scroll at exact spiderSpeed while the spider crawls downward
        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
        const continuousScrollTop = progress * maxScroll;
        if (curEl && maxScroll > 0) {
          const elRect = curEl.getBoundingClientRect();
          const elOffsetInScroll =
            container.scrollTop + (elRect.top + elRect.height * 0.5 - downwardCrawlY);
          const blendedTargetScroll = Math.max(
            0,
            Math.min(maxScroll, continuousScrollTop * 0.62 + elOffsetInScroll * 0.38)
          );
          const catchupRate = Math.min(1, (dtMs / 16.67) * 0.44 * Math.max(0.85, spiderSpeed));
          const nextScrollTop =
            container.scrollTop + (blendedTargetScroll - container.scrollTop) * catchupRate;
          container.scrollTop = Math.max(continuousScrollTop * 0.9, nextScrollTop);
        } else if (maxScroll > 0) {
          container.scrollTop = continuousScrollTop;
        }

        const isWalkingPhase = segmentFrac < 0.2;
        const walkU = isWalkingPhase ? segmentFrac / 0.2 : 1;
        const smoothWalkU = walkU * walkU * (3 - 2 * walkU);
        const touchU = isWalkingPhase ? 0 : (segmentFrac - 0.2) / 0.8;

        let wordBiasX = 0;
        let wordBiasY = 0;
        if (curEl) {
          const liveCurRect = curEl.getBoundingClientRect();
          const targetWordCenterX = liveCurRect.left + liveCurRect.width / 2;
          const targetWordCenterY = liveCurRect.top + liveCurRect.height / 2;
          wordBiasX = Math.max(-36, Math.min(36, (targetWordCenterX - columnCenterX) * 0.26));
          wordBiasY = Math.max(-28, Math.min(28, (targetWordCenterY - downwardCrawlY) * 0.28));
        }

        const desiredX =
          columnCenterX +
          Math.sin(progress * Math.PI * 10) * 16 +
          wordBiasX * smoothWalkU;
        const desiredY = downwardCrawlY + wordBiasY * smoothWalkU;

        const prevPos = spiderPosRef.current;
        const dx = desiredX - prevPos.x;
        const dy = desiredY - prevPos.y;
        const maxStepX = Math.max(3.0, syncedWalkStepPx * 0.95);
        const maxStepY = Math.max(3.0, syncedWalkStepPx * 0.95);
        const nextX =
          Math.abs(dx) > maxStepX ? prevPos.x + Math.sign(dx) * maxStepX : desiredX;
        const nextY =
          Math.abs(dy) > maxStepY ? prevPos.y + Math.sign(dy) * maxStepY : desiredY;

        spiderPosRef.current = { x: nextX, y: nextY };
        setSpiderPos({ x: nextX, y: nextY });

        const walkHeadingTilt =
          Math.sin(progress * Math.PI * 14) * 4.2 +
          Math.max(-6, Math.min(6, dx * 0.08));
        setSpiderTilt(walkHeadingTilt);

        if (curMeta) {
          setActiveLineIndex(curMeta.lineIndex);
          setActiveLineContext(curMeta.lineContext);
        }

        // Scale DOM phrase scanning interval with spiderSpeed so phrases are selected simultaneously
        const scanIntervalMs = Math.max(24, Math.round(55 / Math.max(0.6, spiderSpeed)));
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
          setScannedLineIndices((prev) =>
            prev.includes(curMeta.lineIndex) ? prev : [...prev, curMeta.lineIndex]
          );

          if (lastIngestedLineRef.current !== curMeta.lineIndex) {
            lastIngestedLineRef.current = curMeta.lineIndex;
            setKnowledgeBase((prevKb) => {
              const nextKb = { ...prevKb };
              const { newTriplet } = ingestLineContextToBrain(nextKb, curMeta.lineContext);
              if (newTriplet) {
                setLiveLearnedTriplets((prevT) => [newTriplet, ...prevT.slice(0, 7)]);
              }
              return nextKb;
            });
          }
        } else {
          setIsTouchingKeyword(false);
          setActiveKeyword(null);
        }
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
  }, [isCrawling, crawlPaused, wordTargetsMeta, scanNearbyDomPhrases, spiderSpeed]);

  // Low-End Device Friendly Idle Animation: only animate when radial menu is open,
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

  // Direct AI Chat with Real-Time SSE Streaming & Selective Second Brain Trainer
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

    // Selective node creation: only create a node if the user explicitly teaches a durable entity/fact
    const isOrdinaryQuestion =
      cleanQ.endsWith('?') ||
      /^(what|why|how|who|where|when|which|explain|summarize|compare|can\s+you|could\s+you|tell\s+me)\b/i.test(
        cleanQ
      );

    const localTrained = !isOrdinaryQuestion
      ? trainSpidarFromChatTurn(updatedKb, cleanQ, chatMessages, null)
      : { trainedNeuron: null, newFact: null, iqGain: 0 };
    setKnowledgeBase({ ...updatedKb });

    const fullText = getFullActiveTabText();
    const isTabManuallyRead = (updatedKb.manuallyReadTabs || []).includes(activeTabObj.title);

    const response = await askAiQuestion(
      cleanQ,
      fullText,
      updatedKb.facts,
      apiConfig,
      {
        articleTitle: activeTabObj.title,
        selectedText: selectedWebText,
        uploadedDocs,
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

  const handleClearChatKeepBrain = useCallback(() => {
    setChatMessages([]);
  }, []);

  // Uploaded Document handlers
  const handleAddUploadedDoc = useCallback(
    (doc: Omit<UploadedDocument, 'id' | 'addedAt' | 'wordCount'>) => {
      const words = doc.content.trim().split(/\s+/).filter(Boolean).length;
      const newDoc: UploadedDocument = {
        ...doc,
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        wordCount: words,
        addedAt: Date.now()
      };
      setUploadedDocs((prev) => [newDoc, ...prev]);
    },
    []
  );

  const handleRemoveUploadedDoc = useCallback((docId: string) => {
    setUploadedDocs((prev) => prev.filter((d) => d.id !== docId));
  }, []);

  // Second Brain Vault & Editable Graph handlers
  const handleAddMemoryFact = (factText: string) => {
    const updatedKb = { ...knowledgeBase };
    feedContextToBrain(updatedKb, factText, 'user_prompt');
    setKnowledgeBase({ ...updatedKb });
  };

  const handleAddNeuron = (chunkText: string, customTitle?: string) => {
    const prevCount = (knowledgeBase.neurons || []).length;
    const updatedKb = {
      ...knowledgeBase,
      neurons: [...(knowledgeBase.neurons || [])]
    };
    const neuron = ingestChunkAsNeuron(updatedKb, chunkText, activeTabObj.title, customTitle);
    const nextCount = (updatedKb.neurons || []).length;
    setKnowledgeBase({ ...updatedKb });
    if (neuron) {
      if (nextCount === prevCount) {
        setGraphNotice(
          `Duplicate detected: Merged into existing node [[${neuron.title}]] (Strength ${neuron.strength}x).`
        );
      } else {
        setGraphNotice(`Added new node [[${neuron.title}]] and connected to related knowledge.`);
      }
      setTimeout(() => setGraphNotice(null), 4000);
    }
  };

  const handleUpdateNeuron = useCallback(
    (
      neuronId: string,
      updates: Partial<
        Pick<
          MemoryNeuron,
          'title' | 'distilledInsight' | 'chunkText' | 'category' | 'keyPhrases'
        >
      >
    ) => {
      const updatedKb = {
        ...knowledgeBase,
        neurons: [...(knowledgeBase.neurons || [])]
      };
      updateMemoryNeuron(updatedKb, neuronId, updates);
      setKnowledgeBase({ ...updatedKb });
    },
    [knowledgeBase]
  );

  const handleConnectNeurons = useCallback(
    (sourceId: string, targetId: string, relation: NeuronRelationType) => {
      const updatedKb = {
        ...knowledgeBase,
        neurons: [...(knowledgeBase.neurons || [])]
      };
      connectNeuronsWithRelation(updatedKb, sourceId, targetId, relation);
      setKnowledgeBase({ ...updatedKb });
    },
    [knowledgeBase]
  );

  const handleRemoveConnection = useCallback(
    (sourceId: string, targetId: string) => {
      const updatedKb = {
        ...knowledgeBase,
        neurons: [...(knowledgeBase.neurons || [])]
      };
      removeNeuronConnection(updatedKb, sourceId, targetId);
      setKnowledgeBase({ ...updatedKb });
    },
    [knowledgeBase]
  );

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

  // Drag Spider onto any Specific Chunk of Text to Summarise & Explain It
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

  const activeCrawlingAnimation = isCrawling || isReturningToCorner;
  const currentJoints = computeSpiderLegJoints({
    phase: legPhase,
    isCrawling: activeCrawlingAnimation,
    isTouchingKeyword,
    touchProgress: legTouchProgress,
    downwardProgress: crawlProgress,
    legReachVectors
  });

  const activeScannedTextSet = useMemo(() => {
    if (!isCrawling && !isDraggingSpider) return new Set<string>();
    return new Set(nearbyHighlights.map((h) => h.text.trim().toLowerCase()));
  }, [isCrawling, isDraggingSpider, nearbyHighlights]);

  const renderContextualLineTokens = (line: ContextualLine) => {
    const targetEntriesForLine = wordTargetsMeta.filter((m) => m.lineIndex === line.lineIndex);
    const phrasesForLine = line.phrases || [];
    const searchLower = relatedSearchQuery.trim().toLowerCase();

    const kwMap = new Map<string, { targetIdx: number; style: 'cyan_box' | 'pink_highlight' }>();
    targetEntriesForLine.forEach((entry, idx) => {
      kwMap.set(entry.word.toLowerCase(), {
        targetIdx: entry.targetIdx,
        style: idx % 2 === 0 ? 'cyan_box' : 'pink_highlight'
      });
    });

    const phraseMap = new Map<string, 'cyan_box' | 'pink_highlight'>();
    phrasesForLine.forEach((p) => {
      phraseMap.set(p.phrase.toLowerCase(), p.style);
    });

    const allPatterns = [
      ...Array.from(phraseMap.keys()),
      ...Array.from(kwMap.keys())
    ]
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    if (allPatterns.length === 0) {
      return <span>{line.text}</span>;
    }

    const regex = new RegExp(`(${allPatterns.join('|')})`, 'gi');
    const parts = line.text.split(regex);
    const assignedTargets = new Set<number>();

    return parts.map((part, idx) => {
      const lower = part.toLowerCase();
      const kwEntry = kwMap.get(lower);
      const phraseStyle = phraseMap.get(lower);
      const matchesSearch = searchLower.length >= 2 && lower.includes(searchLower);
      const isActivelyScanned = activeScannedTextSet.has(lower);

      if (kwEntry && !assignedTargets.has(kwEntry.targetIdx)) {
        assignedTargets.add(kwEntry.targetIdx);
        const isCurrentlyTouched =
          isCrawling &&
          isTouchingKeyword &&
          activeLineIndex === line.lineIndex &&
          activeKeyword?.word.toLowerCase() === lower;
        const style = kwEntry.style;

        return (
          <span
            key={idx}
            data-spidar-target-idx={kwEntry.targetIdx}
            data-spidar-word={lower}
            data-spidar-style={style}
            className={`inline-block px-1 py-0.2 rounded font-medium ${
              isCurrentlyTouched || isActivelyScanned || matchesSearch
                ? style === 'pink_highlight'
                  ? 'bg-pink-500/40 text-white border border-pink-300 shadow-[0_0_12px_rgba(244,114,182,0.45)]'
                  : 'bg-sky-500/20 text-sky-100 border-[1.5px] border-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.4)]'
                : 'text-slate-100'
            }`}
          >
            {part}
          </span>
        );
      }

      if (phraseStyle) {
        return (
          <span
            key={idx}
            data-spidar-phrase={lower}
            data-spidar-style={phraseStyle}
            className={`inline-block px-1 py-0.2 rounded ${
              isActivelyScanned || matchesSearch
                ? phraseStyle === 'pink_highlight'
                  ? 'bg-pink-500/35 text-pink-100 border border-pink-400/85 shadow-[0_0_12px_rgba(244,114,182,0.3)]'
                  : 'bg-sky-500/15 text-sky-100 border-[1.5px] border-sky-300/90 shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                : 'text-slate-200'
            }`}
          >
            {part}
          </span>
        );
      }

      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  // Standalone Chrome Extension Toolbar Popup Mode (popup.html or index.html?view=popup)
  if (surfaceMode === 'popup') {
    return (
      <div className="w-full min-w-[360px] min-h-screen bg-[#090d15] text-slate-100 overflow-x-hidden flex items-start justify-center">
        <ExtensionPopupSurface
          apiConfig={apiConfig}
          neuronCount={(knowledgeBase.neurons || []).length}
          isStandalonePopup={true}
          onTriggerTabCrawl={async () => {
            const dispatched = await triggerActiveChromeTabCrawl(spiderSpeed, 'full-tab');
            if (dispatched) {
              window.close();
            } else {
              setSurfaceMode('analyzer');
              setActiveWorkbenchTab('analyzer');
              syncUrlSurfaceMode('analyzer');
              startDownwardCrawl('full-tab');
            }
          }}
          onSpiderSpeedChange={handleSpiderSpeedChange}
          onNavigateSurface={(target) => handleSwitchWorkbenchTab(target)}
        />
      </div>
    );
  }

  return (
    <div
      data-spidar-workbench="true"
      className="min-h-screen bg-[#06090f] text-slate-100 flex flex-col selection:bg-sky-500/30 selection:text-sky-200 overflow-x-hidden"
      data-state={isCrawling ? 'crawling' : intelligenceCardOpen ? 'analyzed' : 'ready'}
    >
      {/* Top Global Command Bar with Lightweight Responsive Tabs */}
      <header className="sticky top-0 z-30 bg-[#080c14]/95 backdrop-blur-xl border-b border-slate-800/80 px-4 lg:px-8 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 border border-slate-800">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold tracking-tight text-white">
                    SPIDAR <span className="text-slate-400 font-mono text-xs">v2.7</span>
                  </h1>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-sky-300 border border-slate-800">
                    {(knowledgeBase.neurons || []).length} Neurons
                  </span>
                </div>
                {!minimalistMode && (
                  <p className="text-[11px] text-slate-400 hidden sm:block">
                    Center-Walk Phrase Crawler • Second Brain Neural Graph • Multi-Provider AI
                  </p>
                )}
              </div>
            </div>

            {/* Primary Navigation Tabs */}
            <nav
              aria-label="Primary Workspace Views"
              className="flex flex-wrap items-center p-1 rounded-xl bg-[#0c111d] border border-slate-800/90 text-xs"
            >
              <button
                type="button"
                onClick={() => handleSwitchWorkbenchTab('analyzer')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  activeWorkbenchTab === 'analyzer'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                <span>Web Analyzer</span>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchWorkbenchTab('outline-studio')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  activeWorkbenchTab === 'outline-studio'
                    ? 'bg-slate-800 text-sky-200 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <PenTool className="w-3.5 h-3.5 text-sky-400" />
                <span>Outline &amp; Writing</span>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchWorkbenchTab('neural-graph')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  activeWorkbenchTab === 'neural-graph'
                    ? 'bg-slate-800 text-purple-200 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Network className="w-3.5 h-3.5 text-purple-400" />
                <span>Neural Graph ({(knowledgeBase.neurons || []).length})</span>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchWorkbenchTab('extension-options')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  activeWorkbenchTab === 'extension-options'
                    ? 'bg-slate-800 text-emerald-200 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span>Extension Options</span>
              </button>
            </nav>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => startDownwardCrawl('full-tab')}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-white text-slate-950 text-xs font-bold transition-all cursor-pointer"
            >
              <ArrowDownCircle className="w-3.5 h-3.5" />
              <span>Analyse Tab (Auto-Scroll)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIntelligenceInitialTab('qa');
                setIntelligenceCardOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sky-300 text-xs font-medium transition-colors cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5 text-sky-400" />
              <span>AI Q&amp;A</span>
            </button>

            <button
              type="button"
              onClick={() => downloadExtractedBrainFile(knowledgeBase, 'json')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 text-xs font-semibold transition-colors cursor-pointer"
              title="Extract & Download SPIDAR's Second Brain for other AI projects"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Extract Brain</span>
            </button>

            <button
              type="button"
              onClick={() => setExtStudioOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Extension Popup &amp; ZIP</span>
            </button>

            <button
              type="button"
              onClick={() => setMinimalistMode((m) => !m)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs font-medium transition-colors cursor-pointer"
              aria-label="Toggle Minimalist View"
            >
              {minimalistMode ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area by Active Workbench Tab */}
      {activeWorkbenchTab === 'extension-options' ? (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">
                Chrome Extension Options Page (options.html)
              </div>
              <h2 className="text-lg font-bold text-white">
                SPIDAR Extension Settings &amp; Multi-Provider API Configuration
              </h2>
              <p className="text-xs text-slate-400">
                Configure Qwen (Free Cloud Inference), Gemini, OpenAI, Anthropic, OpenRouter, Qwen Local, or custom OpenAI-compatible endpoints.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveWorkbenchTab('analyzer')}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-200 cursor-pointer"
            >
              ← Back to Web Analyzer
            </button>
          </div>

          <ExtensionOptionsPanel
            config={apiConfig}
            onSaveConfig={handleSaveApiConfig}
            isEmbeddedPage={true}
          />
        </main>
      ) : activeWorkbenchTab === 'outline-studio' ? (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-sky-400">
                Advanced Academic &amp; Research Outlining Engine
              </div>
              <h2 className="text-lg font-bold text-white">
                Outline &amp; Writing Studio (Rubric Analysis, Hierarchical Claims, Evidence &amp; Drafts)
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveWorkbenchTab('analyzer')}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-200 cursor-pointer"
            >
              ← Back to Web Analyzer
            </button>
          </div>

          <OutlineStudioPanel
            apiConfig={apiConfig}
            knowledgeBase={knowledgeBase}
            webpageTitle={activeTabObj.title}
            webpageText={getFullActiveTabText()}
            selectedText={selectedWebText}
            uploadedDocs={uploadedDocs}
            onAddUploadedDoc={handleAddUploadedDoc}
            onRemoveUploadedDoc={handleRemoveUploadedDoc}
            onSaveInsightToGraph={(text, title) => handleAddNeuron(text, title)}
          />
        </main>
      ) : activeWorkbenchTab === 'neural-graph' ? (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-purple-400">
                Persistent Second Brain Architecture
              </div>
              <h2 className="text-lg font-bold text-white">
                Interactive Neural Graph ({(knowledgeBase.neurons || []).length} Neurons •{' '}
                {knowledgeBase.facts.length} Facts)
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newNeuronInput}
                  onChange={(e) => setNewNeuronInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newNeuronInput.trim()) {
                      handleAddNeuron(newNeuronInput.trim());
                      setNewNeuronInput('');
                    }
                  }}
                  placeholder="Add a new concept or entity neuron..."
                  className="w-64 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-purple-400 focus:outline-none text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newNeuronInput.trim()) return;
                    handleAddNeuron(newNeuronInput.trim());
                    setNewNeuronInput('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer"
                >
                  + Add Neuron
                </button>
              </div>
              <button
                type="button"
                onClick={() => setVaultModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-medium cursor-pointer"
              >
                Vault Inspector &amp; Export
              </button>
            </div>
          </div>

          {graphNotice && (
            <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-400/40 text-xs text-purple-200 flex items-center justify-between">
              <span>{graphNotice}</span>
              <button
                type="button"
                onClick={() => setGraphNotice(null)}
                className="text-[11px] font-mono underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          <NeuralBrainGraph
            knowledgeBase={knowledgeBase}
            compact={false}
            onDeleteNeuron={handleDeleteNeuron}
            onUpdateNeuron={handleUpdateNeuron}
            onConnectNeurons={handleConnectNeurons}
            onRemoveConnection={handleRemoveConnection}
            onAskAboutNeuron={(neuron) => {
              setIntelligenceInitialTab('qa');
              setIntelligenceCardOpen(true);
              handleSendMessage(
                `Provide a detailed explanation of the "${neuron.title}" neuron in my Second Brain.`
              );
            }}
          />
        </main>
      ) : (
        /* Default View: Web Analyzer Workbench Grid */
        <main
          className={`flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-5 grid grid-cols-1 ${
            minimalistMode ? 'lg:grid-cols-1 max-w-4xl' : 'lg:grid-cols-12'
          } gap-6`}
        >
          {/* Simulated Browser Tab Viewport */}
          <section
            className={`${
              minimalistMode ? 'col-span-1' : 'lg:col-span-8'
            } flex flex-col bg-[#090d15] border border-slate-800/90 rounded-2xl shadow-xl overflow-hidden`}
          >
            {/* Browser Tab Strip */}
            <div className="bg-[#06090f] px-3 pt-2 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto">
              {availableBrowserTabs.map((tab) => {
                const active = tab.id === activeBrowserTabId;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveBrowserTabId(tab.id);
                      setTouchedKeywordList([]);
                      setScannedLineIndices([]);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-t-lg text-xs font-medium border-t border-x transition-all shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#090d15] text-white border-slate-800'
                        : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
                    }`}
                  >
                    <Globe className={`w-3.5 h-3.5 ${active ? 'text-sky-400' : 'text-slate-600'}`} />
                    <span className="max-w-[200px] truncate">{tab.title}</span>
                  </button>
                );
              })}
            </div>

            {/* Search & Phrase Scanner Bar */}
            <div className="bg-[#080c13] px-4 py-2.5 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[230px] max-w-md">
                <input
                  type="text"
                  value={relatedSearchQuery}
                  onChange={(e) => setRelatedSearchQuery(e.target.value)}
                  placeholder="Find related content, phrases, or concepts..."
                  aria-label="Find related content"
                  className="w-full pl-3.5 pr-9 py-1.5 rounded-lg bg-[#05070c] border border-slate-700/80 focus:border-sky-400 focus:outline-none text-xs text-slate-100 placeholder-slate-400"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                  Drag spider onto any paragraph to explain it
                </span>
                <button
                  type="button"
                  onClick={() => startDownwardCrawl('visible')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>Crawl Visible</span>
                </button>
                <button
                  type="button"
                  onClick={() => startDownwardCrawl('full-tab')}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-white text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <ArrowDownCircle className="w-3.5 h-3.5" />
                  <span>Center-Walk Crawl</span>
                </button>
              </div>
            </div>

            {/* Scrollable Tab Viewport with Text Selection Detection */}
            <div
              ref={articleScrollRef}
              onScroll={handleArticleScroll}
              onMouseUp={() => {
                const sel = window.getSelection()?.toString().trim() || '';
                if (sel.length >= 10) {
                  setSelectedWebText(sel);
                }
              }}
              className="p-6 md:p-8 space-y-5 max-h-[540px] overflow-y-auto relative"
            >
              {selectedWebText && (
                <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-400/40 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 truncate max-w-md">
                    <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-sky-500/20 text-sky-200 font-semibold">
                      Selected Context
                    </span>
                    <span className="text-slate-200 truncate">&ldquo;{selectedWebText}&rdquo;</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIntelligenceInitialTab('qa');
                        setIntelligenceCardOpen(true);
                        handleSendMessage(`Explain this selected passage in detail: "${selectedWebText.slice(0, 220)}"`);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-[11px] cursor-pointer"
                    >
                      Ask AI
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveWorkbenchTab('outline-studio')}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-200 text-[11px] cursor-pointer"
                    >
                      Use in Outline
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddNeuron(selectedWebText)}
                      className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-[11px] cursor-pointer"
                    >
                      + Graph Node
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedWebText('')}
                      className="px-2 py-1 text-slate-400 hover:text-white text-[11px] cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800/80">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[10.5px] font-mono uppercase tracking-wider text-sky-400">
                    <span>{activeTabObj.category}</span>
                    <span>•</span>
                    <span>
                      {contextualLines.filter((l) => l.hasHighContext).length} Context Lines &amp; Phrases Mapped
                    </span>
                  </div>
                  <h2 className="text-lg md:text-xl font-bold text-white leading-snug">
                    {activeTabObj.title}
                  </h2>
                </div>

                {touchedKeywordList.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-[11px] text-sky-300 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                    <span>
                      {touchedKeywordList.length} Phrases Scanned • {scannedLineIndices.length} Lines Read
                    </span>
                  </div>
                )}
              </div>

              {activeBrowserTabId === 'tab-custom-sandbox' && (
                <div className="space-y-2 pb-2">
                  <label
                    htmlFor="custom-sandbox-textarea"
                    className="block text-xs font-medium text-slate-400"
                  >
                    Edit or paste custom article text below:
                  </label>
                  <textarea
                    id="custom-sandbox-textarea"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    rows={4}
                    aria-label="Custom webpage text to analyze"
                    className="w-full p-3 rounded-xl bg-[#06090f] border border-slate-800 focus:border-sky-500 focus:outline-none text-xs text-slate-200 leading-relaxed font-sans"
                  />
                </div>
              )}

              {/* Paragraph Chunks */}
              <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
                {activeParagraphs.map((_, pIdx) => {
                  const linesInPara = contextualLines.filter((l) => l.paragraphIndex === pIdx);
                  const isChunkHoveredBySpider = isDraggingSpider && hoveredChunkIndex === pIdx;
                  const isChunkSelected = selectedChunkExplanation?.chunkIndex === pIdx;

                  return (
                    <div
                      key={pIdx}
                      data-spidar-chunk-idx={pIdx}
                      className={`p-4 rounded-xl transition-all duration-150 space-y-2 relative ${
                        isChunkHoveredBySpider
                          ? 'bg-pink-500/15 border-2 border-pink-400 shadow-[0_0_25px_rgba(244,114,182,0.25)]'
                          : isChunkSelected
                          ? 'bg-[#0b1220] border border-sky-500/60'
                          : 'bg-[#070a11] border border-slate-800/75 hover:border-slate-700/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 pb-1">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                          Chunk #{pIdx + 1}
                        </span>
                        {isChunkHoveredBySpider ? (
                          <span className="text-[10.5px] font-mono font-bold text-pink-300 animate-pulse">
                            Release Spider to Summarise &amp; Explain Chunk #{pIdx + 1}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleExplainDroppedChunk(pIdx)}
                            className="text-[10px] font-mono text-sky-400/80 hover:text-sky-300 transition-colors cursor-pointer"
                          >
                            Explain &amp; Save Neuron →
                          </button>
                        )}
                      </div>

                      {linesInPara.map((line) => {
                        const isLineActive = isCrawling && activeLineIndex === line.lineIndex;
                        const isLineScanned = scannedLineIndices.includes(line.lineIndex);

                        return (
                          <div
                            key={line.lineIndex}
                            data-spidar-line={line.lineIndex}
                            className={`relative pl-3 py-1 rounded-lg transition-all duration-150 border-l-2 ${
                              isLineActive
                                ? 'border-l-sky-400 bg-sky-500/10 text-white'
                                : isLineScanned
                                ? 'border-l-pink-400/60 bg-slate-900/40 text-slate-200'
                                : line.hasHighContext
                                ? 'border-l-slate-700'
                                : 'border-l-transparent text-slate-400'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                                L{line.lineIndex + 1} • {line.contextType.replace('_', ' ')}
                              </span>
                              {isLineActive && (
                                <span className="text-[10px] font-mono text-sky-300 font-semibold">
                                  ← Spider Scanning Nearby Phrases
                                </span>
                              )}
                            </div>
                            <p className="leading-relaxed">{renderContextualLineTokens(line)}</p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              <div className="h-44" />
            </div>
          </section>

          {/* Right 4 Columns: Shared Quick-Access Extension Popup & Redesigned Neural Graph */}
          {!minimalistMode && (
            <aside className="lg:col-span-4 space-y-4">
              {/* Card 1: Shared Single-Source-of-Truth Extension Popup */}
              <ExtensionPopupSurface
                apiConfig={apiConfig}
                neuronCount={(knowledgeBase.neurons || []).length}
                zipDownloading={zipDownloading}
                onTriggerTabCrawl={() => startDownwardCrawl('full-tab')}
                onSpiderSpeedChange={handleSpiderSpeedChange}
                onNavigateSurface={(target) => handleSwitchWorkbenchTab(target)}
                onDownloadZip={async () => {
                  setZipDownloading(true);
                  try {
                    await generateAndDownloadExtensionZip();
                  } finally {
                    setZipDownloading(false);
                  }
                }}
                onOpenSourceInspector={() => setExtStudioOpen(true)}
              />

              {/* Card 2: Interactive Second Brain Neural Graph */}
              <div className="p-4 rounded-2xl bg-[#090d15] border border-slate-800/90 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                    <Network className="w-3.5 h-3.5 text-purple-400" />
                    <span>Second Brain Neural Graph</span>
                  </h3>
                  <span className="text-[10.5px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    {(knowledgeBase.neurons || []).length} Neurons
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Interconnected neural graph that retains manually crawled pages and entity contexts independently of chat history:
                </p>

                <NeuralBrainGraph
                  knowledgeBase={knowledgeBase}
                  compact={true}
                  onDeleteNeuron={handleDeleteNeuron}
                  onAskAboutNeuron={(neuron) => {
                    setIntelligenceInitialTab('qa');
                    setIntelligenceCardOpen(true);
                    handleSendMessage(
                      `Provide a detailed explanation of the "${neuron.title}" neuron in my Second Brain.`
                    );
                  }}
                />

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveWorkbenchTab('neural-graph')}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-purple-200 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-purple-400" />
                    <span>Expand Graph</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVaultModalOpen(true)}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Vault &amp; Export</span>
                  </button>
                </div>
              </div>
            </aside>
          )}
        </main>
      )}

      {/* Shared SPIDAR Companion Overlay (Identical across AI Studio Preview & Chrome Extension Content Script) */}
      <SpidarCompanionOverlay
        showSpiderActor={activeWorkbenchTab === 'analyzer'}
        showHighlightBoxes={false}
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
        onClearChat={handleClearChatKeepBrain}
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
        onAskAboutNeuron={(neuron) => {
          setIntelligenceInitialTab('qa');
          setIntelligenceCardOpen(true);
          handleSendMessage(
            `Provide a detailed explanation of the "${neuron.title}" neuron in my Second Brain.`
          );
        }}
        onOpenFullStudio={(view) => handleSwitchWorkbenchTab(view || 'analyzer')}
      />

      <ApiConfigModal
        isOpen={apiModalOpen}
        onClose={() => setApiModalOpen(false)}
        config={apiConfig}
        onSaveConfig={handleSaveApiConfig}
      />

      <ExtensionStudioModal
        isOpen={extStudioOpen}
        onClose={() => setExtStudioOpen(false)}
        apiConfig={apiConfig}
        onUpdateApiConfig={handleSaveApiConfig}
        onTriggerTabCrawl={() => startDownwardCrawl('full-tab')}
        onOpenExtensionOptions={() => handleSwitchWorkbenchTab('extension-options')}
        onNavigateSurface={handleSwitchWorkbenchTab}
        factCount={(knowledgeBase.neurons || []).length}
      />
    </div>
  );
}
