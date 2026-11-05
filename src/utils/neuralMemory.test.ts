import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultKnowledgeBase,
  feedContextToBrain,
  ingestLineContextToBrain,
  ingestChunkAsNeuron,
  ingestFullDocumentManualRead,
  findRelevantNeurons,
  findDuplicateNeuron,
  updateMemoryNeuron,
  connectNeuronsWithRelation,
  removeNeuronConnection,
  trainSpidarFromChatTurn,
  exportKnowledgeBaseJSON,
  exportMarkdownDossier,
  exportSystemPromptContext
} from './neuralMemory';
import { analyzeContextualLines } from './spiderCrawlEngine';
import { answerQuestionLocal } from './localNLP';

test('createDefaultKnowledgeBase creates initialized v2.7 knowledge structure with Second Brain neurons', () => {
  const kb = createDefaultKnowledgeBase();
  assert.equal(kb.version, '2.7.0');
  assert.ok(kb.facts.length >= 2);
  assert.ok(kb.neurons.length >= 4);
  assert.ok(Object.keys(kb.concepts).length >= 2);
});

test('ingestChunkAsNeuron detects duplicates, merges near-duplicates, and stores sequential synapses', () => {
  const kb = createDefaultKnowledgeBase();
  const initialCount = kb.neurons.length;
  const neuron = ingestChunkAsNeuron(
    kb,
    'Benchmark telemetry across 14,000 production workloads demonstrates that progressive line-context extraction paired with Qwen-2.5 achieves 94% parity.',
    'Benchmark Tab',
    'Qwen Benchmark Chunk'
  );
  assert.ok(neuron !== null);
  assert.equal(kb.neurons.length, initialCount + 1);
  assert.equal(neuron?.title, 'Qwen Benchmark Chunk');
  assert.equal(neuron?.retentionDepth, 98);
  assert.ok((neuron?.metrics || []).includes('94%'));

  // Near-duplicate ingestion should merge into existing node instead of creating a duplicate
  const duplicateDetected = findDuplicateNeuron(
    kb,
    'Qwen Benchmark Chunk',
    'Benchmark telemetry across 14,000 production workloads demonstrates that progressive line-context extraction paired with Qwen-2.5 achieves 94% parity.'
  );
  assert.ok(duplicateDetected !== null);
  assert.equal(duplicateDetected?.id, neuron?.id);

  const countBeforeMerge = kb.neurons.length;
  const merged = ingestChunkAsNeuron(
    kb,
    'Benchmark telemetry across 14,000 production workloads demonstrates that progressive line-context extraction paired with Qwen-2.5 achieves 94% parity.',
    'Benchmark Tab',
    'Qwen Benchmark Chunk'
  );
  assert.equal(kb.neurons.length, countBeforeMerge);
  assert.equal(merged?.id, neuron?.id);

  const docParagraphs = [
    'First paragraph detailing 120,000 events per second throughput in Rust.',
    'Second paragraph explaining sub-15ms p99 latency across edge nodes.'
  ];
  const docNeurons = ingestFullDocumentManualRead(kb, 'Project Titan Spec', docParagraphs, []);
  assert.equal(docNeurons.length, 2);
  assert.ok((kb.manuallyReadTabs || []).includes('Project Titan Spec'));
  assert.ok(docNeurons[0].synapses.includes(docNeurons[1].id));

  const relevant = findRelevantNeurons(kb, 'What does the benchmark telemetry show?', 2);
  assert.ok(relevant.length > 0);

  // Unrelated query must return [] rather than injecting unrelated fallback nodes
  const unrelated = findRelevantNeurons(kb, 'How do I bake sourdough bread at home?', 3);
  assert.equal(unrelated.length, 0);
});

test('updateMemoryNeuron and connectNeuronsWithRelation edit nodes and wire typed synapse edges', () => {
  const kb = createDefaultKnowledgeBase();
  const target = kb.neurons[0];
  const partner = kb.neurons[1];

  const updated = updateMemoryNeuron(kb, target.id, {
    title: 'Updated Core Architecture Node',
    distilledInsight: 'Custom distilled synthesis verified by user.'
  });
  assert.ok(updated !== null);
  assert.equal(updated?.title, 'Updated Core Architecture Node');
  assert.equal(updated?.distilledInsight, 'Custom distilled synthesis verified by user.');

  const linked = connectNeuronsWithRelation(kb, target.id, partner.id, 'supports', 'Verified supporting relationship');
  assert.equal(linked, true);
  assert.ok(target.synapses.includes(partner.id));
  assert.ok((target.synapseEdges || []).some(e => e.targetId === partner.id && e.relation === 'supports'));

  const removed = removeNeuronConnection(kb, target.id, partner.id);
  assert.equal(removed, true);
  assert.equal(target.synapses.includes(partner.id), false);
});

