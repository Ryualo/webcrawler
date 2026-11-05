/**
 * SPIDAR v2.7 - Second Brain Neural Graph & Progressive Deep-Read Memory
 * Stores manually read chunks and learned entities as interconnected MemoryNeurons ("Second Brain"),
 * persists independently of chat history, and exports portable Brain bundles for other AI projects.
 */

import {
  NeuralKnowledgeBase,
  MemoryFact,
  ContextualLine,
  KnowledgeTriplet,
  MemoryNeuron,
  NeuronCategory,
  NeuronRelationType,
  NeuronSynapseEdge
} from '../types';
import { extractSalientKeywords, extractContextualPhrases } from './spiderCrawlEngine';

const STORAGE_KEY = 'spidar_neural_memory_v2_6';

/**
 * Extracts quantitative metrics, percentages, speeds, currencies, and benchmarks from text
 */
export function extractQuantitativeMetrics(text: string): string[] {
  const matches =
    text.match(
      /(?:\$\d[\d,.]*(?:\s*(?:million|billion|k))?|\b\d[\d,.]*%|\b\d[\d,.]*\s*(?:ms|s|x|GHz|MHz|GB|TB|MB|events(?:\s+per\s+second|\/s)?|workloads|requests|parity)\b|\bp99\b|\bAES-\d+(?:-[A-Z]+)?\b)/gi
    ) || [];
  return Array.from(new Set(matches.map((m) => m.trim()))).slice(0, 8);
}

/**
 * Tokenizes text into meaningful content words for similarity & retrieval scoring
 */
export function tokenizeContentWords(text: string): string[] {
  const stopwords = new Set([
    'what', 'why', 'how', 'who', 'where', 'when', 'does', 'the', 'and', 'for',
    'this', 'that', 'with', 'from', 'have', 'has', 'had', 'were', 'was', 'are',
    'their', 'while', 'about', 'into', 'over', 'more', 'some', 'such', 'than',
    'then', 'them', 'they', 'your', 'you', 'can', 'will', 'would', 'should',
    'could', 'explain', 'tell', 'mean', 'give', 'detailed'
  ]);
  return (String(text || '').toLowerCase().match(/\b[a-z0-9_-]{3,}\b/g) || []).filter(
    (w) => !stopwords.has(w)
  );
}

/**
 * Computes Jaccard token similarity (0..1) between two texts for duplicate detection
 */
