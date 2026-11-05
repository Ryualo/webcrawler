/**
 * SPIDAR v2.7 - Multi-Provider AI Catalog, Capability & Pricing Registry, and Per-Provider Persistence
 * Inspired by Cline's API Configuration architecture.
 */

import {
  AiProviderId,
  ApiConfig,
  ModelCapabilityInfo,
  ProviderProfileConfig
} from '../types';

export interface ProviderDefinition {
  id: AiProviderId;
  label: string;
  shortLabel: string;
  keyLabel: string;
  keyPlaceholder: string;
  defaultBaseUrl: string;
  requiresBaseUrl: boolean;
  requiresApiKey: boolean;
  supportsCustomHeaders: boolean;
  supportsAzureOptions: boolean;
  defaultModel: string;
  helperNote: string;
}

export const AI_PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    id: 'qwen-free',
    label: 'Qwen (Free Cloud Inference)',
    shortLabel: 'Qwen Free',
    keyLabel: 'Optional OpenRouter / Cloud Key (Leave blank for built-in Free Access)',
    keyPlaceholder: 'Leave blank for built-in free Qwen cloud inference',
    defaultBaseUrl: 'https://text.pollinations.ai/openai',
    requiresBaseUrl: false,
    requiresApiKey: false,
    supportsCustomHeaders: true,
    supportsAzureOptions: false,
    defaultModel: 'qwen2.5-72b-instruct-free',
    helperNote: 'Working zero-cost Qwen cloud inference option with automatic failover and real-time streaming.'
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    shortLabel: 'Gemini',
    keyLabel: 'Google Gemini API Key',
    keyPlaceholder: 'AIzaSy... (or leave blank to use built-in studio bridge)',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    requiresBaseUrl: false,
    requiresApiKey: false,
    supportsCustomHeaders: true,
    supportsAzureOptions: false,
    defaultModel: 'gemini-3.8-flash',
    helperNote: 'Uses Google GenAI SDK with native streaming and low-latency reasoning.'
  },
  {
    id: 'openai',
    label: 'OpenAI',
    shortLabel: 'OpenAI',
    keyLabel: 'OpenAI API Key',
    keyPlaceholder: 'sk-proj-...',
    defaultBaseUrl: 'https://api.openai.com/v1',
    requiresBaseUrl: false,
    requiresApiKey: true,
    supportsCustomHeaders: true,
    supportsAzureOptions: false,
    defaultModel: 'gpt-4o-mini',
    helperNote: 'Official OpenAI API supporting GPT-4.1, GPT-4o, and o3-mini reasoning models.'
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    shortLabel: 'Anthropic',
    keyLabel: 'Anthropic API Key',
    keyPlaceholder: 'sk-ant-api03-...',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    requiresBaseUrl: false,
    requiresApiKey: true,
    supportsCustomHeaders: true,
    supportsAzureOptions: false,
    defaultModel: 'claude-3-7-sonnet-latest',
    helperNote: 'Official Anthropic Messages API with extended thinking & streaming.'
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    shortLabel: 'OpenRouter',
    keyLabel: 'OpenRouter API Key',
    keyPlaceholder: 'sk-or-v1-...',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    requiresBaseUrl: false,
    requiresApiKey: true,
    supportsCustomHeaders: true,
    supportsAzureOptions: false,
    defaultModel: 'qwen/qwen-2.5-72b-instruct:free',
    helperNote: 'Unified router for Qwen (including :free tier), Claude, DeepSeek, Gemini, and Llama models.'
  },
  {
    id: 'qwen-local',
    label: 'Qwen Local (Ollama / LM Studio)',
    shortLabel: 'Qwen Local',
    keyLabel: 'Local Daemon Token (Optional)',
    keyPlaceholder: 'ollama (optional for localhost)',
    defaultBaseUrl: 'http://localhost:11434/v1',
    requiresBaseUrl: true,
    requiresApiKey: false,
    supportsCustomHeaders: true,
    supportsAzureOptions: false,
    defaultModel: 'qwen2.5:7b-instruct',
    helperNote: 'Direct zero-cost local Qwen inference via Ollama (:11434) or LM Studio (:1234).'
  },
  {
    id: 'openai-compatible',
    label: 'OpenAI Compatible',
    shortLabel: 'OpenAI Compatible',
    keyLabel: 'OpenAI Compatible API Key',
    keyPlaceholder: 'sk-...',
    defaultBaseUrl: 'https://api.openai.com/v1',
    requiresBaseUrl: true,
    requiresApiKey: true,
    supportsCustomHeaders: true,
    supportsAzureOptions: true,
    defaultModel: 'qwen2.5:7b-instruct',
    helperNote: 'Connect any OpenAI-compatible gateway, vLLM, Groq, LiteLLM, Azure OpenAI, or custom proxy.'
  }
];

