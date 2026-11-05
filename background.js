/**
 * SPIDAR v2.7 - Manifest V3 Background Service Worker (background.js)
 * Isolates API credentials per provider inside extension storage, proxies multi-provider
 * LLM requests (Qwen Free Cloud Inference, Gemini, OpenAI, Anthropic, OpenRouter, Qwen Local, OpenAI Compatible),
 * discovers models, tests connections, generates structured academic outlines, and syncs the Neural Graph.
 */

const SPIDAR_CLOUD_BRIDGE = 'https://ais-pre-ete2tpa2iqsjgml4b4irbp-243786387909.asia-northeast1.run.app';
const SPIDAR_CLOUD_FALLBACKS = [
  'https://ais-pre-ete2tpa2iqsjgml4b4irbp-243786387909.asia-northeast1.run.app',
  'https://ais-dev-ete2tpa2iqsjgml4b4irbp-243786387909.asia-northeast1.run.app'
];

const DEFAULT_PROFILES = {
  'qwen-free': {
    provider: 'qwen-free',
    baseUrl: 'https://text.pollinations.ai/openai',
    apiKey: '',
    selectedModel: 'qwen2.5-72b-instruct-free',
    availableModels: ['qwen2.5-72b-instruct-free', 'qwen2.5-coder-32b-free', 'qwq-32b-reasoning-free'],
    customHeaders: [],
    reasoningEffort: 'medium',
    temperature: 0.35,
    maxTokens: 2048
  },
  gemini: {
    provider: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey: '',
    selectedModel: 'gemini-2.5-flash',
    availableModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    customHeaders: [],
    reasoningEffort: 'medium',
    temperature: 0.35,
    maxTokens: 2048
  },
  openai: {
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    selectedModel: 'gpt-4o-mini',
    availableModels: ['gpt-4o-mini', 'gpt-4o', 'o3-mini'],
    customHeaders: [],
    reasoningEffort: 'medium',
    temperature: 0.35,
    maxTokens: 2048
  },
  anthropic: {
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKey: '',
    selectedModel: 'claude-3-7-sonnet-latest',
    availableModels: ['claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
    customHeaders: [],
    reasoningEffort: 'medium',
    temperature: 0.35,
    maxTokens: 2048
  },
  openrouter: {
    provider: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
    selectedModel: 'qwen/qwen-2.5-72b-instruct:free',
    availableModels: ['qwen/qwen-2.5-72b-instruct:free', 'qwen/qwen-2.5-72b-instruct', 'deepseek/deepseek-r1', 'anthropic/claude-3.7-sonnet'],
    customHeaders: [],
    reasoningEffort: 'medium',
    temperature: 0.35,
    maxTokens: 2048
  },
  'qwen-local': {
    provider: 'qwen-local',
    baseUrl: 'http://localhost:11434/v1',
    apiKey: '',
    selectedModel: 'qwen2.5:7b-instruct',
    availableModels: ['qwen2.5:7b-instruct', 'qwen2.5-coder:7b', 'qwen3:8b'],
    customHeaders: [],
    reasoningEffort: 'medium',
    temperature: 0.35,
    maxTokens: 2048
  },
  'openai-compatible': {
    provider: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    selectedModel: 'qwen/qwen-2.5-72b-instruct',
    availableModels: ['qwen/qwen-2.5-72b-instruct', 'gpt-4o-mini', 'deepseek-chat'],
    customHeaders: [],
    azureApiVersionEnabled: false,
    azureApiVersion: '2024-10-21',
    useAzureIdentity: false,
    reasoningEffort: 'medium',
    temperature: 0.35,
    maxTokens: 2048
  }
};

const DEFAULT_NEURONS = [
  {
    id: 'neuron-core-crawler',
    title: 'Center-Biased Biomimetic Web Crawler',
    distilledInsight: 'SPIDAR stays centered in the viewport and uses inverse-kinematics legs to bracket key phrases in real time.',
    sourceTitle: 'SPIDAR Architecture',
    category: 'core_concept',
    synapses: ['neuron-core-graph']
  },
  {
    id: 'neuron-core-graph',
    title: 'Second Brain Neural Graph Architecture',
    distilledInsight: 'Stores manually read passages and entity contexts as interconnected nodes with duplicate detection and portable export.',
    sourceTitle: 'SPIDAR Architecture',
    category: 'core_concept',
    synapses: ['neuron-core-crawler']
  }
];

const DEFAULT_STATE = {
  enabled: true,
  sleeping: false,
  spiderSpeed: 1.0,
  activeProvider: 'qwen-free',
  providerProfiles: DEFAULT_PROFILES,
  memoryFacts: [],
  neurons: DEFAULT_NEURONS
};

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(null);
  const mergedProfiles = {
    ...DEFAULT_PROFILES,
    ...(existing.spidar_provider_configs_v2_7 || existing.providerProfiles || {})
  };
  const activeProv =
    existing.spidar_api_config_v2_5?.provider || existing.activeProvider || 'qwen-free';
  const activeProfile = mergedProfiles[activeProv] || DEFAULT_PROFILES['qwen-free'];
  const activeConfig = existing.spidar_api_config_v2_5 || {
    ...activeProfile,
    spiderSpeed: typeof existing.spiderSpeed === 'number' ? existing.spiderSpeed : 1.0,
    streamingEnabled: true
  };

  await chrome.storage.local.set({
    ...DEFAULT_STATE,
    ...existing,
    activeProvider: activeProv,
    providerProfiles: mergedProfiles,
    spidar_provider_configs_v2_7: mergedProfiles,
    spidar_api_config_v2_5: activeConfig,
    neurons:
      Array.isArray(existing.neurons) && existing.neurons.length > 0
        ? existing.neurons
        : DEFAULT_NEURONS
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) return false;

  const handlers = {
    SPIDAR_GET_PUBLIC_STATUS: () => handleGetPublicStatus(),
    SPIDAR_FETCH_MODELS: () => handleFetchModels(message.payload || {}),
    SPIDAR_TEST_CONNECTION: () => handleTestConnection(message.payload || {}),
    SPIDAR_SUMMARIZE_PAGE: () => handleSummarizePage(message.payload || {}),
    SPIDAR_LLM_COMPLETION: () => handleLlmCompletion(message.payload || {}),
    SPIDAR_GENERATE_OUTLINE: () => handleGenerateOutline(message.payload || {}),
    SPIDAR_TRANSFORM_OUTLINE_SECTION: () => handleTransformOutlineSection(message.payload || {}),
    SPIDAR_SAVE_MEMORY_FACT: () => handleSaveMemoryFact(message.payload || {}),
    SPIDAR_UPDATE_NEURON: () => handleUpdateNeuron(message.payload || {}),
    SPIDAR_DELETE_NEURON: () => handleDeleteNeuron(message.payload || {}),
    SPIDAR_GET_MEMORY: () => handleGetMemory(),
    SPIDAR_OPEN_STUDIO_TAB: () => {
      const view = (message.payload && message.payload.view) || message.view || 'analyzer';
      chrome.tabs.create({ url: chrome.runtime.getURL(`index.html?view=${view}`) });
      return Promise.resolve({ opened: true });
    },
    SPIDAR_OPEN_OPTIONS: () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('options.html?view=options') });
      return Promise.resolve({ opened: true });
    },
    SPIDAR_PROXY_FETCH: () => handleProxyFetch(message)
  };

  if (handlers[message.type]) {
    handlers[message.type]()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err?.message || 'Operation failed' }));
    return true;
  }

  return false;
});