export function computeTextSimilarity(a: string, b: string): number {
  const setA = new Set(tokenizeContentWords(a));
  const setB = new Set(tokenizeContentWords(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  setA.forEach((tok) => {
    if (setB.has(tok)) intersection++;
  });
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function createDefaultKnowledgeBase(): NeuralKnowledgeBase {
  return {
    version: '2.7.0',
    appletId: '2dbb07f4-3786-4df6-9863-d41e08899f61',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    learningLevel: 3,
    comprehensionIq: 116,
    totalConversations: 0,
    totalTabsScanned: 1,
    totalLinesAnalyzed: 6,
    manuallyReadTabs: [],
    neurons: [
      {
        id: 'neuron-biomimetic-crawler',
        title: 'Center-Biased Biomimetic Web Crawler',
        chunkText:
          'SPIDAR walks down the center of the document with subtle left-right poise while its long multi-jointed legs stretch outward to bracket key phrases and words across nearby sentences.',
        distilledInsight:
          'Instead of zig-zagging across the screen, the spider stays centered and uses long inverse-kinematics legs to scan surrounding phrases in real time.',
        keyPhrases: [
          'biomimetic downward web-crawler',
          'long multi-jointed legs',
          'nearby sentences'
        ],
        synapses: ['neuron-second-brain-vault', 'neuron-qwen-local-bridge', 'neuron-portable-brain-export'],
        synapseEdges: [
          { targetId: 'neuron-second-brain-vault', relation: 'feeds_into' as any, weight: 1.9 },
          { targetId: 'neuron-qwen-local-bridge', relation: 'supports', weight: 1.8 }
        ].map((e) => ({
          ...e,
          relation: (e.relation === ('feeds_into' as any) ? 'supports' : e.relation) as NeuronRelationType
        })),
        strength: 1.85,
        sourceTab: 'Autonomous Cyber-Arachnid Agents',
        timestamp: Date.now() - 120000,
        category: 'core_architecture',
        retentionDepth: 98,
        fullSentences: [
          'SPIDAR walks down the center of the document with subtle left-right poise while its long multi-jointed legs stretch outward to bracket key phrases and words across nearby sentences.'
        ],
        metrics: ['1:1 scroll lock']
      },
      {
        id: 'neuron-second-brain-vault',
        title: 'Second Brain Neural Graph Architecture',
        chunkText:
          'Every manually scanned paragraph, dragged text chunk, or clarified entity is indexed into a persistent Memory Neuron with bidirectional synaptic links, forming a connected Second Brain that persists independently of chat history.',
        distilledInsight:
          'Storing knowledge as interconnected graph neurons allows SPIDAR to retain nearly 100% of manually read passages and recall entities across sessions despite chat resets.',
        keyPhrases: ['Memory Neuron', 'Second Brain', 'synaptic links', 'Neural Graph'],
        synapses: ['neuron-biomimetic-crawler', 'neuron-qwen-local-bridge', 'neuron-portable-brain-export'],
        synapseEdges: [
          { targetId: 'neuron-biomimetic-crawler', relation: 'extends', weight: 1.9 },
          { targetId: 'neuron-qwen-local-bridge', relation: 'supports', weight: 1.85 },
          { targetId: 'neuron-portable-brain-export', relation: 'part_of', weight: 1.8 }
        ],
        strength: 1.95,
        sourceTab: 'Autonomous Cyber-Arachnid Agents',
        timestamp: Date.now() - 60000,
        category: 'core_architecture',
        retentionDepth: 99,
        fullSentences: [
          'Every manually scanned paragraph, dragged text chunk, or clarified entity is indexed into a persistent Memory Neuron with bidirectional synaptic links, forming a connected Second Brain that persists independently of chat history.'
        ],
        metrics: ['99% retention']
      },
      {
        id: 'neuron-qwen-local-bridge',
        title: 'Multi-Provider & Local Qwen Reasoning',
        chunkText:
          'Multi-provider AI routing (Gemini, OpenAI, Anthropic, OpenRouter, Free Qwen, and Local Qwen models) provides direct analytical synthesis for general web queries, while switching to high-retention multi-layered explanations whenever answering from manually crawled Second Brain neurons.',
        distilledInsight:
          'Dual-mode routing delivers direct LLM synthesis for general questions and exhaustive sentence-level recall for documents the spider manually read.',
        keyPhrases: ['qwen2.5:7b-instruct', 'Dual-Mode Recall', 'Multi-Provider AI'],
        synapses: ['neuron-second-brain-vault', 'neuron-biomimetic-crawler'],
        synapseEdges: [
          { targetId: 'neuron-second-brain-vault', relation: 'extends', weight: 1.85 },
          { targetId: 'neuron-biomimetic-crawler', relation: 'related_to', weight: 1.75 }
        ],
        strength: 1.75,
        sourceTab: 'Decentralized Inference Economics',
        timestamp: Date.now() - 30000,
        category: 'qwen_synthesis',
        retentionDepth: 96,
        fullSentences: [
          'Multi-provider AI routing (Gemini, OpenAI, Anthropic, OpenRouter, Free Qwen, and Local Qwen models) provides direct analytical synthesis for general web queries, while switching to high-retention multi-layered explanations whenever answering from manually crawled Second Brain neurons.'
        ],
        metrics: ['qwen2.5:7b-instruct']
      },
      {
        id: 'neuron-portable-brain-export',
        title: 'Portable Brain Extraction & Cross-AI Injection',
        chunkText:
          'Users can extract SPIDAR’s Second Brain as a Portable Neural Graph JSON (.spidar-brain.json), a Connected WikiLink Markdown Vault (.md), or a Universal AI System Prompt (.txt) to inject SPIDAR’s memory into external AI projects.',
        distilledInsight:
          'Extracting the Second Brain packages all neurons, synaptic edges, deep-read passages, and entity context into portable files for other LLM agents and RAG pipelines.',
        keyPhrases: ['Extract Brain', 'WikiLink Markdown', 'Portable AI Brain JSON'],
        synapses: ['neuron-second-brain-vault', 'neuron-biomimetic-crawler'],
        synapseEdges: [
          { targetId: 'neuron-second-brain-vault', relation: 'extends', weight: 1.8 }
        ],
        strength: 1.8,
        sourceTab: 'Decentralized Inference Economics',
        timestamp: Date.now() - 15000,
        category: 'core_architecture',
        retentionDepth: 98,
        fullSentences: [
          'Users can extract SPIDAR’s Second Brain as a Portable Neural Graph JSON (.spidar-brain.json), a Connected WikiLink Markdown Vault (.md), or a Universal AI System Prompt (.txt) to inject SPIDAR’s memory into external AI projects.'
        ],
        metrics: ['3 export schemas']
      }
    ],
    facts: [
      {
        id: 'init-fact-1',
        content:
          'SPIDAR anchors its long legs onto real DOM phrase and word coordinates while keeping its body centered in the scroll viewport.',
        category: 'domain_knowledge',
        confidence: 1.0,
        timestamp: Date.now(),
        source: 'user_prompt'
      },
      {
        id: 'init-fact-2',
        content:
          'The Second Brain Vault stores chunks of text as interconnected Neurons that persist independently of chat sessions and can be extracted for other AI projects.',
        category: 'domain_knowledge',
        confidence: 0.98,
        timestamp: Date.now(),
        source: 'user_prompt'
      }
    ],
    triplets: [
      {
        subject: 'SPIDAR',
        relation: 'synthesizes',
        object: 'Second Brain neural graph nodes & deep-read context',
        lineNumber: 1,
        confidence: 0.95
      }
    ],
    concepts: {
      crawling: {
        term: 'crawling',
        frequency: 3,
        weight: 1.25,
        associatedTerms: ['context', 'legs', 'phrases', 'scroll'],
        lastSeen: Date.now()
      },
      qwen: {
        term: 'qwen',
        frequency: 3,
        weight: 1.35,
        associatedTerms: ['local', 'synthesis', 'neurons', 'memory'],
        lastSeen: Date.now()
      },
      neuron: {
        term: 'neuron',
        frequency: 4,
        weight: 1.5,
        associatedTerms: ['chunk', 'synapse', 'vault', 'brain'],
        lastSeen: Date.now()
      }
    },
    userPreferences: {
      crawlDirection: 'downward',
      autoScroll: 'centralized',
      localModel: 'qwen2.5-72b-instruct-free'
    },
    learnedVocabulary: {
      context: 4,
      phrases: 4,
      qwen: 4,
      neuron: 5
    }
  };
}

/**
 * Loads knowledge base from local storage with migration support
 */
export function loadNeuralKnowledgeBase(): NeuralKnowledgeBase {
  if (typeof window === 'undefined') return createDefaultKnowledgeBase();
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('spidar_neural_memory_v2_5');
    if (!raw) return createDefaultKnowledgeBase();
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.facts || !parsed.concepts) {
      return createDefaultKnowledgeBase();
    }
    if (!Array.isArray(parsed.triplets)) parsed.triplets = [];
    if (!Array.isArray(parsed.neurons) || parsed.neurons.length === 0) {
      parsed.neurons = createDefaultKnowledgeBase().neurons;
    }
    if (!Array.isArray(parsed.manuallyReadTabs)) {
      parsed.manuallyReadTabs = [];
    }
    if (typeof parsed.comprehensionIq !== 'number') parsed.comprehensionIq = 116;
    if (typeof parsed.totalLinesAnalyzed !== 'number') parsed.totalLinesAnalyzed = 0;
    return parsed;
  } catch (err) {
    console.warn('Failed to load neural memory, resetting to default', err);
    return createDefaultKnowledgeBase();
  }
}

/**
 * Persists knowledge base to local storage
 */
export function saveNeuralKnowledgeBase(kb: NeuralKnowledgeBase): void {
  if (typeof window === 'undefined') return;
  try {
    kb.updatedAt = Date.now();
    const neuronScore = (kb.neurons?.length || 0) * 3.2;
    const factScore = kb.facts.length * 1.8;
    const tripletScore = (kb.triplets?.length || 0) * 2.2;
    const conceptScore = Object.keys(kb.concepts).length * 1.1;
    const vocabScore = Object.keys(kb.learnedVocabulary).length * 0.4;
    const totalScore =
      neuronScore +
      factScore +
      tripletScore +
      conceptScore +
      vocabScore +
      kb.totalConversations * 2 +
      kb.totalTabsScanned * 4 +
      (kb.totalLinesAnalyzed || 0) * 0.8;

    kb.learningLevel = Math.max(1, Math.min(99, Math.floor(Math.sqrt(totalScore))));
    kb.comprehensionIq = Math.min(
      250,
      102 +
        Math.round(
          kb.learningLevel * 3.5 +
            (kb.triplets?.length || 0) * 1.4 +
            (kb.neurons?.length || 0) * 2.2
        )
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(kb));
    const g = globalThis as any;
    if (g.chrome?.storage?.local) {
      const compactMemory = (kb.neurons || []).slice(0, 60).map((n) => ({
        id: n.id,
        title: n.title,
        content: n.distilledInsight || n.chunkText,
        keyPhrases: n.keyPhrases || [],
        category: n.category || 'manual_deep_read',
        sourceTab: n.sourceTab || 'SPIDAR Studio',
        timestamp: n.timestamp || Date.now()
      }));
      g.chrome.storage.local.set({
        [STORAGE_KEY]: kb,
        spidar_memory_v2_5: compactMemory
      });
    }
  } catch (err) {
    console.error('Failed to save neural memory', err);
  }
}

/**
 * Detects if a candidate neuron is a duplicate or near-duplicate of an existing node
 * using normalized title match, substring match, or Jaccard token similarity >= 0.58.
 */
export function findDuplicateNeuron(
  kb: NeuralKnowledgeBase,
  title: string,
  chunkText: string
): MemoryNeuron | null {
  if (!Array.isArray(kb.neurons) || kb.neurons.length === 0) return null;
  const normTitle = (title || '').trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const cleanChunk = (chunkText || '').trim().toLowerCase();

  for (const existing of kb.neurons) {
    const existingNormTitle = existing.title.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
    if (normTitle.length >= 4 && existingNormTitle === normTitle) {
      return existing;
    }
    const existingChunk = existing.chunkText.trim().toLowerCase();
    if (
      existingChunk === cleanChunk ||
      (cleanChunk.length >= 40 && existingChunk.includes(cleanChunk.slice(0, 65))) ||
      (existingChunk.length >= 40 && cleanChunk.includes(existingChunk.slice(0, 65)))
    ) {
      return existing;
    }
    const sim = computeTextSimilarity(
      `${title} ${chunkText}`,
      `${existing.title} ${existing.chunkText}`
    );
    if (sim >= 0.58) {
      return existing;
    }
  }
  return null;
}

/**
 * Updates an existing neuron's editable fields (title, distilledInsight, chunkText, category, keyPhrases, synapseEdges)
 */
export function updateMemoryNeuron(
  kb: NeuralKnowledgeBase,
  neuronId: string,
  updates: Partial<
    Pick<
      MemoryNeuron,
      'title' | 'distilledInsight' | 'chunkText' | 'category' | 'keyPhrases' | 'synapseEdges' | 'synapses'
    >
  >
): MemoryNeuron | null {
  if (!Array.isArray(kb.neurons)) return null;
  const target = kb.neurons.find((n) => n.id === neuronId);
  if (!target) return null;

  if (typeof updates.title === 'string' && updates.title.trim()) {
    target.title = updates.title.trim();
  }
  if (typeof updates.distilledInsight === 'string' && updates.distilledInsight.trim()) {
    target.distilledInsight = updates.distilledInsight.trim();
  }
  if (typeof updates.chunkText === 'string' && updates.chunkText.trim()) {
    target.chunkText = updates.chunkText.trim();
    target.fullSentences = target.chunkText.split(/(?<=[.?!])\s+/).filter(Boolean);
    target.metrics = extractQuantitativeMetrics(target.chunkText);
  }
  if (updates.category) {
    target.category = updates.category;
  }
  if (Array.isArray(updates.keyPhrases)) {
    target.keyPhrases = updates.keyPhrases.map((k) => k.trim()).filter(Boolean);
  }
  if (Array.isArray(updates.synapseEdges)) {
    target.synapseEdges = updates.synapseEdges;
    target.synapses = Array.from(
      new Set([
        ...(updates.synapses || []),
        ...updates.synapseEdges.map((e) => e.targetId)
      ])
    );
  } else if (Array.isArray(updates.synapses)) {
    target.synapses = updates.synapses;
  }

  target.timestamp = Date.now();
  saveNeuralKnowledgeBase(kb);
  return target;
}

/**
 * Connects two neurons in the Neural Graph with a meaningful typed relationship
 */
export function connectNeuronsWithRelation(
  kb: NeuralKnowledgeBase,
  sourceId: string,
  targetId: string,
  relation: NeuronRelationType = 'related_to',
  note?: string
): boolean {
  if (!Array.isArray(kb.neurons) || sourceId === targetId) return false;
  const source = kb.neurons.find((n) => n.id === sourceId);
  const target = kb.neurons.find((n) => n.id === targetId);
  if (!source || !target) return false;

  if (!Array.isArray(source.synapses)) source.synapses = [];
  if (!source.synapses.includes(targetId)) source.synapses.push(targetId);

  if (!Array.isArray(target.synapses)) target.synapses = [];
  if (!target.synapses.includes(sourceId)) target.synapses.push(sourceId);

  if (!Array.isArray(source.synapseEdges)) source.synapseEdges = [];
  const existingEdge = source.synapseEdges.find((e) => e.targetId === targetId);
  if (existingEdge) {
    existingEdge.relation = relation;
    existingEdge.weight = Math.min(5.0, +(existingEdge.weight + 0.2).toFixed(2));
    if (note !== undefined) existingEdge.note = note;
  } else {
    source.synapseEdges.push({
      targetId,
      relation,
      weight: Number(((source.strength + target.strength) / 2).toFixed(2)),
      note
    });
  }

  saveNeuralKnowledgeBase(kb);
  return true;
}

/**
 * Removes a relationship between two neurons
 */
export function removeNeuronConnection(
  kb: NeuralKnowledgeBase,
  sourceId: string,
  targetId: string
): boolean {
  if (!Array.isArray(kb.neurons)) return false;
  const source = kb.neurons.find((n) => n.id === sourceId);
  const target = kb.neurons.find((n) => n.id === targetId);
  if (source) {
    source.synapses = (source.synapses || []).filter((id) => id !== targetId && id !== target?.title);
    source.synapseEdges = (source.synapseEdges || []).filter((e) => e.targetId !== targetId);
  }
  if (target) {
    target.synapses = (target.synapses || []).filter((id) => id !== sourceId && id !== source?.title);
    target.synapseEdges = (target.synapseEdges || []).filter((e) => e.targetId !== sourceId);
  }
  saveNeuralKnowledgeBase(kb);
  return true;
}

/**
 * Digest a chunk of text (e.g., a paragraph the spider was dragged onto, or a manually crawled section)
 * into a persistent Second Brain MemoryNeuron with automatic duplicate detection, typed relationships, and 98% retention.
 */
export function ingestChunkAsNeuron(
  kb: NeuralKnowledgeBase,
  chunkText: string,
  sourceTab = 'Current Webpage',
  customTitle?: string,
  category: NeuronCategory = 'manual_deep_read'
): MemoryNeuron | null {
  const clean = (chunkText || '').trim().replace(/\s+/g, ' ');
  if (clean.length < 15) return null;

  if (!Array.isArray(kb.neurons)) kb.neurons = [];

  const phrases = extractContextualPhrases(clean, 0, 0).map((p) => p.phrase);
  const kws = extractSalientKeywords(clean, 6).map((k) => k.word);
  const keyPhrases = Array.from(new Set([...phrases, ...kws])).slice(0, 6);
  const metrics = extractQuantitativeMetrics(clean);

  const generatedTitle =
    customTitle ||
    (keyPhrases.length >= 2
      ? `${keyPhrases[0]} & ${keyPhrases[1]}`.replace(/\b\w/g, (c) => c.toUpperCase())
      : clean.split(/\s+/).slice(0, 5).join(' ') + (clean.split(/\s+/).length > 5 ? '...' : ''));

  // Duplicate & near-duplicate detection: merge into existing node if found
  const duplicate = findDuplicateNeuron(kb, generatedTitle, clean);
  if (duplicate) {
    duplicate.strength = Math.min(5.0, +(duplicate.strength + 0.35).toFixed(2));
    duplicate.timestamp = Date.now();
    duplicate.category = duplicate.category || category;
    duplicate.retentionDepth = Math.max(duplicate.retentionDepth || 96, 98);
    duplicate.keyPhrases = Array.from(new Set([...duplicate.keyPhrases, ...keyPhrases])).slice(0, 8);
    const newSentences = clean.split(/(?<=[.?!])\s+/).filter(Boolean);
    duplicate.fullSentences = Array.from(
      new Set([...(duplicate.fullSentences || []), ...newSentences])
    ).slice(0, 12);
    duplicate.metrics = Array.from(new Set([...(duplicate.metrics || []), ...metrics])).slice(0, 10);
    if (clean.length > duplicate.chunkText.length && !duplicate.chunkText.includes(clean.slice(0, 40))) {
      duplicate.chunkText = `${duplicate.chunkText} ${clean}`.slice(0, 1800);
    }
    saveNeuralKnowledgeBase(kb);
    return duplicate;
  }

  const sentences = clean.split(/(?<=[.?!])\s+/).filter(Boolean);
  const firstSent = sentences[0] || clean;
  const secondSent = sentences[1] || '';
  const thirdSent = sentences[2] || '';
  const secondFormatted = /^[A-Z]{2}/.test(secondSent)
    ? secondSent
    : secondSent.charAt(0).toLowerCase() + secondSent.slice(1);

  const distilledInsight =
    sentences.length > 1
      ? `${firstSent} Specifically, ${secondFormatted}${thirdSent ? ` ${thirdSent}` : ''}`
      : firstSent;

  // Compute typed synaptic links to existing neurons that share key terms or belong to the same sourceTab
  const lowerTokens = new Set(tokenizeContentWords(clean));
  const synapses: string[] = [];
  const synapseEdges: NeuronSynapseEdge[] = [];
  const newNeuronId = `neuron-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  kb.neurons.forEach((other) => {
    const sharedPhrase = other.keyPhrases.some((kp) =>
      kp
        .toLowerCase()
        .split(/\s+/)
        .some((w) => w.length >= 4 && lowerTokens.has(w))
    );
    const sim = computeTextSimilarity(clean, `${other.title} ${other.chunkText}`);
    const sameTab = other.sourceTab === sourceTab && sourceTab !== 'Current Webpage';

    if ((sharedPhrase || sim >= 0.16 || sameTab) && synapses.length < 5) {
      const relation: NeuronRelationType =
        metrics.length > 0 && (other.metrics?.length || 0) > 0
          ? 'evidence_for'
          : sharedPhrase
          ? 'extends'
          : sameTab
          ? 'part_of'
          : 'related_to';
      synapses.push(other.id);
      synapseEdges.push({
        targetId: other.id,
        relation,
        weight: Number(Math.min(4.5, 1.5 + sim * 2).toFixed(2))
      });
      if (!other.synapses.includes(newNeuronId) && other.synapses.length < 6) {
        other.synapses.push(newNeuronId);
      }
    }
  });

  if (synapses.length === 0 && kb.neurons.length > 0) {
    synapses.push(kb.neurons[0].id);
    synapseEdges.push({
      targetId: kb.neurons[0].id,
      relation: 'related_to',
      weight: 1.4
    });
  }

  const newNeuron: MemoryNeuron = {
    id: newNeuronId,
    title: generatedTitle,
    chunkText: clean,
    distilledInsight,
    keyPhrases: keyPhrases.length > 0 ? keyPhrases : ['context chunk'],
    synapses,
    synapseEdges,
    strength: category === 'manual_deep_read' ? 2.2 : 1.7,
    sourceTab,
    timestamp: Date.now(),
    category,
    retentionDepth: category === 'manual_deep_read' ? 98 : 92,
    fullSentences: sentences,
    metrics
  };

  kb.neurons.unshift(newNeuron);
  if (kb.neurons.length > 75) {
    kb.neurons = kb.neurons.slice(0, 75);
  }

  feedContextToBrain(kb, clean, 'tab_crawl');
  saveNeuralKnowledgeBase(kb);
  return newNeuron;
}

/**
 * Ingests an entire manually-crawled document/tab into interconnected Deep-Read Neurons
 * so SPIDAR remembers nearly 100% of the sentences, numbers, mechanisms, and triplets.
 */
export function ingestFullDocumentManualRead(
  kb: NeuralKnowledgeBase,
  tabTitle: string,
  paragraphs: string[],
  contextualLines: ContextualLine[] = []
): MemoryNeuron[] {
  if (!Array.isArray(kb.manuallyReadTabs)) {
    kb.manuallyReadTabs = [];
  }
  if (!kb.manuallyReadTabs.includes(tabTitle)) {
    kb.manuallyReadTabs.push(tabTitle);
  }

  const createdNeurons: MemoryNeuron[] = [];
  for (let idx = paragraphs.length - 1; idx >= 0; idx--) {
    const para = paragraphs[idx];
    if (!para || para.trim().length < 20) continue;
    const phrases = extractContextualPhrases(para, idx, idx).map((p) => p.phrase);
    const kws = extractSalientKeywords(para, 3).map((k) => k.word);
    const leadTag = phrases[0] || kws.slice(0, 2).join(' & ') || `Section ${idx + 1}`;
    const formattedTag = leadTag.replace(/\b\w/g, (c) => c.toUpperCase());
    const customTitle = `${formattedTag} (${tabTitle.split(/\s+/).slice(0, 3).join(' ')} #${idx + 1})`;

    const neuron = ingestChunkAsNeuron(kb, para, tabTitle, customTitle, 'manual_deep_read');
    if (neuron) {
      createdNeurons.unshift(neuron);
    }
  }

  // Chain sequential paragraphs together with explicit typed synaptic links
  for (let i = 0; i < createdNeurons.length - 1; i++) {
    const curr = createdNeurons[i];
    const next = createdNeurons[i + 1];
    connectNeuronsWithRelation(kb, curr.id, next.id, 'extends');
  }

  contextualLines.forEach((line) => {
    if (line.hasHighContext || line.triplet) {
      ingestLineContextToBrain(kb, line);
    }
  });

  saveNeuralKnowledgeBase(kb);
  return createdNeurons;
}

/**
 * Finds and activates ONLY genuinely relevant Second Brain Neurons for a given question or topic.
 * Never returns unrelated fallback nodes if nothing matches above threshold.
 */
export function findRelevantNeurons(
  kb: NeuralKnowledgeBase,
  query: string,
  limit = 5
): MemoryNeuron[] {
  if (!Array.isArray(kb.neurons) || kb.neurons.length === 0) return [];
  const qTokens = tokenizeContentWords(query);
  if (qTokens.length === 0) {
    return [];
  }

  const lowerQuery = query.toLowerCase();
  const scored = kb.neurons.map((neuron) => {
    const titleLower = neuron.title.toLowerCase();
    const insightLower = neuron.distilledInsight.toLowerCase();
    const chunkLower = neuron.chunkText.toLowerCase();
    const phrasesLower = neuron.keyPhrases.map((p) => p.toLowerCase());
    const haystack = `${titleLower} ${insightLower} ${chunkLower} ${phrasesLower.join(' ')}`;

    let lexicalHits = 0;
    let score = 0;

    // Exact phrase match bonus
    phrasesLower.forEach((kp) => {
      if (kp.length >= 4 && lowerQuery.includes(kp)) {
        score += 4.2;
        lexicalHits += 2;
      }
    });

    qTokens.forEach((qt) => {
      let tokenMatched = false;
      if (titleLower.includes(qt)) {
        score += 3.0;
        tokenMatched = true;
      }
      if (phrasesLower.some((p) => p.includes(qt))) {
        score += 2.5;
        tokenMatched = true;
      }
      if (insightLower.includes(qt) || chunkLower.includes(qt)) {
        score += 1.8;
        tokenMatched = true;
      }
      if (tokenMatched && haystack.includes(qt)) {
        lexicalHits += 1;
      }
    });

    // Only apply strength/category tie-breaker if there was at least 1 real lexical match
    if (lexicalHits > 0) {
      if (neuron.category === 'entity_context') score += 0.6;
      if (neuron.category === 'manual_deep_read') score += 0.4;
      score += Math.min(1.0, (neuron.strength || 1.5) * 0.2);
    }

    return { neuron, score, lexicalHits };
  });

  scored.sort((a, b) => b.score - a.score);
  const primaryMatches = scored
    .filter((s) => s.lexicalHits >= 1 && s.score >= 1.8)
    .slice(0, limit);

  if (primaryMatches.length === 0) {
    return [];
  }

  const resultIds = new Set(primaryMatches.map((m) => m.neuron.id));
  const results = primaryMatches.map((m) => m.neuron);

  // If top node is a strong match, pull in 1 strongly connected neighbor for relational context
  if (primaryMatches[0].score >= 4.2 && results.length < limit) {
    const topNeuron = primaryMatches[0].neuron;
    const neighborId =
      topNeuron.synapseEdges?.[0]?.targetId || topNeuron.synapses?.[0];
    if (neighborId && !resultIds.has(neighborId)) {
      const neighbor = kb.neurons.find((n) => n.id === neighborId);
      if (neighbor) {
        results.push(neighbor);
      }
    }
  }

  return results.slice(0, limit);
}

/**
 * Retrieves relevant neurons, facts, and triplets for a query with strict relevance filtering
 */
export function retrieveRelevantKnowledge(
  kb: NeuralKnowledgeBase,
  query: string,
  limit = 5
): {
  relevantNeurons: MemoryNeuron[];
  relevantFacts: MemoryFact[];
  relevantTriplets: KnowledgeTriplet[];
} {
  const relevantNeurons = findRelevantNeurons(kb, query, limit);
  const qTokens = tokenizeContentWords(query);
  if (qTokens.length === 0) {
    return { relevantNeurons, relevantFacts: [], relevantTriplets: [] };
  }

  const relevantFacts = (kb.facts || [])
    .map((fact) => {
      const lower = fact.content.toLowerCase();
      let hits = 0;
      qTokens.forEach((qt) => {
        if (lower.includes(qt)) hits += 1;
      });
      return { fact, hits };
    })
    .filter((f) => f.hits >= 1)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit)
    .map((f) => f.fact);

  const relevantTriplets = (kb.triplets || [])
    .filter((t) => {
      const text = `${t.subject} ${t.relation} ${t.object}`.toLowerCase();
      return qTokens.some((qt) => text.includes(qt));
    })
    .slice(0, limit);

  return { relevantNeurons, relevantFacts, relevantTriplets };
}