export const MODEL_CAPABILITY_CATALOG: ModelCapabilityInfo[] = [
  // Free Qwen Cloud Inference Models
  {
    id: 'qwen2.5-72b-instruct-free',
    name: 'Qwen 2.5 72B Instruct (Free Cloud)',
    provider: 'qwen-free',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsReasoning: true,
    supportsVision: false,
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    description: 'Zero-cost cloud Qwen 2.5 72B instruct inference for deep research, outlining, and synthesis.'
  },
  {
    id: 'qwen2.5-coder-32b-free',
    name: 'Qwen 2.5 Coder 32B (Free Cloud)',
    provider: 'qwen-free',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsReasoning: true,
    supportsVision: false,
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    description: 'Free cloud Qwen Coder 32B optimized for technical analysis, structured JSON outlines, and code.'
  },
  {
    id: 'qwq-32b-reasoning-free',
    name: 'QwQ 32B Reasoning (Free Cloud)',
    provider: 'qwen-free',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsReasoning: true,
    supportsVision: false,
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    description: 'Free Qwen QwQ 32B analytical reasoning model for thesis structuring and complex problem solving.'
  },

  // Gemini Models
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    provider: 'gemini',
    contextWindow: 1048576,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsReasoning: true,
    supportsVision: true,
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.6,
    description: 'Balanced high-speed analytical & reasoning model with configurable thinking.'
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    provider: 'gemini',
    contextWindow: 1048576,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsReasoning: true,
    supportsVision: true,
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.3,
    description: 'Ultra-fast multimodal model with 1M context window and minimal latency.'
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    contextWindow: 2097152,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsReasoning: true,
    supportsVision: true,
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 5.0,
    description: 'Deep reasoning over massive codebases and multi-document knowledge graphs.'
  },

  // Qwen / Local Models
  {
    id: 'qwen2.5:7b-instruct',
    name: 'Qwen 2.5 7B Instruct',
    provider: 'qwen-local',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsReasoning: true,
    supportsVision: false,
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    description: 'High-efficiency local Qwen 2.5 instruct model for fast Second Brain synthesis.'
  },
  {
    id: 'qwen2.5-coder:7b',
    name: 'Qwen 2.5 Coder 7B',
    provider: 'qwen-local',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsReasoning: true,
    supportsVision: false,
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    description: 'Specialized for technical documentation, code analysis, and structured JSON.'
  },
  {
    id: 'qwen3:8b',
    name: 'Qwen 3 8B (Hybrid Thinking)',
    provider: 'qwen-local',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsReasoning: true,
    supportsVision: false,
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    description: 'Next-gen Qwen3 local model with step-by-step reasoning and entity extraction.'
  },
  {
    id: 'qwen2.5:14b-instruct',
    name: 'Qwen 2.5 14B Instruct',
    provider: 'qwen-local',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsReasoning: true,
    supportsVision: false,
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    description: 'High-precision 14B local parameter model for dense analytical recall.'
  },

  // OpenRouter Models
  {
    id: 'qwen/qwen-2.5-72b-instruct:free',
    name: 'Qwen 2.5 72B Instruct (OpenRouter Free)',
    provider: 'openrouter',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsReasoning: true,
    supportsVision: false,
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    description: 'Free-tier 72B Qwen model hosted on OpenRouter.'
  },
  {
    id: 'qwen/qwen-2.5-72b-instruct',
    name: 'Qwen 2.5 72B Instruct (OpenRouter)',
    provider: 'openrouter',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsReasoning: true,
    supportsVision: false,
    inputPricePerMillion: 0.35,
    outputPricePerMillion: 0.4,
    description: 'Frontier 72B Qwen model hosted on OpenRouter with 128K context.'
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1 (Reasoning)',
    provider: 'openrouter',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsReasoning: true,
    supportsVision: false,
    inputPricePerMillion: 0.55,
    outputPricePerMillion: 2.19,
    description: 'Full chain-of-thought reasoning model for complex analytical verification.'
  },
  {
    id: 'anthropic/claude-3.7-sonnet',
    name: 'Claude 3.7 Sonnet (OpenRouter)',
    provider: 'openrouter',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsReasoning: true,
    supportsVision: true,
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    description: 'Hybrid reasoning Claude 3.7 model via OpenRouter.'
  },

  // OpenAI Models
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsReasoning: false,
    supportsVision: true,
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.6,
    description: 'Fast, cost-efficient OpenAI model for web summarization and Q&A.'
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsReasoning: true,
    supportsVision: true,
    inputPricePerMillion: 2.5,
    outputPricePerMillion: 10.0,
    description: 'Flagship multimodal OpenAI model with high accuracy.'
  },
  {
    id: 'o3-mini',
    name: 'OpenAI o3-mini (Reasoning)',
    provider: 'openai',
    contextWindow: 200000,
    maxOutputTokens: 65536,
    supportsStreaming: true,
    supportsReasoning: true,
    supportsVision: false,
    inputPricePerMillion: 1.1,
    outputPricePerMillion: 4.4,
    description: 'Dedicated reasoning model supporting Low, Medium, and High reasoning effort.'
  },

  // Anthropic Models
  {
    id: 'claude-3-7-sonnet-latest',
    name: 'Claude 3.7 Sonnet',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsReasoning: true,
    supportsVision: true,
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    description: 'Anthropic flagship model with extended thinking and nuanced prose synthesis.'
  },
  {
    id: 'claude-3-5-haiku-latest',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsReasoning: false,
    supportsVision: true,
    inputPricePerMillion: 0.8,
    outputPricePerMillion: 4.0,
    description: 'High-speed, low-latency Anthropic model for instant tab digests.'
  }
];