test('feedContextToBrain extracts declarative facts and ignores questions so chat never echoes', () => {
  const kb = createDefaultKnowledgeBase();
  const initialFactCount = kb.facts.length;

  const qResult = feedContextToBrain(kb, 'What does this article say about latency?', 'conversation');
  assert.equal(qResult.newFacts.length, 0);
  assert.equal(kb.facts.length, initialFactCount);

  const inputContext = `I prefer the spider to crawl downward instead of left to right. Neural training should accelerate when feeding contextual notes.`;
  const result = feedContextToBrain(kb, inputContext, 'user_prompt');
  assert.ok(result.newFacts.length >= 1);
  assert.ok(kb.learnedVocabulary['downward'] !== undefined);
});

test('trainSpidarFromChatTurn never treats a bare name as user self-identity, and indexes entity context after clarification', () => {
  const kb = createDefaultKnowledgeBase();

  // 1. Bare name input alone does NOT train a self-name neuron
  const bareAttempt = trainSpidarFromChatTurn(kb, 'Mateo Silva', [], null);
  assert.equal(bareAttempt.trainedNeuron, null);

  // 2. When the user clarifies on the next turn ("It's my friend dude"), it wires an entity_context neuron for Mateo Silva
  const history = [
    { role: 'user', content: 'Mateo Silva' },
    { role: 'assistant', content: 'Could you clarify the context for Mateo Silva?' }
  ];
  const trained = trainSpidarFromChatTurn(kb, "It's my friend dude", history, null);
  assert.ok(trained.trainedNeuron !== null);
  assert.ok(trained.trainedNeuron!.title.includes('Mateo Silva'));
  assert.equal(trained.trainedNeuron!.category, 'entity_context');
  assert.ok(trained.trainedNeuron!.distilledInsight.toLowerCase().includes('friend'));
  assert.ok(trained.iqGain >= 2);

  // 3. Even when chat history is cleared ([]), the Second Brain recalls Mateo Silva independently!
  const recall = answerQuestionLocal('Mateo Silva', 'Unrelated page text.', kb.facts, kb.neurons, []);
  assert.ok(recall.answer.toLowerCase().includes('friend'));
  assert.ok(recall.answer.includes('Mateo Silva'));

  // 4. Direct lowercase name teaching ("sora takahashi is my coworker type shi")
  const directTrained = trainSpidarFromChatTurn(kb, 'sora takahashi is my coworker type shi', [], null);
  assert.ok(directTrained.trainedNeuron !== null);
  assert.ok(directTrained.trainedNeuron!.title.includes('Sora Takahashi'));
});

test('ingestLineContextToBrain extracts relational triplets as spider crawls lines', () => {
  const kb = createDefaultKnowledgeBase();
  const lines = analyzeContextualLines([
    `SPIDAR v2.5 introduces a biomimetic downward web-crawler architecture that centralizes scroll.`
  ]);
  const res = ingestLineContextToBrain(kb, lines[0]);
  assert.ok(res.iqDelta >= 1);
  assert.ok(kb.totalLinesAnalyzed >= 1);
});

test('export functions generate valid Portable Graph JSON, WikiLink Markdown, and Universal System Prompt', () => {
  const kb = createDefaultKnowledgeBase();
  kb.facts.push({
    id: 'f-test',
    content: 'User requires BaseURL and model selector for OpenAI compatible API.',
    category: 'preference',
    confidence: 1.0,
    timestamp: Date.now(),
    source: 'user_prompt'
  });

  const jsonStr = exportKnowledgeBaseJSON(kb);
  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.schema, 'spidar-portable-second-brain/v2.6');
  assert.ok(parsed.graphTopology.nodeCount >= 4);
  assert.ok(parsed.facts.some((f: any) => f.id === 'f-test'));

  const mdStr = exportMarkdownDossier(kb);
  assert.ok(mdStr.includes('# SPIDAR Second Brain & Intelligence Dossier (Neural Graph)'));
  assert.ok(mdStr.includes('[[Second Brain Neural Graph Architecture]]'));
  assert.ok(mdStr.includes('OpenAI compatible API'));

  const promptStr = exportSystemPromptContext(kb);
  assert.ok(promptStr.includes('<!-- SPIDAR SECOND BRAIN INJECTION BUNDLE -->'));
  assert.ok(promptStr.includes('OpenAI compatible API'));
});