/**
 * Ingests a single ContextualLine in real time as the spider crawls over it
 */
export function ingestLineContextToBrain(
  kb: NeuralKnowledgeBase,
  line: ContextualLine
): { iqDelta: number; newTriplet?: KnowledgeTriplet } {
  kb.totalLinesAnalyzed = (kb.totalLinesAnalyzed || 0) + 1;
  let newTriplet: KnowledgeTriplet | undefined;

  if (line.triplet) {
    if (!Array.isArray(kb.triplets)) kb.triplets = [];
    const exists = kb.triplets.some(
      (t) =>
        t.subject.toLowerCase() === line.triplet!.subject.toLowerCase() &&
        t.relation.toLowerCase() === line.triplet!.relation.toLowerCase()
    );
    if (!exists) {
      kb.triplets.unshift(line.triplet);
      if (kb.triplets.length > 60) kb.triplets = kb.triplets.slice(0, 60);
      newTriplet = line.triplet;
    }
  }

  const lineWords = line.keywords.map((k) => k.word.toLowerCase());
  lineWords.forEach((word) => {
    kb.learnedVocabulary[word] = (kb.learnedVocabulary[word] || 0) + 1;
    if (!kb.concepts[word]) {
      kb.concepts[word] = {
        term: word,
        frequency: 1,
        weight: line.hasHighContext ? 1.3 : 1.0,
        associatedTerms: lineWords.filter((w) => w !== word).slice(0, 5),
        lastSeen: Date.now()
      };
    } else {
      kb.concepts[word].frequency += 1;
      kb.concepts[word].weight = Math.min(
        3.5,
        kb.concepts[word].weight + (line.hasHighContext ? 0.12 : 0.05)
      );
      kb.concepts[word].lastSeen = Date.now();
      lineWords.forEach((other) => {
        if (other !== word && !kb.concepts[word].associatedTerms.includes(other)) {
          if (kb.concepts[word].associatedTerms.length < 8) {
            kb.concepts[word].associatedTerms.push(other);
          }
        }
      });
    }
  });

  const prevIq = kb.comprehensionIq || 116;
  saveNeuralKnowledgeBase(kb);
  return {
    iqDelta: Math.max(1, (kb.comprehensionIq || 116) - prevIq),
    newTriplet
  };
}