const PROFILES_STORAGE_KEY = 'spidar_provider_profiles_v2_7';
const ACTIVE_CONFIG_STORAGE_KEY = 'spidar_api_config_v2_5';

export function getProviderDefinition(provider: AiProviderId): ProviderDefinition {
  return (
    AI_PROVIDER_DEFINITIONS.find((p) => p.id === provider) ||
    AI_PROVIDER_DEFINITIONS[0]
  );
}

export function getDefaultModelsForProvider(provider: AiProviderId): string[] {
  switch (provider) {
    case 'qwen-free':
      return [
        'qwen2.5-72b-instruct-free',
        'qwen2.5-coder-32b-free',
        'qwq-32b-reasoning-free'
      ];
    case 'gemini':
      return ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-pro'];
    case 'openai':
      return ['gpt-4o-mini', 'gpt-4o', 'o3-mini'];
    case 'anthropic':
      return ['claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'];
    case 'openrouter':
      return [
        'qwen/qwen-2.5-72b-instruct:free',
        'qwen/qwen-2.5-72b-instruct',
        'deepseek/deepseek-r1',
        'anthropic/claude-3.7-sonnet',
        'google/gemini-2.5-flash'
      ];
    case 'qwen-local':
      return [
        'qwen2.5:7b-instruct',
        'qwen2.5-coder:7b',
        'qwen3:8b',
        'qwen2.5:14b-instruct'
      ];
    case 'openai-compatible':
    default:
      return [
        'qwen2.5:7b-instruct',
        'qwen/qwen-2.5-72b-instruct',
        'gpt-4o-mini',
        'gpt-4o',
        'deepseek-r1'
      ];
  }
}

