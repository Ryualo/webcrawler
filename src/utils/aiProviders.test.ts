import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getProviderDefinition,
  getDefaultModelsForProvider,
  getModelCapabilityInfo,
  searchModelsWithCapabilities,
  createDefaultProfileForProvider,
  classifyApiError
} from './aiProviders';

test('getProviderDefinition and createDefaultProfileForProvider initialize valid isolated provider profiles including qwen-free', () => {
  const compatDef = getProviderDefinition('openai-compatible');
  assert.equal(compatDef.label, 'OpenAI Compatible');
  assert.equal(compatDef.supportsAzureOptions, true);
  assert.equal(compatDef.supportsCustomHeaders, true);

  const qwenFreeDef = getProviderDefinition('qwen-free');
  assert.equal(qwenFreeDef.requiresApiKey, false);
  const qwenFreeProfile = createDefaultProfileForProvider('qwen-free');
  assert.equal(qwenFreeProfile.provider, 'qwen-free');
  assert.equal(qwenFreeProfile.selectedModel, 'qwen2.5-72b-instruct-free');

  const geminiProfile = createDefaultProfileForProvider('gemini');
  assert.equal(geminiProfile.provider, 'gemini');
  assert.equal(geminiProfile.selectedModel, 'gemini-3.8-flash');
  assert.equal(geminiProfile.reasoningEffort, 'medium');
  assert.equal(geminiProfile.streamingEnabled, true);

  const anthropicModels = getDefaultModelsForProvider('anthropic');
  assert.ok(anthropicModels.includes('claude-3-7-sonnet-latest'));
});

test('searchModelsWithCapabilities enriches models with context window, capabilities, and pricing and filters by query', () => {
  const models = getDefaultModelsForProvider('openrouter');
  const results = searchModelsWithCapabilities(models, 'openrouter', 'qwen');
  assert.ok(results.length >= 2);
  assert.ok(results.some(r => r.id === 'qwen/qwen-2.5-72b-instruct:free'));
  assert.ok(results[0].contextWindow >= 128000);
  assert.equal(results[0].supportsStreaming, true);
  assert.ok(typeof results[0].inputPricePerMillion === 'number');

  const customInfo = getModelCapabilityInfo('custom-deepseek-r1-distill', 'openai-compatible');
  assert.equal(customInfo.supportsReasoning, true);
});

test('classifyApiError accurately categorizes invalid keys, rate limits, unavailable models, and connection failures', () => {
  const keyErr = classifyApiError(401, 'Incorrect API key provided');
  assert.equal(keyErr.code, 'invalid_key');

  const rateErr = classifyApiError(429, 'RESOURCE_EXHAUSTED: Quota exceeded');
  assert.equal(rateErr.code, 'rate_limit');

  const modelErr = classifyApiError(404, 'The model gpt-99 does not exist');
  assert.equal(modelErr.code, 'model_unavailable');

  const netErr = classifyApiError(502, 'ECONNREFUSED 127.0.0.1:11434');
  assert.equal(netErr.code, 'connection_error');
});

import {
  classifyPromptWorkflow,
  selectRelevantWebpageContext
} from './performanceWorker';

test('classifyPromptWorkflow separates simple greetings from webpage analysis and deep research', () => {
  assert.equal(classifyPromptWorkflow('hello'), 'conversational');
  assert.equal(classifyPromptWorkflow('Hi there!'), 'conversational');
  assert.equal(classifyPromptWorkflow('how are you doing?'), 'conversational');
  assert.equal(classifyPromptWorkflow('Summarize the main thesis of this article'), 'webpage_analysis');
  assert.equal(classifyPromptWorkflow('Search the web for latest 2026 benchmarks'), 'deep_research');
  assert.equal(classifyPromptWorkflow('Check https://example.com/paper'), 'deep_research');
});

test('selectRelevantWebpageContext prunes large article text to the most relevant paragraphs', () => {
  const paragraphs = [
    'Introduction thesis paragraph about SPIDAR neural architecture and cognitive compression.',
    'Unrelated background paragraph about historical typography and printing presses in Europe.',
    'Detailed section on arachnid kinematics, tetrapod gait stepping, and 60fps Canvas rendering.',
    'Another unrelated paragraph discussing culinary recipes and seasonal ingredients.'
  ].join('\n\n');

  const pruned = selectRelevantWebpageContext(paragraphs, 'How does tetrapod gait stepping work?', 220);
  assert.ok(pruned.includes('tetrapod gait stepping'));
  assert.ok(!pruned.includes('culinary recipes'));
});