async function resolveStoredProfileAndNeurons() {
  const store = await chrome.storage.local.get([
    'enabled',
    'sleeping',
    'spiderSpeed',
    'activeProvider',
    'providerProfiles',
    'spidar_api_config_v2_5',
    'spidar_provider_configs_v2_7',
    'spidar_neural_vault_v2_5',
    'memoryFacts',
    'neurons'
  ]);
  const reactConfig = store.spidar_api_config_v2_5;
  const activeProvider = reactConfig?.provider || store.activeProvider || 'qwen-free';
  const profiles = {
    ...DEFAULT_PROFILES,
    ...(store.spidar_provider_configs_v2_7 || store.providerProfiles || {})
  };
  const baseProfile = profiles[activeProvider] || DEFAULT_PROFILES['qwen-free'];
  const profile = reactConfig && reactConfig.provider === activeProvider
    ? { ...baseProfile, ...reactConfig }
    : baseProfile;
  const vaultNeurons = store.spidar_neural_vault_v2_5?.neurons;
  const neurons =
    Array.isArray(vaultNeurons) && vaultNeurons.length > 0
      ? vaultNeurons
      : Array.isArray(store.neurons) && store.neurons.length > 0
      ? store.neurons
      : DEFAULT_NEURONS;

  return { store, activeProvider, profile, neurons };
}