export function getModelCapabilityInfo(
  modelId: string,
  provider: AiProviderId = 'openai-compatible'
): ModelCapabilityInfo {
  const exact = MODEL_CAPABILITY_CATALOG.find(
    (m) => m.id.toLowerCase() === modelId.toLowerCase()
  );
  if (exact) return exact;

  const lower = modelId.toLowerCase();
  const isLocal =
    provider === 'qwen-local' ||
    provider === 'qwen-free' ||
    lower.includes(':free') ||
    lower.endsWith('-free') ||
    lower.includes(':');
  const isReasoning =
    lower.includes('r1') ||
    lower.includes('o1') ||
    lower.includes('o3') ||
    lower.includes('qwen3') ||
    lower.includes('qwq') ||
    lower.includes('thinking') ||
    lower.includes('sonnet') ||
    lower.includes('gemini');
  const isVision =
    lower.includes('4o') ||
    lower.includes('gemini') ||
    lower.includes('claude') ||
    lower.includes('vl');

  return {
    id: modelId,
    name: modelId,
    provider,
    contextWindow: lower.includes('gemini') ? 1048576 : 128000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsReasoning: isReasoning,
    supportsVision: isVision,
    inputPricePerMillion: isLocal ? 0 : 0.25,
    outputPricePerMillion: isLocal ? 0 : 0.75,
    description: isLocal
      ? 'Free / Local OpenAI-compatible model endpoint.'
      : 'Compatible chat completion model.'
  };
}

export function searchModelsWithCapabilities(
  modelIds: string[],
  provider: AiProviderId,
  searchQuery: string
): ModelCapabilityInfo[] {
  const uniqueIds = Array.from(
    new Set([...modelIds, ...getDefaultModelsForProvider(provider)])
  ).filter(Boolean);

  const enriched = uniqueIds.map((id) => getModelCapabilityInfo(id, provider));
  const q = searchQuery.trim().toLowerCase();
  if (!q) return enriched;

  return enriched.filter(
    (m) =>
      m.id.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q)
  );
}

export function createDefaultProfileForProvider(
  provider: AiProviderId
): ProviderProfileConfig {
  const def = getProviderDefinition(provider);
  const models = getDefaultModelsForProvider(provider);
  return {
    provider,
    baseUrl: def.defaultBaseUrl,
    apiKey: '',
    selectedModel: def.defaultModel,
    availableModels: models,
    customHeaders: [],
    setAzureApiVersion: false,
    azureApiVersion: '2024-10-21',
    useAzureIdentityAuth: false,
    reasoningEffort: 'medium',
    temperature: 0.45,
    maxTokens: 2048,
    streamingEnabled: true
  };
}

export function loadAllProviderProfiles(): Record<AiProviderId, ProviderProfileConfig> {
  const defaults: Record<AiProviderId, ProviderProfileConfig> = {
    'qwen-free': createDefaultProfileForProvider('qwen-free'),
    'openai-compatible': createDefaultProfileForProvider('openai-compatible'),
    gemini: createDefaultProfileForProvider('gemini'),
    openai: createDefaultProfileForProvider('openai'),
    anthropic: createDefaultProfileForProvider('anthropic'),
    openrouter: createDefaultProfileForProvider('openrouter'),
    'qwen-local': createDefaultProfileForProvider('qwen-local'),
    local: createDefaultProfileForProvider('qwen-local')
  };

  if (typeof window === 'undefined') return defaults;

  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;

    (Object.keys(defaults) as AiProviderId[]).forEach((pid) => {
      if (parsed[pid] && typeof parsed[pid] === 'object') {
        defaults[pid] = {
          ...defaults[pid],
          ...parsed[pid],
          provider: pid,
          customHeaders: Array.isArray(parsed[pid].customHeaders)
            ? parsed[pid].customHeaders
            : []
        };
      }
    });
  } catch {
    // ignore storage read errors
  }

  return defaults;
}

