/**
 * SPIDAR v2.7 - Core Types
 * Long-Legged Biomimetic Crawler, Multi-Phrase Scanner, Second Brain Neural Graph & Cline-Style Multi-Provider AI
 */

export interface SpiderLegJoints {
  kx: string;
  ky: string;
  ax: string;
  ay: string;
  fx: string;
  fy: string;
  isTouchingWord?: boolean;
  targetWord?: string;
  highlightStyle?: 'cyan_box' | 'pink_highlight' | 'amber_touch';
}

export interface LegDefinition {
  id: string;
  side: number; // -1 for left, 1 for right
  index: number; // 0..3
  group: number; // 0 or 1 for alternating gait
  hip: { x: number; y: number };
  knee: { x: number; y: number };
  ankle: { x: number; y: number };
  foot: { x: number; y: number };
}

export interface DetectedPhrase {
  id: string;
  phrase: string;
  lineIndex: number;
  paragraphIndex: number;
  style: 'cyan_box' | 'pink_highlight';
  category: 'thesis_phrase' | 'metric_phrase' | 'mechanism_phrase' | 'entity_phrase';
  score: number;
}

export interface SalientKeyword {
  word: string;
  score: number;
  rect?: { left: number; top: number; width: number; height: number };
  paragraphIndex?: number;
  lineIndex?: number;
  contextSentence?: string;
  contextType?: 'thesis' | 'metric_evidence' | 'mechanism' | 'conclusion' | 'general';
  category?: 'metric' | 'concept' | 'entity' | 'action';
  highlightStyle?: 'cyan_box' | 'pink_highlight';
}

export interface KnowledgeTriplet {
  subject: string;
  relation: string;
  object: string;
  lineNumber: number;
  confidence: number;
}

export interface ContextualLine {
  lineIndex: number;
  paragraphIndex: number;
  text: string;
  hasHighContext: boolean;
  contextType: 'thesis' | 'metric_evidence' | 'mechanism' | 'conclusion' | 'general';
  contextReason: string;
  keywords: SalientKeyword[];
  phrases?: DetectedPhrase[];
  triplet?: KnowledgeTriplet;
}

export interface DomWordTarget {
  id: string;
  word: string;
  lineIndex: number;
  paragraphIndex: number;
  lineText: string;
  contextType: ContextualLine['contextType'];
  contextReason: string;
  offsetTop: number;
  offsetLeft: number;
  width: number;
  height: number;
  highlightStyle?: 'cyan_box' | 'pink_highlight';
  secondaryWordOffset?: { dx: number; dy: number; word: string };
}

export interface LegTargetVector {
  legId?: string;
  dx: number;
  dy: number;
  phrase?: string;
  style?: 'cyan_box' | 'pink_highlight';
}

export interface DownwardCrawlWaypoint {
  x: number;
  y: number;
  progress: number;
  milestoneType: 'crawl' | 'touch_keyword' | 'scan_heading' | 'page_scroll';
  keyword?: SalientKeyword;
  lineIndex?: number;
  lineContext?: ContextualLine;
  targetScrollTop?: number;
  legReachVectors?: {
    leftFrontDx: number;
    leftFrontDy: number;
    rightFrontDx: number;
    rightFrontDy: number;
    leftMidDx?: number;
    leftMidDy?: number;
    rightMidDx?: number;
    rightMidDy?: number;
    multiLegTargets?: LegTargetVector[];
  };
  targetLegs?: {
    leftFoot: { x: number; y: number };
    rightFoot: { x: number; y: number };
  };
}

export interface CrawlEngineState {
  x: number;
  y: number;
  tiltDeg: number;
  progress: number; // 0 to 1
  isComplete: boolean;
  activeKeyword: SalientKeyword | null;
  activeLineIndex: number | null;
  activeLineContext: ContextualLine | null;
  isTouchingKeyword: boolean;
  legTouchProgress: number; // 0 to 1 during touch
  legReachVectors?: DownwardCrawlWaypoint['legReachVectors'];
  currentScrollY: number;
  targetScrollY: number;
}

export interface WebSummaryResult {
  title: string;
  coreThesis: string;
  executiveBullets: string[];
  keyInsights: string[];
  touchedKeywords: SalientKeyword[];
  contextualLines?: ContextualLine[];
  learnedTriplets?: KnowledgeTriplet[];
  actionItems: string[];
  metrics: {
    wordCount: number;
    compressionRatio: number;
    keywordsAnalyzed: number;
    readTimeReduction: string;
    contextLinesIdentified?: number;
  };
  generatedBy: string;
}

export interface ChunkExplanationResult {
  chunkIndex: number;
  chunkText: string;
  naturalSummary: string;
  plainExplanation: string;
  whyItMatters: string;
  keyPhrases: string[];
  neuronId?: string;
}

export type NeuronCategory =
  | 'manual_deep_read'
  | 'entity_context'
  | 'qwen_synthesis'
  | 'core_architecture';

export type NeuronRelationType =
  | 'supports'
  | 'contradicts'
  | 'extends'
  | 'part_of'
  | 'evidence_for'
  | 'related_to';

export interface NeuronSynapseEdge {
  targetId: string;
  relation: NeuronRelationType;
  weight: number;
  note?: string;
}

/**
 * Second Brain Memory Neuron: stores a digested chunk of data, its natural insight,
 * key phrases, and typed synaptic connections to other neurons in the Neural Graph.
 */