const NON_NAME_STOPWORDS = new Set([
  'it', 'its', "it's", 'he', 'hes', "he's", 'she', 'shes', "she's", 'they', 'theyre', "they're",
  'this', 'that', 'these', 'those', 'there', 'here', 'what', 'whats', "what's", 'who', 'whos', "who's",
  'how', 'why', 'where', 'when', 'which', 'you', 'your', 'yours', 'me', 'my', 'mine', 'we', 'our',
  'i', 'im', "i'm", 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did',
  'can', 'could', 'will', 'would', 'should', 'may', 'might', 'must', 'the', 'a', 'an', 'some', 'any',
  'page', 'article', 'tab', 'website', 'site', 'app', 'spidar', 'spider', 'everything', 'something',
  'nothing', 'anything', 'someone', 'anyone', 'everyone', 'nobody', 'bruh', 'bro', 'dude', 'man',
  'dawg', 'fam', 'ykyk', 'ifykyk', 'shi', 'shii', 'fr', 'ngl', 'lol', 'lmao', 'hi', 'hello', 'hey',
  'yo', 'sup', 'thanks', 'thank', 'yes', 'no', 'okay', 'ok', 'sure', 'help', 'explain', 'summarize'
]);

/**
 * Strips casual slang prefixes & suffixes ("bruh", "ykyk", "ifykyk", "type shi", "shi", "dude", "bro", "fr", "ngl", "again", etc.)
 * while preserving actual person/entity names and relationship nouns like "my bro" or "my friend".
 */