export function saveProviderProfileToStorage(
  profile: ProviderProfileConfig,
  spiderSpeed = 1.0
): ApiConfig {
  const all = loadAllProviderProfiles();
  all[profile.provider] = {
    ...profile,
    customHeaders: Array.isArray(profile.customHeaders) ? profile.customHeaders : []
  };

  const activeConfig: ApiConfig = {
    provider: profile.provider,
    baseUrl: profile.baseUrl,
    apiKey: profile.apiKey,
    selectedModel: profile.selectedModel,
    availableModels: profile.availableModels,
    temperature: profile.temperature,
    maxTokens: profile.maxTokens,
    spiderSpeed,
    customHeaders: profile.customHeaders,
    setAzureApiVersion: profile.setAzureApiVersion,
    azureApiVersion: profile.azureApiVersion,
    useAzureIdentityAuth: profile.useAzureIdentityAuth,
    reasoningEffort: profile.reasoningEffort,
    streamingEnabled: profile.streamingEnabled
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(all));
      localStorage.setItem(ACTIVE_CONFIG_STORAGE_KEY, JSON.stringify(activeConfig));
      const g = globalThis as any;
      if (g.chrome?.storage?.local) {
        g.chrome.storage.local.set({
          [PROFILES_STORAGE_KEY]: all,
          [ACTIVE_CONFIG_STORAGE_KEY]: activeConfig
        });
      }
    } catch {
      // ignore quota errors
    }
  }

  return activeConfig;
}

export function classifyApiError(
  status: number,
  rawMessage: string
): {
  code: 'invalid_key' | 'rate_limit' | 'model_unavailable' | 'connection_error';
  userMessage: string;
} {
  const msg = String(rawMessage || '');
  if (
    status === 401 ||
    status === 403 ||
    /invalid.*key|unauthorized|authentication|incorrect api key|permission_denied/i.test(msg)
  ) {
    return {
      code: 'invalid_key',
      userMessage: 'Authentication failed: Invalid or unauthorized API key for this provider.'
    };
  }
  if (
    status === 429 ||
    /rate.?limit|quota|resource_exhausted|too many requests/i.test(msg)
  ) {
    return {
      code: 'rate_limit',
      userMessage: 'Rate limit or quota reached (HTTP 429). Please wait or switch models.'
    };
  }
  if (
    status === 404 ||
    /model.*not.*found|does not exist|not_found|unsupported model/i.test(msg)
  ) {
    return {
      code: 'model_unavailable',
      userMessage: 'Selected Model ID is unavailable or not found on this provider endpoint.'
    };
  }
  return {
    code: 'connection_error',
    userMessage: msg
      ? `Connection error: ${msg.slice(0, 140)}`
      : 'Unable to reach provider endpoint. Verify Base URL and network connectivity.'
  };
}

export function formatPricePerMillion(
  inputPrice?: number | null,
  outputPrice?: number | null
): string {
  if (
    (inputPrice === 0 || inputPrice === undefined || inputPrice === null) &&
    (outputPrice === 0 || outputPrice === undefined || outputPrice === null)
  ) {
    return 'Free / Local';
  }
  const inStr = typeof inputPrice === 'number' ? `$${inputPrice.toFixed(2)}` : '$0.00';
  const outStr = typeof outputPrice === 'number' ? `$${outputPrice.toFixed(2)}` : '$0.00';
  return `${inStr}/1M in · ${outStr}/1M out`;
}

export function formatContextWindow(tokens?: number): string {
  if (!tokens || tokens <= 0) return '128K';
  if (tokens >= 1000000) return `${Math.round(tokens / 1000000)}M`;
  return `${Math.round(tokens / 1000)}K`;
}