export interface MemoryNeuron {
  id: string;
  title: string;
  chunkText: string;
  distilledInsight: string;
  keyPhrases: string[];
  synapses: string[]; // connected neuron IDs or titles
  synapseEdges?: NeuronSynapseEdge[]; // typed relationship edges
  strength: number; // 1.0 to 5.0 synaptic weight
  sourceTab: string;
  timestamp: number;
  category?: NeuronCategory;
  retentionDepth?: number; // e.g. 98 for manual spider deep-read
  fullSentences?: string[];
  metrics?: string[];
}

export interface MemoryFact {
  id: string;
  content: string;
  category: 'preference' | 'domain_knowledge' | 'correction' | 'user_note' | 'article_triplet';
  confidence: number;
  timestamp: number;
  source: 'user_prompt' | 'tab_crawl' | 'conversation';
}

export interface ConceptNode {
  term: string;
  frequency: number;
  weight: number;
  associatedTerms: string[];
  lastSeen: number;
}

export interface UploadedDocument {
  id: string;
  title: string;
  content: string;
  docType: 'assignment' | 'rubric' | 'source' | 'notes';
  wordCount: number;
  addedAt: number;
}

export type OutlineDocumentType =
  | 'essay'
  | 'research_paper'
  | 'assignment'
  | 'presentation'
  | 'project_plan';

export interface OutlineSectionItem {
  id: string;
  heading: string;
  level: 1 | 2 | 3;
  coreArgument: string;
  supportingEvidence: string[];
  explanation: string;
  counterargument?: string;
  sourceCitations: string[];
  draftContent?: string;
}

export interface StructuredOutline {
  id: string;
  title: string;
  documentType: OutlineDocumentType;
  assignmentAnalysis: {
    coreObjective: string;
    keyRequirements: string[];
    rubricPriorities: string[];
    toneAndAudience: string;
  };
  thesisStatement: string;
  argumentArchitecture: string;
  sections: OutlineSectionItem[];
  fullDraft?: string;
  modelUsed: string;
  updatedAt: number;
}

export interface NeuralKnowledgeBase {
  version: string;
  appletId: string;
  createdAt: number;
  updatedAt: number;
  learningLevel: number;
  comprehensionIq: number;
  totalConversations: number;
  totalTabsScanned: number;
  totalLinesAnalyzed: number;
  neurons: MemoryNeuron[];
  facts: MemoryFact[];
  triplets: KnowledgeTriplet[];
  concepts: Record<string, ConceptNode>;
  userPreferences: Record<string, string>;
  learnedVocabulary: Record<string, number>;
  manuallyReadTabs?: string[];
}

export type AiProviderId =
  | 'qwen-free'
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'openrouter'
  | 'qwen-local'
  | 'openai-compatible'
  | 'local';

export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface CustomHeader {
  id: string;
  key: string;
  value: string;
}

export interface ModelCapabilityInfo {
  id: string;
  name: string;
  provider: AiProviderId;
  contextWindow: number; // e.g. 128000, 200000, 1000000
  maxOutputTokens: number;
  supportsStreaming: boolean;
  supportsReasoning: boolean;
  supportsVision: boolean;
  inputPricePerMillion?: number; // USD per 1M tokens
  outputPricePerMillion?: number; // USD per 1M tokens
  description?: string;
}

export interface ProviderProfileConfig {
  provider: AiProviderId;
  baseUrl: string;
  apiKey: string;
  selectedModel: string;
  availableModels: string[];
  customHeaders: CustomHeader[];
  setAzureApiVersion: boolean;
  azureApiVersion: string;
  useAzureIdentityAuth: boolean;
  reasoningEffort: ReasoningEffort;
  temperature: number;
  maxTokens: number;
  streamingEnabled: boolean;
}

export interface ApiConfig {
  provider: AiProviderId;
  baseUrl: string;
  apiKey: string;
  selectedModel: string;
  availableModels: string[];
  temperature: number;
  maxTokens: number;
  spiderSpeed?: number; // 0.4x to 3.0x multiplier (default 1.0)
  customHeaders?: CustomHeader[];
  setAzureApiVersion?: boolean;
  azureApiVersion?: string;
  useAzureIdentityAuth?: boolean;
  reasoningEffort?: ReasoningEffort;
  streamingEnabled?: boolean;
}

export interface ConnectionTestResult {
  ok: boolean;
  status: 'connected' | 'invalid_key' | 'rate_limit' | 'model_unavailable' | 'connection_error';
  message: string;
  latencyMs?: number;
  discoveredModels?: string[];
  modelVerified?: string;
}

export interface WebSearchCitation {
  title: string;
  url: string;
  snippet: string;
  sourceType?: 'google_search' | 'web_page' | 'academic' | 'active_tab';
}

export interface TrainedNeuronSummary {
  id?: string;
  title: string;
  insight: string;
  keyPhrases: string[];
  iqGain?: number;
  wasMerged?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  usedMemoryFacts?: string[];
  activatedNeurons?: string[];
  citedLines?: number[];
  webSources?: WebSearchCitation[];
  modelUsed?: string;
  cognitiveMode?: 'manual_deep_read' | 'qwen_direct' | 'second_brain_recall' | 'context_clarification';
  trainedNeuron?: TrainedNeuronSummary;
  isStreaming?: boolean;
  errorState?: string;
}

export type DraggablePopupId = 'qa' | 'chunk' | 'vault' | 'phrases' | 'settings';