export function stripConversationalSlang(input: string): string {
  let s = (input || '').trim().replace(/[?!.]+$/, '').trim();
  s = s
    .replace(
      /^(?:(?:bruh|bro|yo|hey|wait|ay|aye|lowkey|ngl|fr|frfr|btw|actually|honestly|like|man|dude|dawg|fam|twin)[,\s]+)+/i,
      ''
    )
    .trim();
  for (let i = 0; i < 4; i++) {
    const next = s
      .replace(
        /[,\s]+\b(?:type\s+shii?|shii?|bruh|btw|ifykyk|ykyk|lol|lmao|haha|fr|frfr|ngl|rn|tho|though|again|now)\s*$/i,
        ''
      )
      .replace(
        /(?<!\b(?:my|our|your|his|her|their|a|an|the))[,\s]+\b(?:bro|dude|man|mate|dawg|fam|twin|homie)\s*$/i,
        ''
      )
      .replace(/[?!.]+$/, '')
      .trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

/**
 * Normalizes a recognized human name, nickname, handle, or entity title.
 */
export function formatRecognizedName(raw: string, isLikelyPerson = true): string {
  const cleaned = stripConversationalSlang(raw)
    .replace(/^(?:the|a|an)\s+/i, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();
  if (!cleaned) return '';
  if (cleaned.startsWith('@')) return cleaned;

  const words = cleaned.split(/\s+/);
  if (isLikelyPerson && words.length >= 1 && words.length <= 4) {
    return words
      .map((w) => {
        if (w.length <= 1) return w.toUpperCase();
        if (w === w.toLowerCase()) {
          return w.charAt(0).toUpperCase() + w.slice(1);
        }
        return w;
      })
      .join(' ');
  }
  return cleaned;
}

/**
 * Checks whether a candidate phrase looks like a valid name, nickname, handle, or entity
 */
export function isValidEntityOrNameCandidate(candidate: string): boolean {
  const clean = stripConversationalSlang(candidate).trim();
  if (!clean || clean.length < 2 || clean.length > 48) return false;
  const words = clean.split(/\s+/);
  if (words.length > 4) return false;
  if (words.length === 1 && NON_NAME_STOPWORDS.has(words[0].toLowerCase())) {
    return false;
  }
  if (
    /^(you|your\s+name|your\s+purpose|this|that|it|this\s+page|this\s+article|this\s+tab|going\s+on|up|good|happening)$/i.test(
      clean
    )
  ) {
    return false;
  }
  return true;
}

/**
 * Detects when a user types a bare name or entity (e.g. a friend's name like "Marcus Vance" or "ethan zhao")
 * without a question prefix or verb, so SPIDAR NEVER assumes it is the user's own name and instead asks for context.
 */
export function extractBareEntityOrNameInput(rawInput: string): string | null {
  const trimmed = (rawInput || '').trim();
  if (!trimmed || trimmed.endsWith('?')) return null;

  const clean = stripConversationalSlang(trimmed);
  if (!clean || clean.length < 2 || clean.length > 42) return null;

  // Reject if it contains digits/math or starts with a known conversational/teaching pattern
  if (/[\d+\-*/=^]/.test(clean)) return null;
  if (
    /^(?:hi|hello|hey|yo|sup|howdy|good\s+(?:morning|afternoon|evening)|thanks|thank\s+you|how\s+are\s+you|what|who|why|how|where|when|which|explain|summarize|tell\s+me|can\s+you|could\s+you|do\s+you|my\s+|our\s+|i\s+|i'm|im\s+|call\s+me|it's|its\s+|he's|hes\s+|she's|shes\s+|they're|that's|he\s+is|she\s+is|it\s+is|they\s+are|remember|note\s+that|train\s+spidar)/i.test(
      clean
    )
  ) {
    return null;
  }

  // Reject if it contains a relational verb ("is", "are", "was", "works", "means", etc.)
  if (/\b(?:is|are|was|were|have|has|had|does|do|did|works|lives|means|refers|builds|studies|can|will|should)\b/i.test(clean)) {
    return null;
  }

  const words = clean.split(/\s+/);
  if (words.length < 1 || words.length > 4) return null;
  if (!words.every((w) => /^[a-zA-Z@][a-zA-Z._'-]*$/.test(w))) return null;
  if (words.some((w) => NON_NAME_STOPWORDS.has(w.toLowerCase()))) return null;

  if (!isValidEntityOrNameCandidate(clean)) return null;
  return formatRecognizedName(clean, true);
}

/**
 * Extracts the primary person, name, nickname, handle, or topic being asked about or mentioned in a turn.
 */
export function extractSubjectFromQuestion(question: string): string | null {
  const clean = stripConversationalSlang(question);
  if (!clean) return null;

  const personPatterns = [
    /^(?:who(?:'s|s|\s+is|\s+was|\s+are|\s+tf\s+is|\s+the\s+heck\s+is)?|whos)\s+(.+?)(?:\s+to\s+you|\s+to\s+me|\s+is|\s+was)?$/i,
    /^(?:do\s+)?(?:you|u)\s+(?:know|remember)\s+(?:who\s+)?(.+?)(?:\s+is|\s+was)?$/i,
    /^remind\s+me\s+who\s+(.+?)(?:\s+is|\s+was)?$/i,
    /^remember\s+(.+?)$/i
  ];

  for (const regex of personPatterns) {
    const match = clean.match(regex);
    if (match && match[1]) {
      const candidate = stripConversationalSlang(match[1])
        .replace(/^(?:who|what)\s+/i, '')
        .replace(/\s+(?:is|was|are)$/i, '')
        .trim();
      if (isValidEntityOrNameCandidate(candidate)) {
        return formatRecognizedName(candidate, true);
      }
    }
  }

  const topicPatterns = [
    /^(?:what(?:'s|s|\s+is|\s+are|\s+was)|where(?:'s|\s+is)|tell\s+me\s+about|remind\s+me\s+what)\s+(.+?)(?:\s+is|\s+was)?$/i
  ];

  for (const regex of topicPatterns) {
    const match = clean.match(regex);
    if (match && match[1]) {
      const candidate = stripConversationalSlang(match[1])
        .replace(/^(?:the|a|an)\s+/i, '')
        .replace(/\s+(?:is|was|are)$/i, '')
        .trim();
      if (isValidEntityOrNameCandidate(candidate)) {
        const isCapitalized = /^[A-Z]/.test(candidate);
        return formatRecognizedName(candidate, isCapitalized);
      }
    }
  }

  // Also check if the turn was a bare name/entity input (e.g., user typed their friend's name directly)
  const bareEntity = extractBareEntityOrNameInput(question);
  if (bareEntity) {
    return bareEntity;
  }

  return null;
}

/**
 * Trains SPIDAR's Second Brain (Neurons, Facts, Triplets, and IQ) directly from a chat turn.
 * Handles:
 * 1. Explicit AI-extracted training payload from Qwen (/api/ai/chat)
 * 2. Multi-turn pronoun & elliptical resolution across recent chat turns (including bare name turn -> "It's my friend" follow-up)
 * 3. Direct user teaching statements with any capitalized or lowercase name, nickname, handle, or relationship
 * NEVER assumes a bare name is the user's own name.
 */
export function trainSpidarFromChatTurn(
  kb: NeuralKnowledgeBase,
  userMessage: string,
  previousMessages: { role: string; content: string }[] = [],
  aiTrainedPayload?: {
    title?: string;
    insight?: string;
    keyPhrases?: string[];
  } | null
): {
  trainedNeuron: MemoryNeuron | null;
  newFact: MemoryFact | null;
  iqGain: number;
} {
  const prevIq = kb.comprehensionIq || 116;
  const rawMsg = (userMessage || '').trim().replace(/\s+/g, ' ');
  const cleanMsg = stripConversationalSlang(rawMsg);
  if (!cleanMsg) {
    return { trainedNeuron: null, newFact: null, iqGain: 0 };
  }

  // If the current message is just a bare name/entity without context, do NOT train yet—SPIDAR will ask for context first!
  if (extractBareEntityOrNameInput(rawMsg) && !aiTrainedPayload?.insight) {
    return { trainedNeuron: null, newFact: null, iqGain: 0 };
  }

  // Search recent prior user messages (most recent first) for an asked person/subject or bare name to resolve pronouns
  const priorUserMsgs = previousMessages.filter(
    (m) => m.role === 'user' && m.content.trim().toLowerCase() !== rawMsg.toLowerCase()
  );
  let lastUserQuestion = '';
  let priorSubject: string | null = null;
  for (let i = priorUserMsgs.length - 1; i >= Math.max(0, priorUserMsgs.length - 3); i--) {
    const extracted = extractSubjectFromQuestion(priorUserMsgs[i].content);
    if (extracted) {
      priorSubject = extracted;
      lastUserQuestion = priorUserMsgs[i].content;
      break;
    }
  }

  let resolvedTitle = aiTrainedPayload?.title?.trim() || '';
  let resolvedInsight = aiTrainedPayload?.insight?.trim() || '';
  let resolvedPhrases: string[] = Array.isArray(aiTrainedPayload?.keyPhrases)
    ? aiTrainedPayload!.keyPhrases!.filter(Boolean)
    : [];
  let learnedSubjectForTriplet: string | null = null;
  let learnedObjectForTriplet: string | null = null;

  // Pattern A: Multi-turn pronoun or elliptical context clarification ("It's my friend dude", "He's my colleague", "my friend", "a researcher")
  const pronounMatch = cleanMsg.match(
    /^(?:it(?:'s|s|\s+is)|he(?:'s|s|\s+is)|she(?:'s|s|\s+is)|they(?:'re|re|\s+are)|that(?:'s|s|\s+is)|he\s+was|she\s+was)\s+(.+)$/i
  );
  const ellipticalRoleMatch =
    priorSubject && !cleanMsg.endsWith('?')
      ? cleanMsg.match(
          /^(?:(my|our)\s+([a-zA-Z0-9\s-]{2,35})|(a|an)\s+([a-zA-Z0-9\s-]{2,35})|(friend|best\s+friend|colleague|coworker|classmate|partner|cousin|brother|sister|mentor|client|collaborator))$/i
        )
      : null;

  if ((pronounMatch || ellipticalRoleMatch) && priorSubject) {
    const rawPredicate = pronounMatch ? pronounMatch[1] : cleanMsg;
    const predicateRaw = stripConversationalSlang(rawPredicate);
    const predicateNormalized =
      /^(?:friend|colleague|coworker|classmate|cousin|brother|sister|mentor|collaborator)$/i.test(
        predicateRaw
      )
        ? `the user's ${predicateRaw.toLowerCase()}`
        : predicateRaw
            .replace(/\bmy\b/gi, "the user's")
            .replace(/\bour\b/gi, "the user's")
            .replace(/\bi\b/gi, 'the user');

    const formattedSubj = formatRecognizedName(priorSubject, true);
    const roleLabel = predicateRaw
      .replace(/^my\s+/i, 'User ')
      .replace(/^our\s+/i, 'User ');

    resolvedTitle = resolvedTitle || `${formattedSubj} (${roleLabel})`;
    resolvedInsight =
      resolvedInsight ||
      `${formattedSubj} is ${predicateNormalized} (indexed via Second Brain context clarification: "${formattedSubj} -> ${predicateRaw}").`;
    resolvedPhrases = Array.from(
      new Set([formattedSubj, formattedSubj.toLowerCase(), predicateRaw, ...resolvedPhrases])
    ).slice(0, 5);
    learnedSubjectForTriplet = formattedSubj;
    learnedObjectForTriplet = predicateRaw;
  }

  // Pattern B: Direct teaching in a single message
  if (!resolvedInsight) {
    const isQuestion =
      rawMsg.endsWith('?') ||
      /^(what|whats|why|how|who|whos|where|when|which|can you|could you|do you|do u|u know|does|is this|are you|did you|tell me|explain|summarize)\b/i.test(
        cleanMsg
      );

    if (!isQuestion) {
      // 1. User explicitly introduces their OWN name ("my name is <Name>", "call me <Name>")
      const selfNameMatch = cleanMsg.match(
        /^(?:my\s+name\s+is|call\s+me|i\s+go\s+by)\s+([a-zA-Z@][a-zA-Z0-9_.\s-]{1,32})$/i
      );
      // 2. "my <relation>'s name is <Name>" or "my <relation> is <Name>"
      const reverseRelationMatch = cleanMsg.match(
        /^my\s+(friend|best\s+friend|bro|brother|sister|sis|cousin|coworker|colleague|boss|manager|partner|girlfriend|gf|boyfriend|bf|wife|husband|homie|dawg|mentor|teacher|professor|roommate|neighbor|collaborator)(?:'s\s+name|\s+name)?\s+(?:is|was|is\s+called)\s+([a-zA-Z@][a-zA-Z0-9_.\s-]{1,35})$/i
      );
      // 3. "<Name> is my/our <relation/role>"
      const nameIsMyRelationMatch = cleanMsg.match(
        /^([a-zA-Z@][a-zA-Z0-9_.\s-]{1,38}?)\s+(?:is|are|was)\s+(my|our)\s+(.+)$/i
      );
      // 4. Explicit remember / note command
      const rememberMatch = cleanMsg.match(
        /^(?:remember\s+that|remember|note\s+that|train\s+spidar:?|fyi:?|for\s+your\s+info:?)\s+(.+)$/i
      );
      // 5. General "my <attribute> is <value>"
      const myAttrMatch = cleanMsg.match(/^my\s+([a-z0-9\s]{2,25}?)\s+(?:is|are)\s+(.+)$/i);
      // 6. "<Entity/Name> is/means/works at/lives in <description>"
      const entityIsMatch = cleanMsg.match(
        /^([A-Z@][a-zA-Z0-9_.\s-]{1,38}?)\s+(?:is|are|was|means|refers\s+to|works\s+at|lives\s+in|builds|studies)\s+(.+)$/
      );

      if (selfNameMatch && isValidEntityOrNameCandidate(selfNameMatch[1])) {
        const userName = formatRecognizedName(selfNameMatch[1], true);
        if (
          !/^(good|fine|okay|ok|here|ready|back|tired|great|doing\s+well|a\s+developer|a\s+student|building)$/i.test(
            userName
          )
        ) {
          resolvedTitle = `User Identity: ${userName}`;
          resolvedInsight = `The user's name is ${userName}.`;
          resolvedPhrases = [userName, userName.toLowerCase(), 'user identity'];
          learnedSubjectForTriplet = 'User';
          learnedObjectForTriplet = userName;
        }
      }

      if (
        !resolvedInsight &&
        reverseRelationMatch &&
        isValidEntityOrNameCandidate(reverseRelationMatch[2])
      ) {
        const relation = stripConversationalSlang(reverseRelationMatch[1]).toLowerCase();
        const personName = formatRecognizedName(reverseRelationMatch[2], true);
        resolvedTitle = `${personName} (User ${relation})`;
        resolvedInsight = `${personName} is the user's ${relation}.`;
        resolvedPhrases = [personName, personName.toLowerCase(), relation];
        learnedSubjectForTriplet = personName;
        learnedObjectForTriplet = `user's ${relation}`;
      }

      if (
        !resolvedInsight &&
        nameIsMyRelationMatch &&
        isValidEntityOrNameCandidate(nameIsMyRelationMatch[1])
      ) {
        const rawEntity = nameIsMyRelationMatch[1].trim();
        if (!/^my\s+/i.test(rawEntity)) {
          const personName = formatRecognizedName(rawEntity, true);
          const relDesc = stripConversationalSlang(nameIsMyRelationMatch[3]);
          resolvedTitle = `${personName} (User ${relDesc})`;
          resolvedInsight = `${personName} is the user's ${relDesc}.`;
          resolvedPhrases = [personName, personName.toLowerCase(), relDesc];
          learnedSubjectForTriplet = personName;
          learnedObjectForTriplet = `user's ${relDesc}`;
        }
      }

      if (!resolvedInsight && rememberMatch) {
        const body = stripConversationalSlang(rememberMatch[1]);
        resolvedTitle = `Trained Memory: ${body.split(/\s+/).slice(0, 4).join(' ')}`;
        resolvedInsight = `User trained SPIDAR to remember: ${body}.`;
        resolvedPhrases = extractSalientKeywords(body, 4).map((k) => k.word);
      } else if (!resolvedInsight && myAttrMatch) {
        const attr = stripConversationalSlang(myAttrMatch[1]);
        const val = stripConversationalSlang(myAttrMatch[2]);
        resolvedTitle = `User's ${attr.replace(/\b\w/g, (c) => c.toUpperCase())}: ${val}`;
        resolvedInsight = `The user's ${attr} is ${val}.`;
        resolvedPhrases = [attr, val];
      } else if (
        !resolvedInsight &&
        entityIsMatch &&
        isValidEntityOrNameCandidate(entityIsMatch[1])
      ) {
        const entity = formatRecognizedName(entityIsMatch[1], true);
        const desc = stripConversationalSlang(entityIsMatch[2]);
        const normalizedDesc = desc.replace(/\bmy\b/gi, "the user's");
        resolvedTitle = `${entity} — ${desc.split(/\s+/).slice(0, 4).join(' ')}`;
        resolvedInsight = `${entity} is ${normalizedDesc}.`;
        resolvedPhrases = [entity, entity.toLowerCase(), desc];
        learnedSubjectForTriplet = entity;
        learnedObjectForTriplet = desc;
      }
    }
  }

  if (!resolvedInsight) {
    return { trainedNeuron: null, newFact: null, iqGain: 0 };
  }

  if (!Array.isArray(kb.neurons)) kb.neurons = [];

  // Create or update the MemoryFact
  let createdFact: MemoryFact | null = null;
  const existingFact = kb.facts.find(
    (f) => f.content.toLowerCase() === resolvedInsight.toLowerCase()
  );
  if (!existingFact) {
    createdFact = {
      id: `fact-chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      content: resolvedInsight,
      category: 'user_note',
      confidence: 1.0,
      timestamp: Date.now(),
      source: 'conversation'
    };
    kb.facts.unshift(createdFact);
  } else {
    createdFact = existingFact;
  }

  // Create or reinforce the MemoryNeuron in Second Brain
  const existingNeuron = kb.neurons.find(
    (n) =>
      n.title.toLowerCase() === resolvedTitle.toLowerCase() ||
      n.distilledInsight.toLowerCase() === resolvedInsight.toLowerCase()
  );

  let trainedNeuron: MemoryNeuron;
  if (existingNeuron) {
    existingNeuron.strength = Math.min(5.0, +(existingNeuron.strength + 0.5).toFixed(2));
    existingNeuron.distilledInsight = resolvedInsight;
    existingNeuron.timestamp = Date.now();
    existingNeuron.category = 'entity_context';
    trainedNeuron = existingNeuron;
  } else {
    const newId = `neuron-chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    trainedNeuron = {
      id: newId,
      title: resolvedTitle || 'Entity Context Neuron',
      chunkText: `${lastUserQuestion ? `Context Inquiry: "${lastUserQuestion}" → ` : ''}${rawMsg}`,
      distilledInsight: resolvedInsight,
      keyPhrases:
        resolvedPhrases.length > 0
          ? resolvedPhrases.slice(0, 5)
          : [resolvedTitle.toLowerCase()],
      synapses: ['neuron-second-brain-vault', 'neuron-qwen-local-bridge'],
      strength: 2.3,
      sourceTab: 'Second Brain Entity Index',
      timestamp: Date.now(),
      category: 'entity_context',
      retentionDepth: 100,
      fullSentences: [resolvedInsight]
    };
    kb.neurons.unshift(trainedNeuron);
  }

  // Add a relational triplet if we learned subject -> is -> object
  if (learnedSubjectForTriplet && learnedObjectForTriplet) {
    if (!Array.isArray(kb.triplets)) kb.triplets = [];
    kb.triplets.unshift({
      subject: learnedSubjectForTriplet,
      relation: 'is',
      object: learnedObjectForTriplet,
      lineNumber: 0,
      confidence: 1.0
    });
  }

  saveNeuralKnowledgeBase(kb);
  const newIq = kb.comprehensionIq || 116;
  const iqGain = Math.max(2, newIq - prevIq);

  return {
    trainedNeuron,
    newFact: createdFact,
    iqGain
  };
}

/**
 * Extracts declarative facts and updates vocabulary & concepts from user notes or crawled texts.
 */
export function feedContextToBrain(
  kb: NeuralKnowledgeBase,
  text: string,
  source: 'user_prompt' | 'tab_crawl' | 'conversation'
): { newFacts: MemoryFact[]; learnedTerms: string[] } {
  if (!text || text.trim().length === 0) return { newFacts: [], learnedTerms: [] };

  const clean = text.trim();
  const sentences = clean.split(/(?<=[.?!])\s+/).filter((s) => s.length >= 8);
  const newFacts: MemoryFact[] = [];
  const learnedTerms: string[] = [];

  sentences.forEach((sent) => {
    const trimmed = sent.trim();
    const isQuestion =
      trimmed.endsWith('?') ||
      /^(what|why|how|who|where|when|which|can you|could you|do you|does|is this|tell me|explain|summarize)\b/i.test(
        trimmed
      );
    if (isQuestion) return;

    const isPreference =
      /(i want|i prefer|i like|i need|always|never|make sure|remember that|my project|my friend|my name|my favorite)/i.test(
        trimmed
      );
    const isDefinition =
      /(is a|is my|means|defined as|refers to|stands for|introduces|achieves|sustains)/i.test(trimmed);
    const isFactual =
      /(should|must|will|created|designed|built|because|therefore|reduces|processes)/i.test(
        trimmed
      );

    if (
      isPreference ||
      isDefinition ||
      isFactual ||
      (source !== 'conversation' && trimmed.length >= 25 && trimmed.length < 240)
    ) {
      const exists = kb.facts.some((f) => f.content.toLowerCase() === trimmed.toLowerCase());
      if (!exists) {
        const fact: MemoryFact = {
          id: `fact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          content: trimmed,
          category: isPreference ? 'preference' : isDefinition ? 'domain_knowledge' : 'user_note',
          confidence: isPreference ? 1.0 : 0.9,
          timestamp: Date.now(),
          source
        };
        kb.facts.unshift(fact);
        newFacts.push(fact);
      }
    }
  });

  if (kb.facts.length > 160) {
    kb.facts = kb.facts.slice(0, 160);
  }

  const tokens = (clean.toLowerCase().match(/\b[a-z0-9_-]{3,}\b/g) || []).filter(
    (w) =>
      ![
        'the', 'and', 'for', 'that', 'this', 'with', 'from', 'are', 'was', 'were',
        'what', 'why', 'how', 'who', 'where', 'when', 'can', 'you', 'your', 'like'
      ].includes(w)
  );

  tokens.forEach((token, idx) => {
    kb.learnedVocabulary[token] = (kb.learnedVocabulary[token] || 0) + 1;

    if (kb.learnedVocabulary[token] >= 2) {
      if (!kb.concepts[token]) {
        kb.concepts[token] = {
          term: token,
          frequency: 1,
          weight: 1.0,
          associatedTerms: [],
          lastSeen: Date.now()
        };
        learnedTerms.push(token);
      } else {
        kb.concepts[token].frequency += 1;
        kb.concepts[token].weight = Math.min(3.5, kb.concepts[token].weight + 0.05);
        kb.concepts[token].lastSeen = Date.now();
      }

      const neighbors = tokens.slice(Math.max(0, idx - 2), Math.min(tokens.length, idx + 3));
      neighbors.forEach((neighbor) => {
        if (neighbor !== token && !kb.concepts[token].associatedTerms.includes(neighbor)) {
          if (kb.concepts[token].associatedTerms.length < 8) {
            kb.concepts[token].associatedTerms.push(neighbor);
          }
        }
      });
    }
  });

  saveNeuralKnowledgeBase(kb);
  return { newFacts, learnedTerms };
}

/**
 * Exports SPIDAR's Second Brain as a Portable AI Graph JSON (nodes + explicit synaptic edges + deep-read sentences)
 * ready to load into external AI projects, LangChain/LlamaIndex, or custom agents.
 */
export function exportKnowledgeBaseJSON(kb: NeuralKnowledgeBase): string {
  const neurons = kb.neurons || [];
  const neuronMap = new Map(neurons.map((n) => [n.id, n.title]));
  const edges: { source: string; target: string; sourceTitle: string; targetTitle: string; weight: number }[] = [];

  neurons.forEach((n) => {
    (n.synapses || []).forEach((synId) => {
      const targetNeuron = neurons.find((other) => other.id === synId || other.title === synId);
      if (targetNeuron) {
        edges.push({
          source: n.id,
          target: targetNeuron.id,
          sourceTitle: n.title,
          targetTitle: targetNeuron.title,
          weight: Number(((n.strength + targetNeuron.strength) / 2).toFixed(2))
        });
      }
    });
  });

  const portablePayload = {
    schema: 'spidar-portable-second-brain/v2.6',
    exportedAt: new Date().toISOString(),
    compatibility: ['OpenAI', 'Qwen-2.5', 'Claude', 'Gemini', 'OpenRouter', 'LangChain', 'LlamaIndex', 'Markdown Graph'],
    version: kb.version,
    appletId: kb.appletId,
    manuallyReadTabs: kb.manuallyReadTabs || [],
    graphTopology: {
      nodeCount: neurons.length,
      synapticEdgeCount: edges.length,
      nodes: neurons.map((n) => ({
        id: n.id,
        title: n.title,
        category: n.category || 'manual_deep_read',
        retentionDepth: n.retentionDepth || 98,
        distilledInsight: n.distilledInsight,
        verbatimChunk: n.chunkText,
        fullSentences: n.fullSentences || [n.chunkText],
        metrics: n.metrics || [],
        keyPhrases: n.keyPhrases,
        wikiLinks: (n.synapses || []).map((s) => `[[${neuronMap.get(s) || s}]]`),
        sourceTab: n.sourceTab,
        strength: n.strength
      })),
      edges
    },
    neurons: kb.neurons,
    facts: kb.facts,
    triplets: kb.triplets,
    concepts: kb.concepts,
    userPreferences: kb.userPreferences,
    learnedVocabulary: kb.learnedVocabulary
  };

  return JSON.stringify(portablePayload, null, 2);
}

/**
 * Exports SPIDAR's Second Brain as a Connected Markdown Knowledge Vault (.md)
 * featuring YAML frontmatter, [[WikiLinks]] between neurons, full deep-read passages, and entity context.
 */
export function exportMarkdownDossier(kb: NeuralKnowledgeBase): string {
  const neurons = kb.neurons || [];
  const neuronMap = new Map(neurons.map((n) => [n.id, n.title]));
  const topConcepts = Object.values(kb.concepts)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 15);

  const neuronsSection = neurons
    .slice(0, 30)
    .map((n, i) => {
      const wikiLinks = (n.synapses || [])
        .map((s) => `[[${neuronMap.get(s) || s}]]`)
        .join(' • ');
      const categoryLabel = (n.category || 'manual_deep_read').toUpperCase();
      const metricsLine =
        n.metrics && n.metrics.length > 0 ? `\n- **Retained Metrics:** \`${n.metrics.join('`, `')}\`` : '';
      return `### ${i + 1}. [[${n.title}]] (${categoryLabel} • ${n.retentionDepth || 98}% Retention • Strength ${n.strength}x)
- **Source Context:** ${n.sourceTab}
- **Distilled Insight:** ${n.distilledInsight}
- **Full Verbatim Passage:** "${n.chunkText}"${metricsLine}
- **Key Phrases:** ${n.keyPhrases.map((kp) => `#${kp.replace(/\s+/g, '_')}`).join(' ')}
- **Synaptic WikiLinks:** ${wikiLinks || '[[Second Brain Neural Graph Architecture]]'}`;
    })
    .join('\n\n');

  const tripletsSection = (kb.triplets || [])
    .slice(0, 20)
    .map(
      (t, i) =>
        `${i + 1}. **[[${t.subject}]]** → *${t.relation}* → **[[${t.object}]]** *(Line ${t.lineNumber})*`
    )
    .join('\n');

  return `---
brain_schema: spidar-second-brain-v2.7
generated_at: ${new Date().toISOString()}
total_neurons: ${neurons.length}
manually_read_tabs: ${JSON.stringify(kb.manuallyReadTabs || [])}
tags: [spidar-second-brain, neural-graph, portable-ai-memory]
---

# SPIDAR Second Brain & Intelligence Dossier (Neural Graph)
**Generated:** ${new Date().toISOString()}
**Second Brain Neurons:** ${neurons.length} | **Facts:** ${kb.facts.length} | **Triplets:** ${(kb.triplets || []).length}

---

## 1. Interconnected Second Brain Neurons (Neural Graph Nodes)
${neuronsSection || 'No chunk neurons captured yet.'}

---

## 2. Relational Knowledge Triplets (Subject → Relation → Object)
${tripletsSection || 'No article triplets extracted yet.'}

---

## 3. Core Learned Facts & Entity Context
${kb.facts
  .map(
    (f, i) =>
      `${i + 1}. **[${f.category.toUpperCase()}]** ${f.content} *(Confidence: ${Math.round(
        f.confidence * 100
      )}%)*`
  )
  .join('\n')}

---

## 4. High-Salience Concept Graph
${topConcepts
  .map(
    (c) =>
      `- **#${c.term}** (Freq: ${c.frequency}, Weight: ${c.weight.toFixed(2)})\n  *Connected Terms:* ${
        c.associatedTerms.map((t) => `[[${t}]]`).join(', ') || 'None'
      }`
  )
  .join('\n\n')}

---
*Extracted from SPIDAR Second Brain Vault for portable use in external AI projects.*
`;
}

/**
 * Exports a ready-to-paste Universal AI System Prompt / Context Injection bundle
 * so any external LLM, coding assistant, or AI project immediately inherits SPIDAR's Second Brain.
 */
export function exportSystemPromptContext(kb: NeuralKnowledgeBase): string {
  const neurons = kb.neurons || [];
  const neuronMap = new Map(neurons.map((n) => [n.id, n.title]));

  const deepReadNeurons = neurons.filter((n) => n.category === 'manual_deep_read' || !n.category);
  const entityNeurons = neurons.filter((n) => n.category === 'entity_context');

  const entityBlock = entityNeurons
    .map((n) => `- [${n.title}]: ${n.distilledInsight}`)
    .join('\n');

  const deepReadBlock = deepReadNeurons
    .slice(0, 18)
    .map((n) => {
      const links = (n.synapses || []).map((s) => neuronMap.get(s) || s).slice(0, 3).join(', ');
      return `- Neuron [[${n.title}]] (Source: ${n.sourceTab} | Connected: ${links || 'Core Graph'}):\n  Insight: ${n.distilledInsight}\n  Verbatim Memory: "${n.chunkText}"`;
    })
    .join('\n');

  const factsList = kb.facts.slice(0, 20).map((f) => `- ${f.content}`).join('\n');
  const tripletsList = (kb.triplets || [])
    .slice(0, 15)
    .map((t) => `- ${t.subject} -> ${t.relation} -> ${t.object}`)
    .join('\n');

  return `<!-- SPIDAR SECOND BRAIN INJECTION BUNDLE -->
<second_brain_context version="${kb.version}" neurons="${neurons.length}">
You are equipped with an extracted SPIDAR Second Brain Knowledge Graph. Use the following persistent neurons, deep-read passages, entity context, and relational triplets as ground-truth memory across this project:

# 1. Indexed People, Friends, & Entity Context Nodes:
${entityBlock || '- None indexed yet.'}

# 2. Second Brain Memory Neurons & Manually Read Passages (${neurons.length} Nodes):
${deepReadBlock}

# 3. Learned User Context & Declarative Facts:
${factsList}

# 4. Extracted Relational Triplets:
${tripletsList}
</second_brain_context>`;
}

/**
 * Browser helper to trigger a 1-click file download of the extracted Second Brain
 */
export function downloadExtractedBrainFile(
  kb: NeuralKnowledgeBase,
  format: 'json' | 'markdown' | 'prompt'
): void {
  if (typeof window === 'undefined') return;
  const content =
    format === 'json'
      ? exportKnowledgeBaseJSON(kb)
      : format === 'markdown'
      ? exportMarkdownDossier(kb)
      : exportSystemPromptContext(kb);

  const ext = format === 'json' ? 'spidar-brain.json' : format === 'markdown' ? 'neural-vault.md' : 'ai-brain-prompt.txt';
  const mime = format === 'json' ? 'application/json' : 'text/plain;charset=utf-8';
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spidar-extracted-${ext}`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}