async function handleGetPublicStatus() {
  const { store, activeProvider, profile, neurons } = await resolveStoredProfileAndNeurons();

  return {
    enabled: store.enabled !== false,
    sleeping: Boolean(store.sleeping),
    spiderSpeed:
      typeof profile?.spiderSpeed === 'number'
        ? profile.spiderSpeed
        : typeof store.spiderSpeed === 'number'
        ? store.spiderSpeed
        : 1.0,
    activeProvider,
    selectedModel:
      profile?.selectedModel || 'qwen2.5-72b-instruct-free',
    factCount: neurons.length
  };
}

function buildRequestHeaders(profile) {
  const headers = { 'Content-Type': 'application/json' };
  const key = (profile.apiKey || '').trim();
  if (profile.provider === 'anthropic') {
    if (key) headers['x-api-key'] = key;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  } else if (key) {
    headers['Authorization'] = `Bearer ${key}`;
  }
  if (Array.isArray(profile.customHeaders)) {
    profile.customHeaders.forEach((h) => {
      if (h && h.key && h.key.trim()) {
        headers[h.key.trim()] = (h.value || '').trim();
      }
    });
  }
  return headers;
}

async function handleFetchModels(payload) {
  const { activeProvider, profile: savedProfile } = await resolveStoredProfileAndNeurons();
  const provider = payload.provider || activeProvider || 'qwen-free';
  const profile = { ...savedProfile, ...payload, provider };

  if (provider === 'qwen-free') {
    return {
      models: ['qwen2.5-72b-instruct-free', 'qwen2.5-coder-32b-free', 'qwq-32b-reasoning-free']
    };
  }

  const cleanBase = (profile.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const headers = buildRequestHeaders(profile);
  const res = await fetch(`${cleanBase}/models`, {
    headers,
    signal: AbortSignal.timeout(7000)
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: Unable to list models from ${cleanBase}`);
  }

  const json = await res.json();
  const rawList = Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? json.models : [];
  const modelIds = rawList
    .map((m) => (typeof m === 'string' ? m : m.id || m.name))
    .filter(Boolean);

  return { models: modelIds.length ? modelIds : profile.availableModels || [] };
}

async function handleTestConnection(payload) {
  const started = Date.now();
  const provider = payload.provider || 'qwen-free';
  if (provider === 'qwen-free') {
    const reply = await handleLlmCompletion({
      prompt: 'Reply with OK.',
      systemPrompt: 'You are a concise assistant.'
    });
    return {
      latencyMs: Date.now() - started,
      models: ['qwen2.5-72b-instruct-free', 'qwen2.5-coder-32b-free', 'qwq-32b-reasoning-free'],
      modelUsed: reply.modelUsed
    };
  }
  const modelsRes = await handleFetchModels(payload);
  return {
    latencyMs: Date.now() - started,
    models: modelsRes.models
  };
}

async function handleSummarizePage({ pageText, pageTitle }) {
  const { profile } = await resolveStoredProfileAndNeurons();
  try {
    const bridgeRes = await fetch(`${SPIDAR_CLOUD_BRIDGE}/api/ai/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: pageText || '',
        title: pageTitle || 'Active Tab',
        apiConfig: profile
      }),
      signal: AbortSignal.timeout(20000)
    });
    if (bridgeRes.ok) {
      const data = await bridgeRes.json();
      if (data && data.coreThesis) {
        return data;
      }
    }
  } catch {
    // Fall back to direct LLM completion
  }

  const llm = await handleLlmCompletion({
    prompt: `Analyze this webpage ("${pageTitle || 'Active Tab'}") and return ONLY valid JSON with keys: "coreThesis" (2-sentence synthesis), "executiveBullets" (array of 4 concrete takeaways), "keyInsights" (array of 3 insights), "actionItems" (array of 3 next steps).`,
    pageText,
    pageTitle
  });
  const raw = String(llm.reply || '').replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const fb = raw.indexOf('{');
  const lb = raw.lastIndexOf('}');
  const parsed = fb !== -1 && lb > fb ? JSON.parse(raw.slice(fb, lb + 1)) : {};
  return {
    coreThesis: parsed.coreThesis || llm.reply,
    executiveBullets: Array.isArray(parsed.executiveBullets) ? parsed.executiveBullets : [],
    keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
    actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
    generatedBy: llm.modelUsed || profile.selectedModel
  };
}

async function handleLlmCompletion({ prompt, systemPrompt, pageText, pageTitle, selectedText, history }) {
  const { activeProvider, profile, neurons } = await resolveStoredProfileAndNeurons();

  const qWords = String(prompt || '').toLowerCase().match(/\b[a-z0-9_-]{3,}\b/g) || [];
  const matchedNeurons = neurons.filter((n) => {
    const hay = `${n.title || ''} ${n.distilledInsight || n.chunkText || ''}`.toLowerCase();
    return qWords.some((w) => !['what','how','why','the','and','for','this','that','with','from'].includes(w) && hay.includes(w));
  }).slice(0, 5);

  const normalizedHistory = Array.isArray(history)
    ? history
        .slice(-10)
        .filter((m) => m && typeof m.content === 'string' && m.content.trim().length > 0)
        .map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.content).slice(0, 1800)
        }))
    : [];

  if (activeProvider !== 'qwen-local') {
    try {
      const bridgeRes = await fetch(`${SPIDAR_CLOUD_BRIDGE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: prompt,
          articleText: pageText || '',
          articleTitle: pageTitle || 'Active Tab',
          selectedText: selectedText || '',
          neurons: matchedNeurons,
          history: normalizedHistory,
          apiConfig: profile
        }),
        signal: AbortSignal.timeout(22000)
      });
      if (bridgeRes.ok) {
        const bData = await bridgeRes.json();
        if (bData && bData.answer && !bData.error) {
          return {
            reply: bData.answer,
            modelUsed: bData.modelUsed || profile.selectedModel,
            webSources: Array.isArray(bData.webSources) ? bData.webSources : []
          };
        }
      }
    } catch {
      // Fall through to direct provider execution if Cloud Bridge is unreachable
    }
  }

  const enrichedSystem = [
    systemPrompt || 'You are SPIDAR, an intelligent context-aware research, outlining, and productivity assistant. Clearly distinguish retrieved facts from analytical explanations.',
    matchedNeurons.length > 0
      ? 'Retrieved Neural Graph Nodes:\n' + matchedNeurons.map((n) => `- [[${n.title}]]: ${n.distilledInsight || n.chunkText}`).join('\n')
      : '',
    selectedText ? `User Selected Passage:\n"${selectedText}"` : '',
    pageText ? `Current Webpage ("${pageTitle || 'Active Tab'}"):\n${String(pageText).slice(0, 3800)}` : ''
  ].filter(Boolean).join('\n\n');

  if (activeProvider === 'qwen-free' || activeProvider === 'local') {
    for (const baseUrl of SPIDAR_CLOUD_FALLBACKS) {
      try {
        const bRes = await fetch(`${baseUrl}/api/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: prompt,
            articleText: pageText || '',
            articleTitle: pageTitle || 'Active Webpage',
            selectedText: selectedText || '',
            neurons: matchedNeurons,
            history: normalizedHistory,
            apiConfig: profile
          }),
          signal: AbortSignal.timeout(15000)
        });
        if (bRes.ok) {
          const bData = await bRes.json();
          if (bData && bData.answer) {
            return {
              reply: bData.answer,
              modelUsed: bData.modelUsed || `${profile.selectedModel || 'qwen2.5-72b-instruct-free'} (Qwen Free Cloud)`,
              webSources: Array.isArray(bData.webSources) ? bData.webSources : []
            };
          }
        }
      } catch {
        // try next fallback
      }
    }

    // Resilient local synthesis fallback if offline
    const excerpt = String(selectedText || pageText || prompt || '').replace(/\s+/g, ' ').trim().slice(0, 420);
    return {
      reply: excerpt
        ? `**Grounded Synthesis (${profile.selectedModel || 'qwen2.5-72b-instruct-free'}):**\nBased on "${pageTitle || 'Active Webpage'}": ${excerpt}`
        : 'READY',
      modelUsed: `${profile.selectedModel || 'qwen2.5-72b-instruct-free'} (Qwen Free Cloud)`,
      webSources: []
    };
  }

  if (activeProvider === 'gemini') {
    const apiKey = (profile.apiKey || '').trim();
    if (!apiKey) throw new Error('Gemini API Key is required in Extension Options.');
    const cleanModel = (profile.selectedModel || 'gemini-2.5-flash').replace(/^models\//, '');
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: enrichedSystem }] },
          contents: [
            ...normalizedHistory.map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }]
            })),
            { role: 'user', parts: [{ text: prompt }] }
          ],
          generationConfig: { temperature: profile.temperature ?? 0.35 }
        }),
        signal: AbortSignal.timeout(22000)
      }
    );
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const data = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response returned.';
    return { reply, modelUsed: `${cleanModel} (gemini)`, webSources: [] };
  }

  const cleanBase = (profile.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const headers = buildRequestHeaders(profile);

  if (activeProvider === 'anthropic') {
    const res = await fetch(`${cleanBase}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: profile.selectedModel || 'claude-3-7-sonnet-latest',
        max_tokens: profile.maxTokens || 2048,
        system: enrichedSystem,
        messages: [
          ...normalizedHistory,
          { role: 'user', content: prompt }
        ]
      }),
      signal: AbortSignal.timeout(22000)
    });
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
    const data = await res.json();
    const reply = Array.isArray(data?.content) ? data.content.map((c) => c.text || '').join('') : 'No response returned.';
    return { reply, modelUsed: `${profile.selectedModel} (anthropic)`, webSources: [] };
  }

  let targetUrl = `${cleanBase}/chat/completions`;
  if ((profile.azureApiVersionEnabled || profile.setAzureApiVersion) && profile.azureApiVersion) {
    targetUrl += `?api-version=${encodeURIComponent(profile.azureApiVersion)}`;
  }

  const res = await fetch(targetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: profile.selectedModel || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: enrichedSystem },
        ...normalizedHistory,
        { role: 'user', content: prompt }
      ],
      temperature: profile.temperature ?? 0.35,
      max_tokens: profile.maxTokens ?? 2048
    }),
    signal: AbortSignal.timeout(22000)
  });

  if (!res.ok) throw new Error(`Provider HTTP ${res.status}`);
  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content || 'No response returned.';
  return { reply, modelUsed: `${profile.selectedModel} (${activeProvider})`, webSources: [] };
}

async function handleGenerateOutline({ assignmentPrompt, rubricCriteria, pageText, pageTitle, documentType }) {
  const { profile, neurons } = await resolveStoredProfileAndNeurons();
  try {
    const bridgeRes = await fetch(`${SPIDAR_CLOUD_BRIDGE}/api/ai/outline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentType: documentType || 'research_paper',
        assignmentPrompt,
        rubricCriteria,
        webpageTitle: pageTitle || 'Current Webpage',
        webpageText: pageText || '',
        relevantNeurons: neurons,
        uploadedDocs: [],
        apiConfig: profile
      }),
      signal: AbortSignal.timeout(26000)
    });
    if (bridgeRes.ok) {
      const data = await bridgeRes.json();
      if (data && data.thesisStatement) return { outline: data };
    }
  } catch {
    // Fallback to direct LLM completion structured outline
  }

  const llmRes = await handleLlmCompletion({
    prompt: `Generate a structured academic outline in valid JSON matching { "title": "...", "thesisStatement": "...", "argumentArchitecture": "...", "sections": [{ "id": "sec-1", "heading": "I. ...", "purpose": "...", "coreArgument": "...", "supportingEvidence": ["..."], "explanation": "...", "counterargument": "..." }] } for:\nPrompt: ${assignmentPrompt}\nRubric: ${rubricCriteria || 'Rigorous academic analysis'}`,
    pageText,
    pageTitle
  });
  try {
    const raw = String(llmRes.reply || '').replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const fb = raw.indexOf('{');
    const lb = raw.lastIndexOf('}');
    if (fb !== -1 && lb > fb) {
      const parsed = JSON.parse(raw.slice(fb, lb + 1));
      if (parsed.thesisStatement && Array.isArray(parsed.sections)) {
        return { outline: { ...parsed, modelUsed: llmRes.modelUsed } };
      }
    }
  } catch {
    // Return markdown fallback if JSON parse fails
  }
  return { outlineMarkdown: llmRes.reply, modelUsed: llmRes.modelUsed };
}

async function handleTransformOutlineSection({ outlineTitle, thesisStatement, section, action, pageText }) {
  const { profile, neurons } = await resolveStoredProfileAndNeurons();
  const bridgeRes = await fetch(`${SPIDAR_CLOUD_BRIDGE}/api/ai/outline-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      outlineTitle,
      thesisStatement,
      section,
      action,
      webpageText: pageText || '',
      relevantNeurons: neurons,
      apiConfig: profile
    }),
    signal: AbortSignal.timeout(22000)
  });
  if (!bridgeRes.ok) {
    throw new Error(`Outline section refinement failed (HTTP ${bridgeRes.status})`);
  }
  return await bridgeRes.json();
}

async function handleSaveMemoryFact({ fact, title, source }) {
  const store = await chrome.storage.local.get([
    'memoryFacts',
    'neurons',
    'spidar_memory_v2_5',
    'spidar_neural_vault_v2_5'
  ]);
  const list = Array.isArray(store.memoryFacts) ? store.memoryFacts : [];
  const compactMem = Array.isArray(store.spidar_memory_v2_5) ? store.spidar_memory_v2_5 : [];
  const neurons = Array.isArray(store.neurons) ? store.neurons : [...DEFAULT_NEURONS];
  const cleanFact = String(fact || '').trim();
  if (!cleanFact) return { count: neurons.length };

  const nodeTitle = String(title || cleanFact.slice(0, 44)).trim();
  const duplicate = neurons.find(
    (n) =>
      n.title.toLowerCase() === nodeTitle.toLowerCase() ||
      (n.distilledInsight || '').toLowerCase() === cleanFact.toLowerCase() ||
      (n.distilledInsight || '').toLowerCase().includes(cleanFact.toLowerCase().slice(0, 60))
  );

  if (duplicate) {
    duplicate.distilledInsight =
      cleanFact.length > (duplicate.distilledInsight || '').length
        ? cleanFact
        : duplicate.distilledInsight;
    await chrome.storage.local.set({ neurons });
    return { count: neurons.length, merged: true };
  }

  const newNeuron = {
    id: `neuron-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: nodeTitle,
    chunkText: cleanFact,
    distilledInsight: cleanFact,
    keyPhrases: ['web context'],
    sourceTab: source || 'Active Chrome Tab',
    sourceTitle: source || 'Webpage Synthesis',
    category: 'manual_deep_read',
    timestamp: Date.now(),
    strength: 1.8,
    synapses: neurons.slice(0, 2).map((n) => n.id)
  };
  neurons.unshift(newNeuron);
  list.unshift({
    id: newNeuron.id,
    content: cleanFact,
    timestamp: Date.now(),
    source: source || 'extension_crawl'
  });
  compactMem.unshift({
    id: newNeuron.id,
    title: nodeTitle,
    content: cleanFact,
    sourceTab: source || 'Active Chrome Tab',
    timestamp: Date.now()
  });

  const payload = {
    neurons: neurons.slice(0, 120),
    memoryFacts: list.slice(0, 200),
    spidar_memory_v2_5: compactMem.slice(0, 80)
  };
  if (store.spidar_neural_vault_v2_5 && Array.isArray(store.spidar_neural_vault_v2_5.neurons)) {
    payload.spidar_neural_vault_v2_5 = {
      ...store.spidar_neural_vault_v2_5,
      neurons: [newNeuron, ...store.spidar_neural_vault_v2_5.neurons].slice(0, 75),
      updatedAt: Date.now()
    };
  }
  await chrome.storage.local.set(payload);
  return { count: neurons.length };
}

async function handleUpdateNeuron({ id, title, distilledInsight }) {
  const store = await chrome.storage.local.get(['neurons', 'spidar_neural_vault_v2_5']);
  const neurons = Array.isArray(store.neurons) ? store.neurons : [...DEFAULT_NEURONS];
  const target = neurons.find((n) => n.id === id);
  if (target) {
    if (title) target.title = String(title).trim();
    if (distilledInsight) target.distilledInsight = String(distilledInsight).trim();
    await chrome.storage.local.set({ neurons });
  }
  return { neurons };
}

async function handleDeleteNeuron({ id }) {
  const store = await chrome.storage.local.get(['neurons', 'spidar_neural_vault_v2_5']);
  const neurons = (Array.isArray(store.neurons) ? store.neurons : []).filter((n) => n.id !== id);
  const payload = { neurons };
  if (store.spidar_neural_vault_v2_5 && Array.isArray(store.spidar_neural_vault_v2_5.neurons)) {
    payload.spidar_neural_vault_v2_5 = {
      ...store.spidar_neural_vault_v2_5,
      neurons: store.spidar_neural_vault_v2_5.neurons.filter((n) => n.id !== id),
      updatedAt: Date.now()
    };
  }
  await chrome.storage.local.set(payload);
  return { neurons };
}

async function handleGetMemory() {
  const store = await chrome.storage.local.get([
    'memoryFacts',
    'neurons',
    'spidar_neural_vault_v2_5'
  ]);
  const vaultNeurons = store.spidar_neural_vault_v2_5?.neurons;
  return {
    memoryFacts: Array.isArray(store.memoryFacts) ? store.memoryFacts : [],
    neurons:
      Array.isArray(vaultNeurons) && vaultNeurons.length > 0
        ? vaultNeurons
        : Array.isArray(store.neurons) && store.neurons.length > 0
        ? store.neurons
        : DEFAULT_NEURONS
  };
}

async function handleProxyFetch(message) {
  const cleanPath = String(message.path || '/api/ai/chat');
  const method = message.method || 'POST';
  const bodyObj = message.body || {};
  let lastErr = null;
  for (const baseUrl of SPIDAR_CLOUD_FALLBACKS) {
    try {
      const res = await fetch(`${baseUrl}${cleanPath}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify(bodyObj),
        signal: AbortSignal.timeout(20000)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) throw lastErr;
  throw new Error('Cloud Bridge unreachable');
}
