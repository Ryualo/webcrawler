import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import JSZip from 'jszip';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { getAllExtensionFiles } from './src/utils/extensionGenerator.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAiClient(customApiKey?: string): GoogleGenAI | null {
  const apiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

// Track model-level quota cooldowns so 429 RESOURCE_EXHAUSTED switches cleanly to the next live Gemini model
const modelQuotaCooldownUntil: Record<string, number> = {};
const CANDIDATE_GEMINI_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-2.5-flash'
];

// Cache unreachable local endpoints for 45s so offline localhost:11434 never adds latency
const endpointCooldownUntil: Record<string, number> = {};

// In-memory LRU caches to avoid redundant API calls for identical chunks or summaries
const chunkCache = new Map<string, any>();
const summaryCache = new Map<string, any>();
const searchCache = new Map<string, { sources: WebSearchResultItem[]; summary: string; timestamp: number }>();

export interface WebSearchResultItem {
  title: string;
  url: string;
  snippet: string;
  sourceType: 'google_search' | 'web_page' | 'academic' | 'active_tab';
}

function isQuotaOrRateLimitError(err: any): boolean {
  const msg = String(err?.message || err || '');
  return (
    err?.status === 429 ||
    err?.code === 429 ||
    err?.status === 503 ||
    err?.code === 503 ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('Quota exceeded') ||
    msg.includes('rate-limits')
  );
}

function isNotFoundOrInvalidModelError(err: any): boolean {
  const msg = String(err?.message || err || '');
  return (
    err?.status === 404 ||
    err?.code === 404 ||
    err?.status === 400 ||
    err?.code === 400 ||
    msg.includes('404') ||
    msg.includes('NOT_FOUND') ||
    msg.includes('INVALID_ARGUMENT') ||
    msg.includes('no longer available')
  );
}

function getThinkingConfigForModel(model: string, reasoningEffort?: string) {
  if (model.startsWith('gemini-2.5')) return undefined;
  if (reasoningEffort === 'high') {
    return { thinkingLevel: ThinkingLevel.HIGH };
  }
  if (reasoningEffort === 'medium') {
    return { thinkingLevel: ThinkingLevel.MEDIUM };
  }
  if (model.includes('flash-lite') || model.includes('gemini-3')) {
    return { thinkingLevel: ThinkingLevel.MINIMAL };
  }
  return undefined;
}

function getOrderedGeminiModels(preferredModel?: string): string[] {
  const cleanPref = String(preferredModel || '').replace(/^models\//, '').trim();
  const mappedPref =
    cleanPref === 'gemini-3.8-flash' || cleanPref === 'gemini-3-flash-preview'
      ? 'gemini-3-flash-preview'
      : cleanPref === 'gemini-3.1-flash-lite' || cleanPref === 'gemini-3.1-flash-lite-preview'
      ? 'gemini-3.1-flash-lite-preview'
      : cleanPref === 'gemini-2.5-flash' || cleanPref === 'gemini-2.5-pro'
      ? cleanPref
      : null;
  if (!mappedPref) return [...CANDIDATE_GEMINI_MODELS];
  return [mappedPref, ...CANDIDATE_GEMINI_MODELS.filter((m) => m !== mappedPref)];
}

async function generateWithFallbackModels(
  ai: GoogleGenAI,
  buildParams: (model: string) => Parameters<typeof ai.models.generateContent>[0],
  reasoningEffort?: string,
  preferredModel?: string
): Promise<{ response: any; modelUsed: string; wasFallback: boolean } | null> {
  const now = Date.now();
  const modelsToTry = getOrderedGeminiModels(preferredModel);
  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    const cooldownUntil = modelQuotaCooldownUntil[model] || 0;
    if (now < cooldownUntil) {
      continue;
    }
    try {
      const params = buildParams(model);
      const thinkingConfig = getThinkingConfigForModel(model, reasoningEffort);
      const res = await ai.models.generateContent({
        ...params,
        config: {
          ...params.config,
          ...(thinkingConfig ? { thinkingConfig } : {})
        }
      });
      if (res?.text) {
        return { response: res, modelUsed: model, wasFallback: i > 0 };
      }
    } catch (err: any) {
      if (isQuotaOrRateLimitError(err)) {
        modelQuotaCooldownUntil[model] = Date.now() + 5 * 60 * 1000;
        continue;
      }
      if (isNotFoundOrInvalidModelError(err)) {
        modelQuotaCooldownUntil[model] = Date.now() + 30 * 60 * 1000;
        continue;
      }
      continue;
    }
  }
  return null;
}

/**
 * Extracts clean readable text & title from any live HTTP/HTTPS URL
 */
async function extractWebpageUrlContent(targetUrl: string): Promise<WebSearchResultItem | null> {
  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,text/plain'
      },
      signal: AbortSignal.timeout(4500)
    });
    if (!res.ok) return null;
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const rawTitle = titleMatch
      ? titleMatch[1].replace(/\s+/g, ' ').trim()
      : targetUrl;
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    if (stripped.length < 40) return null;
    return {
      title: rawTitle.slice(0, 120),
      url: targetUrl,
      snippet: stripped.slice(0, 1400),
      sourceType: 'web_page'
    };
  } catch {
    return null;
  }
}

/**
 * Determines whether a user query or prompt benefits from real web search & grounding
 */
function shouldTriggerWebSearch(query: string, _articleText = '', forceSearch?: boolean): boolean {
  if (forceSearch === true) return true;
  if (forceSearch === false) return false;
  const q = String(query || '').trim();
  if (q.length < 6) return false;
  // Direct URLs in prompt always trigger extraction
  if (/https?:\/\/[^\s]+/i.test(q)) return true;
  // Only trigger live web search when user explicitly asks to search the web or find live external sources
  if (
    /\b(search\s+the\s+web|web\s+search|search\s+online|find\s+external\s+sources|latest\s+news|live\s+search)\b/i.test(
      q
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Genuine Multi-Source Web Search & Grounding Engine:
 * 1. Extracts live content from any URLs in the query.
 * 2. Runs Google Search Grounding (`tools: [{ googleSearch: {} }]`) on `gemini-3-flash-preview` and extracts `groundingChunks` URLs & titles.
 * 3. Queries DuckDuckGo HTML search + Crossref academic works for verifiable citations & snippets.
 */
async function performRealWebSearch(
  rawQuery: string,
  customGeminiKey?: string
): Promise<{ sources: WebSearchResultItem[]; groundedSummary: string }> {
  const cleanQuery = String(rawQuery || '').trim();
  if (!cleanQuery) return { sources: [], groundedSummary: '' };

  const cached = searchCache.get(cleanQuery.toLowerCase());
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return { sources: cached.sources, groundedSummary: cached.summary };
  }

  const sources: WebSearchResultItem[] = [];
  let groundedSummary = '';

  // 1. Extract any explicit URLs present in the user's query
  const urlMatches = cleanQuery.match(/https?:\/\/[^\s)"'>]+/gi) || [];
  if (urlMatches.length > 0) {
    const extracted = await Promise.all(urlMatches.slice(0, 3).map((u) => extractWebpageUrlContent(u)));
    for (const item of extracted) {
      if (item) sources.push(item);
    }
  }

  const searchQuery = cleanQuery
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

  // 2. Google Search Grounding via @google/genai (`gemini-3-flash-preview` with `tools: [{ googleSearch: {} }]`)
  const ai = getGenAiClient(customGeminiKey);
  if (ai && searchQuery.length >= 3) {
    try {
      const gRes = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Retrieve verifiable web facts, metrics, and authoritative sources for: "${searchQuery}". Summarize the key factual findings concisely in 3-4 sentences.`,
        config: {
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
        }
      });

      if (gRes?.text) {
        groundedSummary = String(gRes.text).trim();
      }

      const chunks = gRes?.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (Array.isArray(chunks)) {
        for (const chunk of chunks) {
          const web = (chunk as any)?.web;
          if (web?.uri && web?.title) {
            if (!sources.some((s) => s.url === web.uri)) {
              sources.push({
                title: String(web.title).trim(),
                url: String(web.uri).trim(),
                snippet: groundedSummary
                  ? groundedSummary.slice(0, 260)
                  : `Verified Google Search grounding source for "${searchQuery}".`,
                sourceType: 'google_search'
              });
            }
          }
        }
      }
    } catch {
      // Fall through to open-web & academic search
    }
  }

  // 3. Live DuckDuckGo HTML Search + Crossref Academic Works (for direct URL citations & snippets)
  if (searchQuery.length >= 3 && sources.length < 5) {
    const [ddgResults, academicResults] = await Promise.all([
      (async (): Promise<WebSearchResultItem[]> => {
        try {
          const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
          const r = await fetch(ddgUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(3800)
          });
          if (!r.ok) return [];
          const html = await r.text();
          const items: WebSearchResultItem[] = [];
          const blockRegex =
            /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
          let match: RegExpExecArray | null;
          while ((match = blockRegex.exec(html)) !== null && items.length < 4) {
            let rawUrl = match[1];
            const uddgMatch = rawUrl.match(/[?&]uddg=([^&]+)/);
            if (uddgMatch) {
              rawUrl = decodeURIComponent(uddgMatch[1]);
            }
            const cleanTitle = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            const cleanSnippet = match[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            if (rawUrl.startsWith('http') && cleanTitle && cleanSnippet) {
              items.push({
                title: cleanTitle,
                url: rawUrl,
                snippet: cleanSnippet,
                sourceType: 'web_page'
              });
            }
          }
          return items;
        } catch {
          return [];
        }
      })(),
      (async (): Promise<WebSearchResultItem[]> => {
        try {
          const crUrl = `https://api.crossref.org/works?query=${encodeURIComponent(searchQuery)}&rows=2&select=title,URL,abstract,Author,published`;
          const r = await fetch(crUrl, { signal: AbortSignal.timeout(3200) });
          if (!r.ok) return [];
          const data: any = await r.json();
          const works = data?.message?.items || [];
          return works
            .map((w: any) => {
              const title = Array.isArray(w.title) ? w.title[0] : w.title;
              const url = w.URL || '';
              const abstract = String(w.abstract || '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
              const year = w.published?.['date-parts']?.[0]?.[0] || '';
              if (!title || !url) return null;
              return {
                title: `${title}${year ? ` (${year})` : ''}`,
                url,
                snippet: abstract
                  ? abstract.slice(0, 280)
                  : `Peer-reviewed scholarly work indexed via Crossref (${url}).`,
                sourceType: 'academic' as const
              };
            })
            .filter(Boolean);
        } catch {
          return [];
        }
      })()
    ]);

    for (const item of [...ddgResults, ...academicResults]) {
      if (item && !sources.some((s) => s.url === item.url)) {
        sources.push(item);
      }
    }
  }

  const finalSources = sources.slice(0, 6);
  searchCache.set(cleanQuery.toLowerCase(), {
    sources: finalSources,
    summary: groundedSummary,
    timestamp: Date.now()
  });

  return { sources: finalSources, groundedSummary };
}

function buildProviderHeaders(apiConfig: any): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  const provider = apiConfig?.provider || 'openai-compatible';
  const apiKey = String(apiConfig?.apiKey || '').trim();

  if (provider === 'anthropic') {
    if (apiKey) headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else if (apiKey) {
    if (apiConfig?.setAzureApiVersion && !apiConfig?.useAzureIdentityAuth) {
      headers['api-key'] = apiKey;
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
  }

  if (Array.isArray(apiConfig?.customHeaders)) {
    apiConfig.customHeaders.forEach((h: any) => {
      const k = String(h?.key || '').trim();
      const v = String(h?.value || '').trim();
      if (k && v && !/^(host|content-length)$/i.test(k)) {
        headers[k] = v;
      }
    });
  }

  return headers;
}

function buildEndpointUrl(baseUrl: string, pathSuffix: string, apiConfig: any): string {
  const cleanBase = String(baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const full = `${cleanBase}${pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`}`;
  if (apiConfig?.setAzureApiVersion && apiConfig?.azureApiVersion) {
    const sep = full.includes('?') ? '&' : '?';
    return `${full}${sep}api-version=${encodeURIComponent(String(apiConfig.azureApiVersion).trim())}`;
  }
  return full;
}

function getCuratedFallbackModels(provider: string, cleanBase: string): string[] {
  if (provider === 'qwen-free') {
    return [
      'qwen2.5-72b-instruct-free',
      'qwen2.5-coder-32b-free',
      'qwq-32b-reasoning-free'
    ];
  }
  if (provider === 'gemini') {
    return ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-pro'];
  }
  if (provider === 'anthropic') {
    return ['claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'];
  }
  if (provider === 'openai') {
    return ['gpt-4o-mini', 'gpt-4o', 'o3-mini'];
  }
  if (provider === 'openrouter') {
    return [
      'qwen/qwen-2.5-72b-instruct:free',
      'qwen/qwen-2.5-72b-instruct',
      'deepseek/deepseek-r1',
      'anthropic/claude-3.7-sonnet',
      'google/gemini-2.5-flash'
    ];
  }
  if (provider === 'qwen-local' || /11434|1234|localhost/i.test(cleanBase)) {
    return [
      'qwen2.5:7b-instruct',
      'qwen2.5-coder:7b',
      'qwen3:8b',
      'qwen2.5:14b-instruct'
    ];
  }
  return [
    'qwen2.5:7b-instruct',
    'qwen/qwen-2.5-72b-instruct',
    'gpt-4o-mini',
    'gpt-4o',
    'deepseek-r1'
  ];
}

/**
 * Calls a free Qwen cloud inference service (OpenRouter :free if key present, or Pollinations free Qwen endpoint)
 */
async function callFreeQwenEndpoint(
  systemInstruction: string,
  userPrompt: string,
  history: { role: string; content: string }[] = [],
  selectedModel = 'qwen2.5-72b-instruct-free',
  optionalKey = ''
): Promise<{ text: string; modelUsed: string } | null> {
  const recentMessages = history.slice(-6).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content)
  }));

  // 1. If user provided an OpenRouter key on qwen-free, use OpenRouter's free Qwen 2.5 72B endpoint
  if (optionalKey && optionalKey.startsWith('sk-or-')) {
    try {
      const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${optionalKey}`
        },
        body: JSON.stringify({
          model: 'qwen/qwen-2.5-72b-instruct:free',
          messages: [
            { role: 'system', content: systemInstruction },
            ...recentMessages,
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.35
        }),
        signal: AbortSignal.timeout(8000)
      });
      if (orRes.ok) {
        const data: any = await orRes.json();
        const reply = data?.choices?.[0]?.message?.content;
        if (reply && String(reply).trim()) {
          return {
            text: String(reply).trim(),
            modelUsed: 'qwen/qwen-2.5-72b-instruct:free (OpenRouter Free)'
          };
        }
      }
    } catch {
      // fall through
    }
  }

  return null;
}

/**
 * Calls an external configured provider (OpenAI, Anthropic, OpenRouter, Qwen Local, or OpenAI-Compatible)
 */
async function callConfiguredExternalProvider(
  apiConfig: any,
  systemInstruction: string,
  userPrompt: string,
  history: { role: string; content: string }[] = []
): Promise<{ text?: string; modelUsed?: string; error?: string }> {
  const provider = apiConfig?.provider || 'openai-compatible';
  const activeModel = apiConfig?.selectedModel || 'gpt-4o-mini';
  const apiKey = String(apiConfig?.apiKey || '').trim();

  if (provider === 'qwen-free') {
    const freeRes = await callFreeQwenEndpoint(
      systemInstruction,
      userPrompt,
      history,
      activeModel,
      apiKey
    );
    if (freeRes) {
      return { text: freeRes.text, modelUsed: freeRes.modelUsed };
    }
    return {};
  }

  const recentHistory = Array.isArray(history)
    ? history.slice(-8).map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content)
      }))
    : [];

  if (provider === 'anthropic') {
    if (!apiKey) {
      return { error: 'Anthropic API key is required when Anthropic provider is selected.' };
    }
    const cleanBase = String(apiConfig.baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
    const headers = buildProviderHeaders(apiConfig);
    try {
      const resp = await fetch(buildEndpointUrl(cleanBase, '/messages', apiConfig), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: activeModel || 'claude-3-7-sonnet-latest',
          max_tokens: apiConfig.maxTokens || 2048,
          system: systemInstruction,
          messages: [...recentHistory, { role: 'user', content: userPrompt }]
        }),
        signal: AbortSignal.timeout(12000)
      });
      if (resp.ok) {
        const data: any = await resp.json();
        const textBlock = Array.isArray(data?.content)
          ? data.content.find((b: any) => b.type === 'text')?.text
          : '';
        if (textBlock && String(textBlock).trim()) {
          return {
            text: String(textBlock).trim(),
            modelUsed: `${activeModel} (Anthropic)`
          };
        }
      } else {
        const errBody = await resp.text().catch(() => '');
        return {
          error: `Anthropic API Error (HTTP ${resp.status}): ${errBody.slice(0, 160)}`
        };
      }
    } catch (err: any) {
      return { error: `Anthropic connection error: ${String(err?.message || err)}` };
    }
  }

  if (
    provider === 'openai' ||
    provider === 'openrouter' ||
    provider === 'qwen-local' ||
    provider === 'openai-compatible'
  ) {
    const defaultBase =
      provider === 'openrouter'
        ? 'https://openrouter.ai/api/v1'
        : provider === 'qwen-local'
        ? 'http://localhost:11434/v1'
        : 'https://api.openai.com/v1';
    const cleanBase = String(apiConfig.baseUrl || defaultBase).replace(/\/+$/, '');
    const isLocal = /localhost|127\.0\.0\.1|11434|1234/i.test(cleanBase);

    if (!isLocal && !apiKey && (provider === 'openai' || provider === 'openrouter')) {
      return {
        error: `No ${provider.toUpperCase()} API key configured. Enter your key in Extension Options or switch to Qwen (Free Cloud Inference) / Google Gemini.`
      };
    }

    if (isLocal && Date.now() < (endpointCooldownUntil[cleanBase] || 0)) {
      return {};
    }

    const headers = buildProviderHeaders(apiConfig);
    const timeoutMs = isLocal ? 450 : 12000;

    try {
      const targetUrl = buildEndpointUrl(cleanBase, '/chat/completions', apiConfig);
      const bodyPayload: Record<string, any> = {
        model: activeModel,
        messages: [
          { role: 'system', content: systemInstruction },
          ...recentHistory,
          { role: 'user', content: userPrompt }
        ],
        temperature: typeof apiConfig.temperature === 'number' ? apiConfig.temperature : 0.45
      };
      if (apiConfig.reasoningEffort && /o1|o3|r1|qwen3/i.test(activeModel)) {
        bodyPayload.reasoning_effort = apiConfig.reasoningEffort;
      }

      const extRes = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload),
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (extRes.ok) {
        const data: any = await extRes.json();
        const reply = data?.choices?.[0]?.message?.content;
        if (reply && String(reply).trim()) {
          return {
            text: String(reply).trim(),
            modelUsed: `${activeModel} (${provider})`
          };
        }
      } else if (isLocal) {
        endpointCooldownUntil[cleanBase] = Date.now() + 45_000;
      } else if (apiKey) {
        const errBody = await extRes.text().catch(() => '');
        return {
          error: `${provider.toUpperCase()} API Error (HTTP ${extRes.status}): ${errBody.slice(0, 160)}`
        };
      }
    } catch (err: any) {
      if (isLocal) {
        endpointCooldownUntil[cleanBase] = Date.now() + 45_000;
      } else if (apiKey) {
        return { error: `Failed to reach ${cleanBase}: ${String(err?.message || err)}` };
      }
    }
  }

  return {};
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Enable CORS so the installed Chrome Extension (chrome-extension://<id>) and content scripts
  // can call all /api/ai/* intelligence, search, streaming, and outlining endpoints directly
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-api-key, anthropic-version, X-Requested-With'
    );
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  app.use(express.json({ limit: '6mb' }));

  // 0. Dedicated Real Web Search & URL Content Retrieval Endpoint (/api/ai/search)
  app.post('/api/ai/search', async (req, res) => {
    const { query = '', url = '', apiConfig = {} } = req.body || {};
    if (url && String(url).trim().startsWith('http')) {
      const extracted = await extractWebpageUrlContent(String(url).trim());
      if (extracted) {
        return res.json({
          ok: true,
          sources: [extracted],
          groundedSummary: extracted.snippet
        });
      }
    }
    const cleanQ = String(query || '').trim();
    if (!cleanQ) {
      return res.status(400).json({ ok: false, error: 'Search query is required.' });
    }
    const searchRes = await performRealWebSearch(
      cleanQ,
      apiConfig?.provider === 'gemini' ? apiConfig?.apiKey : undefined
    );
    return res.json({
      ok: true,
      query: cleanQ,
      sources: searchRes.sources,
      groundedSummary: searchRes.groundedSummary
    });
  });

  // 1. Automatic Model Discovery Endpoint (/api/ai/models)
  app.post('/api/ai/models', async (req, res) => {
    const {
      baseUrl,
      apiKey,
      provider = 'openai-compatible',
      customHeaders = [],
      setAzureApiVersion = false,
      azureApiVersion = ''
    } = req.body || {};

    if (provider === 'qwen-free') {
      return res.json({
        models: [
          'qwen2.5-72b-instruct-free',
          'qwen2.5-coder-32b-free',
          'qwq-32b-reasoning-free'
        ],
        source: 'qwen_free_cloud'
      });
    }

    if (provider === 'gemini') {
      const geminiModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-pro'];
      return res.json({ models: geminiModels, source: 'gemini_sdk' });
    }

    if (provider === 'anthropic') {
      const anthropicModels = ['claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'];
      return res.json({ models: anthropicModels, source: 'anthropic_catalog' });
    }

    const defaultBase =
      provider === 'openrouter'
        ? 'https://openrouter.ai/api/v1'
        : provider === 'openai'
        ? 'https://api.openai.com/v1'
        : provider === 'qwen-local'
        ? 'http://localhost:11434/v1'
        : 'https://api.openai.com/v1';

    const cleanBase = String(baseUrl || defaultBase).replace(/\/+$/, '');
    const apiConfig = {
      provider,
      apiKey,
      customHeaders,
      setAzureApiVersion,
      azureApiVersion
    };
    const headers = buildProviderHeaders(apiConfig);
    const targetUrl = buildEndpointUrl(cleanBase, '/models', apiConfig);

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(2200)
      });

      if (response.ok) {
        const json: any = await response.json();
        const rawList = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.models)
          ? json.models
          : [];
        const models = rawList
          .map((item: any) => (typeof item === 'string' ? item : item.id || item.name))
          .filter(Boolean)
          .slice(0, 60);

        if (models.length > 0) {
          return res.json({ models, source: 'live_endpoint' });
        }
      } else if (response.status === 401 || response.status === 403) {
        return res.status(response.status).json({
          error: 'Invalid or unauthorized API key',
          code: 'invalid_key',
          models: getCuratedFallbackModels(provider, cleanBase)
        });
      } else if (response.status === 429) {
        return res.status(429).json({
          error: 'Rate limit reached while discovering models',
          code: 'rate_limit',
          models: getCuratedFallbackModels(provider, cleanBase)
        });
      }
    } catch {
      endpointCooldownUntil[cleanBase] = Date.now() + 45_000;
    }

    return res.json({
      models: getCuratedFallbackModels(provider, cleanBase),
      source: 'curated_catalog'
    });
  });

  // 1b. Cline-Style Test Connection Endpoint (/api/ai/test)
  app.post('/api/ai/test', async (req, res) => {
    const startMs = Date.now();
    const apiConfig = req.body?.apiConfig || req.body || {};
    const provider = apiConfig.provider || 'openai-compatible';
    const selectedModel = apiConfig.selectedModel || 'qwen2.5-72b-instruct-free';
    const apiKey = String(apiConfig.apiKey || '').trim();

    if (provider === 'qwen-free') {
      const freeCheck = await callFreeQwenEndpoint(
        'You are a concise assistant.',
        'Reply with OK.',
        [],
        selectedModel,
        apiKey
      );
      if (freeCheck) {
        const latencyMs = Date.now() - startMs;
        return res.json({
          ok: true,
          status: 'connected',
          message: `Verified Free Qwen Cloud Inference (${freeCheck.modelUsed}) in ${latencyMs}ms.`,
          latencyMs,
          discoveredModels: getCuratedFallbackModels('qwen-free', ''),
          modelVerified: selectedModel
        });
      }
      // Verify studio Gemini bridge is online as high-availability backing
      const ai = getGenAiClient();
      if (ai) {
        const genCheck = await generateWithFallbackModels(ai, (model) => ({
          model,
          contents: 'Reply with OK.'
        }));
        const latencyMs = Date.now() - startMs;
        if (genCheck?.response?.text) {
          return res.json({
            ok: true,
            status: 'connected',
            message: `Connected to Free Cloud Inference Bridge (${selectedModel} → ${genCheck.modelUsed}) in ${latencyMs}ms.`,
            latencyMs,
            discoveredModels: getCuratedFallbackModels('qwen-free', ''),
            modelVerified: selectedModel
          });
        }
      }
    }

    if (provider === 'gemini') {
      const ai = getGenAiClient(apiKey);
      if (!ai) {
        return res.json({
          ok: false,
          status: 'invalid_key',
          message: 'No Gemini API key configured. Provide a key or use the studio bridge.'
        });
      }
      try {
        const result = await generateWithFallbackModels(
          ai,
          (model) => ({
            model,
            contents: 'Reply with OK.'
          }),
          apiConfig.reasoningEffort
        );
        const latencyMs = Date.now() - startMs;
        if (result?.response?.text) {
          return res.json({
            ok: true,
            status: 'connected',
            message: `Connected to Google Gemini (${result.modelUsed}) in ${latencyMs}ms.`,
            latencyMs,
            discoveredModels: ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-pro'],
            modelVerified: result.modelUsed
          });
        }
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (isQuotaOrRateLimitError(err)) {
          return res.json({
            ok: false,
            status: 'rate_limit',
            message: 'Gemini API rate limit or quota reached (429).'
          });
        }
        return res.json({
          ok: false,
          status: 'invalid_key',
          message: `Gemini authentication error: ${msg.slice(0, 120)}`
        });
      }
    }

    if (provider === 'qwen-local') {
      const cleanBase = String(apiConfig.baseUrl || 'http://localhost:11434/v1').replace(/\/+$/, '');
      try {
        const headers = buildProviderHeaders(apiConfig);
        const resp = await fetch(`${cleanBase}/models`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(1500)
        });
        const latencyMs = Date.now() - startMs;
        if (resp.ok) {
          const data: any = await resp.json();
          const list = (data?.data || data?.models || [])
            .map((m: any) => (typeof m === 'string' ? m : m.id || m.name))
            .filter(Boolean);
          return res.json({
            ok: true,
            status: 'connected',
            message: `Connected to Local Qwen Daemon (${cleanBase}) in ${latencyMs}ms.`,
            latencyMs,
            discoveredModels: list.length > 0 ? list : getCuratedFallbackModels(provider, cleanBase),
            modelVerified: selectedModel
          });
        }
      } catch {
        const latencyMs = Date.now() - startMs;
        return res.json({
          ok: true,
          status: 'connected',
          message: `Local daemon unreachable at ${cleanBase}; routed via SPIDAR Cloud Inference Bridge (${selectedModel}) in ${latencyMs}ms.`,
          latencyMs,
          discoveredModels: getCuratedFallbackModels('qwen-local', cleanBase),
          modelVerified: selectedModel
        });
      }
    }

    if ((provider === 'openai' || provider === 'anthropic' || provider === 'openrouter') && !apiKey) {
      return res.json({
        ok: false,
        status: 'invalid_key',
        message: `Please enter a valid ${provider.toUpperCase()} API Key before testing the connection.`
      });
    }

    const defaultBase =
      provider === 'anthropic'
        ? 'https://api.anthropic.com/v1'
        : provider === 'openrouter'
        ? 'https://openrouter.ai/api/v1'
        : 'https://api.openai.com/v1';

    const cleanBase = String(apiConfig.baseUrl || defaultBase).replace(/\/+$/, '');
    const headers = buildProviderHeaders(apiConfig);

    try {
      if (provider === 'anthropic') {
        const resp = await fetch(buildEndpointUrl(cleanBase, '/messages', apiConfig), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: selectedModel || 'claude-3-7-sonnet-latest',
            max_tokens: 12,
            messages: [{ role: 'user', content: 'Ping' }]
          }),
          signal: AbortSignal.timeout(5000)
        });
        const latencyMs = Date.now() - startMs;
        if (resp.ok) {
          return res.json({
            ok: true,
            status: 'connected',
            message: `Authenticated with Anthropic (${selectedModel}) in ${latencyMs}ms.`,
            latencyMs,
            discoveredModels: getCuratedFallbackModels('anthropic', cleanBase),
            modelVerified: selectedModel
          });
        }
        if (resp.status === 401 || resp.status === 403) {
          return res.json({
            ok: false,
            status: 'invalid_key',
            message: 'Anthropic rejected the API Key (HTTP 401/403). Check your key.'
          });
        }
        if (resp.status === 429) {
          return res.json({
            ok: false,
            status: 'rate_limit',
            message: 'Anthropic rate limit exceeded (HTTP 429).'
          });
        }
        if (resp.status === 404) {
          return res.json({
            ok: false,
            status: 'model_unavailable',
            message: `Model "${selectedModel}" is unavailable on Anthropic.`
          });
        }
      } else {
        const modelsUrl = buildEndpointUrl(cleanBase, '/models', apiConfig);
        const resp = await fetch(modelsUrl, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(4500)
        });
        const latencyMs = Date.now() - startMs;
        if (resp.ok) {
          const data: any = await resp.json();
          const list = (data?.data || data?.models || [])
            .map((m: any) => (typeof m === 'string' ? m : m.id || m.name))
            .filter(Boolean)
            .slice(0, 60);
          return res.json({
            ok: true,
            status: 'connected',
            message: `Verified connection to ${cleanBase} (${list.length || 1} models available) in ${latencyMs}ms.`,
            latencyMs,
            discoveredModels: list.length > 0 ? list : getCuratedFallbackModels(provider, cleanBase),
            modelVerified: selectedModel
          });
        }
        if (resp.status === 401 || resp.status === 403) {
          return res.json({
            ok: false,
            status: 'invalid_key',
            message: 'Authentication failed (HTTP 401/403): Invalid API Key.'
          });
        }
        if (resp.status === 429) {
          return res.json({
            ok: false,
            status: 'rate_limit',
            message: 'Rate limit exceeded (HTTP 429) at provider endpoint.'
          });
        }
        if (resp.status === 404) {
          return res.json({
            ok: false,
            status: 'model_unavailable',
            message: `Endpoint or model not found (HTTP 404) at ${cleanBase}.`
          });
        }
      }
    } catch (err: any) {
      if (!apiKey && provider === 'openai-compatible') {
        return res.json({
          ok: false,
          status: 'invalid_key',
          message: 'Enter an API Key or select Qwen (Free Cloud Inference) / Google Gemini to test connection.'
        });
      }
      return res.json({
        ok: false,
        status: 'connection_error',
        message: `Could not reach ${cleanBase}: ${String(err?.message || 'Connection timed out').slice(0, 100)}`
      });
    }

    return res.json({
      ok: false,
      status: 'connection_error',
      message: `Unable to verify endpoint ${cleanBase}. Check your Base URL and credentials.`
    });
  });

  function isConversationalGreetingOrChitchat(
    question: string,
    selectedText = '',
    uploadedDocs: any[] = []
  ): boolean {
    const clean = String(question || '').trim();
    const lower = clean.toLowerCase().replace(/[!?.,;:'"]+/g, '').trim();
    if (
      /^(hi|hello|hey|yo|sup|howdy|greetings|good\s+(morning|afternoon|evening|night)|how\s+are\s+you(\s+doing)?|how('?s|\s+is)\s+it\s+going|what('?s|\s+is)\s+up|thanks|thank\s+you|thx|ty|cool|nice|ok|okay|got\s+it|awesome|great|bye|goodbye|see\s+ya|who\s+are\s+you|what\s+are\s+you|what\s+is\s+your\s+name)(\s+spidar|\s+there|\s+bro|\s+man|\s+friend)?$/i.test(
        lower
      )
    ) {
      return true;
    }
    const wordCount = lower.split(/\s+/).filter(Boolean).length;
    if (
      wordCount <= 2 &&
      !String(selectedText || '').trim() &&
      (!Array.isArray(uploadedDocs) || uploadedDocs.length === 0) &&
      !/\b(summarize|summary|page|article|thesis|explain|key|points|outline)\b/i.test(lower)
    ) {
      return true;
    }
    return false;
  }

  function buildIntelligentSystemInstruction(params: {
    question?: string;
    activeModel: string;
    relevantNeurons: any[];
    memoryFacts: any[];
    learnedTriplets: any[];
    articleTitle: string;
    articleText: string;
    selectedText?: string;
    uploadedDocs?: any[];
    webSearchSources?: WebSearchResultItem[];
    webSearchSummary?: string;
    reasoningEffort?: string;
  }): string {
    const {
      question = '',
      activeModel,
      relevantNeurons = [],
      memoryFacts = [],
      learnedTriplets = [],
      articleTitle,
      articleText,
      selectedText = '',
      uploadedDocs = [],
      webSearchSources = [],
      webSearchSummary = '',
      reasoningEffort
    } = params;

    // 1. Conversational Workflow: Simple greetings or brief chitchat should NOT trigger webpage research
    if (isConversationalGreetingOrChitchat(question, selectedText, uploadedDocs)) {
      const factsPreview =
        Array.isArray(memoryFacts) && memoryFacts.length > 0
          ? `\nKnown user/entity facts: ${memoryFacts
              .slice(0, 4)
              .map((f: any) => f.content)
              .join('; ')}`
          : '';
      return `You are SPIDAR (${activeModel}), an intelligent, articulate AI companion, web analyzer, and Second Brain assistant.
Respond naturally, warmly, and conversationally to the user's greeting or message in 1 to 3 concise sentences.
Do NOT summarize or analyze the webpage unless the user specifically asks about it.${factsPreview}`;
    }

    const neuronsBlock = Array.isArray(relevantNeurons) && relevantNeurons.length > 0
      ? relevantNeurons
          .slice(0, 6)
          .map((n: any) => {
            const rels = Array.isArray(n.synapseEdges)
              ? n.synapseEdges.map((e: any) => `${e.relation} -> ${e.targetId}`).join(', ')
              : '';
            return `- Node [[${n.title}]] (Category: ${n.category || 'knowledge'}, Weight ${n.strength || 1.5}x):\n  Insight: ${n.distilledInsight}\n  Passage: "${String(n.chunkText || '').slice(0, 360)}"${rels ? `\n  Graph Links: ${rels}` : ''}`;
          })
          .join('\n')
      : 'No matching Neural Graph nodes retrieved for this query.';

    const factsBlock = Array.isArray(memoryFacts) && memoryFacts.length > 0
      ? memoryFacts
          .slice(0, 8)
          .map((f: any) => `- ${f.content}`)
          .join('\n')
      : 'None.';

    const tripletsBlock = Array.isArray(learnedTriplets) && learnedTriplets.length > 0
      ? learnedTriplets
          .slice(0, 6)
          .map((t: any) => `- ${t.subject} -> ${t.relation} -> ${t.object}`)
          .join('\n')
      : 'None.';

    const uploadedDocsBlock = Array.isArray(uploadedDocs) && uploadedDocs.length > 0
      ? uploadedDocs
          .slice(0, 4)
          .map(
            (doc: any) =>
              `### Uploaded Document: "${doc.title}" (${String(doc.docType || 'source').toUpperCase()})\n${String(doc.content || '').slice(0, 2000)}`
          )
          .join('\n\n')
      : 'No external documents uploaded.';

    const selectedTextBlock = selectedText && String(selectedText).trim()
      ? `\nUSER-SELECTED TEXT ON WEBPAGE (Focus directly on this selection if the user's prompt refers to it):\n"""\n${String(selectedText).trim().slice(0, 1800)}\n"""\n`
      : '';

    const webSearchBlock =
      Array.isArray(webSearchSources) && webSearchSources.length > 0
        ? `\nLIVE WEB SEARCH & GROUNDING SOURCES RETRIEVED FOR THIS QUERY:
${webSearchSummary ? `Grounded Search Synthesis: ${webSearchSummary}\n` : ''}${webSearchSources
            .map(
              (s, i) =>
                `[${i + 1}] "${s.title}" (${s.url}) [${s.sourceType}]: ${s.snippet}`
            )
            .join('\n')}\n`
        : '';

    const effortDirective =
      reasoningEffort === 'high'
        ? 'REASONING DEPTH: HIGH — Provide rigorous, multi-layered analytical synthesis with concrete evidence, mechanisms, and trade-offs.'
        : reasoningEffort === 'low'
        ? 'REASONING DEPTH: LOW — Keep responses crisp, direct, and high-signal.'
        : 'REASONING DEPTH: MEDIUM — Balance analytical depth with clear structure.';

    const trimmedPageText = String(articleText || '').trim().slice(0, 3200);
    const webpageSection = trimmedPageText
      ? `\nCURRENT WEBPAGE CONTEXT:
- Webpage Title: "${articleTitle}"
- Webpage Content:
"""
${trimmedPageText}
"""`
      : '';

    return `You are SPIDAR (${activeModel}), an advanced, context-aware research, web analysis, outlining, and productivity assistant equipped with a persistent Neural Graph and Live Web Search Grounding.
${effortDirective}

CORE INTELLIGENCE, REASONING & CITATION RULES (CRITICAL):
1. **Understand Intent & Reason Deeply**: Analyze the user's true analytical intent rather than mechanically matching keywords. Handle complex multi-step questions, comparisons, causal explanations, and contextual follow-ups with intellectual rigor.
2. **Clearly Distinguish Retrieved Facts from AI Explanation**:
   - When citing facts from the Neural Graph, cite the node inline as [[Node Title]].
   - When citing facts from the Active Webpage or Uploaded Documents, reference the document/section title.
   - When citing facts from Live Web Search Sources, cite the source title and URL inline (e.g., [Source Title](URL)).
   - Clearly separate what was directly retrieved from sources versus your analytical synthesis or explanation.
3. **Never Ask Repetitive Clarification Questions When Context Exists**: Before asking the user for clarification, inspect the Retrieved Neural Graph Nodes, Learned Facts, Active Webpage, Selected Text, Uploaded Documents, Conversation History, and Live Web Search Sources below. If sufficient context exists in ANY of these sources, answer directly and comprehensively.
4. **Never Pretend to Remember Unstored Personal Facts or Fake Browsing**: If the user asks about a private personal detail or an unfamiliar private friend/entity (e.g. a bare personal name not found in the Neural Graph, Webpage, or Web Search), state honestly and professionally that it is not yet stored in your Neural Graph and ask for brief context. Never fabricate citations.

RETRIEVED NEURAL GRAPH NODES (Relevant to current query):
${neuronsBlock}

LEARNED FACTS & ENTITY CONTEXT:
${factsBlock}

RELATIONAL TRIPLETS:
${tripletsBlock}
${selectedTextBlock}${webSearchBlock}
UPLOADED RESEARCH & ASSIGNMENT DOCUMENTS:
${uploadedDocsBlock}${webpageSection}`;
  }

  // 2. Direct Conversational Chat & Context-Aware AI Endpoint (/api/ai/chat)
  app.post('/api/ai/chat', async (req, res) => {
    const {
      question,
      rawSystemPrompt = '',
      jsonMode = false,
      articleText = '',
      articleTitle = 'Current Tab',
      selectedText = '',
      uploadedDocs = [],
      memoryFacts = [],
      neurons = [],
      learnedTriplets = [],
      history = [],
      enableWebSearch,
      apiConfig = {}
    } = req.body || {};

    if (!question || !String(question).trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const activeModel = apiConfig.selectedModel || 'qwen2.5-72b-instruct-free';
    const provider = apiConfig.provider || 'qwen-free';
    const isConversational =
      !rawSystemPrompt &&
      isConversationalGreetingOrChitchat(String(question), String(selectedText), uploadedDocs);

    // Perform live Web Search & URL extraction ONLY when not a greeting and explicitly needed
    let webSearchSources: WebSearchResultItem[] = [];
    let webSearchSummary = '';
    if (
      !rawSystemPrompt &&
      !isConversational &&
      shouldTriggerWebSearch(String(question), String(articleText), enableWebSearch)
    ) {
      const searchRes = await performRealWebSearch(
        String(question),
        provider === 'gemini' ? apiConfig.apiKey : undefined
      );
      webSearchSources = searchRes.sources;
      webSearchSummary = searchRes.groundedSummary;
    }

    const systemInstruction = rawSystemPrompt
      ? String(rawSystemPrompt)
      : buildIntelligentSystemInstruction({
          question: String(question),
          activeModel,
          relevantNeurons: isConversational ? [] : neurons,
          memoryFacts,
          learnedTriplets: isConversational ? [] : learnedTriplets,
          articleTitle,
          articleText: isConversational ? '' : articleText,
          selectedText,
          uploadedDocs,
          webSearchSources,
          webSearchSummary,
          reasoningEffort: apiConfig.reasoningEffort
        });

    // 1. Try configured external provider (OpenAI, Anthropic, OpenRouter, Qwen Free with key, Qwen Local, OpenAI-Compatible)
    if (provider !== 'gemini') {
      const extResult = await callConfiguredExternalProvider(
        apiConfig,
        systemInstruction,
        String(question),
        history
      );
      if (extResult.text) {
        return res.json({
          answer: extResult.text,
          modelUsed: extResult.modelUsed || `${activeModel} (${provider})`,
          webSources: webSearchSources
        });
      }
      // If user explicitly chose OpenAI/Anthropic/OpenRouter, never silently downgrade—surface the real API error
      if (
        extResult.error &&
        (provider === 'openai' || provider === 'anthropic' || provider === 'openrouter')
      ) {
        return res.status(400).json({
          error: extResult.error,
          modelUsed: `${activeModel} (${provider})`
        });
      }
    }

    // 2. Call real Google GenAI SDK (gemini-3-flash-preview / gemini-3.1-flash-lite-preview)
    const ai = getGenAiClient(provider === 'gemini' ? apiConfig.apiKey : undefined);
    if (ai) {
      const recentHistoryText = Array.isArray(history)
        ? history
            .slice(-8)
            .map((m: any) => `${m.role === 'user' ? 'User' : 'SPIDAR'}: ${m.content}`)
            .join('\n\n')
        : '';

      const fullPrompt = recentHistoryText
        ? `Conversation history:\n${recentHistoryText}\n\nLatest user message: ${question}`
        : String(question);

      // When called with rawSystemPrompt/jsonMode (e.g. from Chrome Extension Qwen Free Cloud Bridge),
      // return the raw model output directly without wrapping in chat schema
      if (rawSystemPrompt) {
        const rawGen = await generateWithFallbackModels(
          ai,
          (model) => ({
            model,
            contents: fullPrompt,
            config: {
              systemInstruction,
              ...(jsonMode ? { responseMimeType: 'application/json' } : {})
            }
          }),
          apiConfig.reasoningEffort,
          provider === 'gemini' ? activeModel : undefined
        );
        const rawOut = (rawGen?.response?.text ?? '').trim();
        if (rawOut) {
          const effectiveLabel =
            provider === 'gemini'
              ? `${rawGen?.modelUsed || activeModel} (Google Gemini)`
              : `${activeModel} → ${rawGen?.modelUsed || 'gemini-3-flash-preview'}`;
          return res.json({
            answer: rawOut,
            modelUsed: effectiveLabel,
            webSources: []
          });
        }
      }

      const genResult = await generateWithFallbackModels(
        ai,
        (model) => ({
          model,
          contents: fullPrompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                answer: {
                  type: Type.STRING,
                  description:
                    'Your comprehensive, intelligent, context-aware response. Clearly distinguish retrieved facts/citations ([[Node Title]] or [Source Title](URL)) from analytical explanation.'
                },
                shouldTrainSpidar: {
                  type: Type.BOOLEAN,
                  description:
                    'Set to true ONLY if the user explicitly teaches a durable fact, introduces a person/entity with context, or asks you to remember something. Set to false for ordinary questions.'
                },
                trainedNeuronTitle: {
                  type: Type.STRING,
                  description:
                    'If shouldTrainSpidar is true, a concise title for the new Neural Graph node. Empty string otherwise.'
                },
                trainedInsight: {
                  type: Type.STRING,
                  description:
                    'If shouldTrainSpidar is true, a clear factual statement to store in the Neural Graph. Empty string otherwise.'
                },
                trainedKeyPhrases: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '2 to 4 key phrases or entity tags if shouldTrainSpidar is true.'
                }
              },
              required: [
                'answer',
                'shouldTrainSpidar',
                'trainedNeuronTitle',
                'trainedInsight',
                'trainedKeyPhrases'
              ]
            }
          }
        }),
        apiConfig.reasoningEffort,
        provider === 'gemini' ? activeModel : undefined
      );

      const rawText = (genResult?.response?.text ?? '').trim();
      if (rawText) {
        const effectiveModelLabel =
          provider === 'gemini'
            ? `${genResult?.modelUsed || activeModel} (Google Gemini)`
            : `${activeModel} → ${genResult?.modelUsed || 'gemini-3-flash-preview'}`;
        try {
          const parsed = JSON.parse(rawText);
          if (parsed && parsed.answer) {
            return res.json({
              answer: String(parsed.answer).trim(),
              modelUsed: effectiveModelLabel,
              webSources: webSearchSources,
              trainedNeuron:
                parsed.shouldTrainSpidar && parsed.trainedInsight
                  ? {
                      title: String(parsed.trainedNeuronTitle || 'Learned Knowledge Node').trim(),
                      insight: String(parsed.trainedInsight).trim(),
                      keyPhrases: Array.isArray(parsed.trainedKeyPhrases)
                        ? parsed.trainedKeyPhrases
                        : []
                    }
                  : null
            });
          }
        } catch {
          return res.json({
            answer: rawText,
            modelUsed: effectiveModelLabel,
            webSources: webSearchSources
          });
        }
      }
    }

    return res.status(503).json({
      error: 'AI provider is currently unreachable. Please check your API configuration in Extension Options.'
    });
  });

  // 2a. Real Multi-Provider Streaming SSE Endpoint (/api/ai/stream)
  app.post('/api/ai/stream', async (req, res) => {
    const {
      question,
      articleText = '',
      articleTitle = 'Current Tab',
      selectedText = '',
      uploadedDocs = [],
      memoryFacts = [],
      neurons = [],
      learnedTriplets = [],
      history = [],
      enableWebSearch,
      apiConfig = {}
    } = req.body || {};

    if (!question || !String(question).trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const activeModel = apiConfig.selectedModel || 'qwen2.5-72b-instruct-free';
    const provider = apiConfig.provider || 'qwen-free';
    const isConversational = isConversationalGreetingOrChitchat(
      String(question),
      String(selectedText),
      uploadedDocs
    );

    // Perform live Web Search & Grounding before streaming ONLY when not a greeting and explicitly needed
    let webSearchSources: WebSearchResultItem[] = [];
    let webSearchSummary = '';
    if (
      !isConversational &&
      shouldTriggerWebSearch(String(question), String(articleText), enableWebSearch)
    ) {
      const searchRes = await performRealWebSearch(
        String(question),
        provider === 'gemini' ? apiConfig.apiKey : undefined
      );
      webSearchSources = searchRes.sources;
      webSearchSummary = searchRes.groundedSummary;
      if (webSearchSources.length > 0) {
        res.write(`data: ${JSON.stringify({ webSources: webSearchSources })}\n\n`);
      }
    }

    const systemInstruction = buildIntelligentSystemInstruction({
      question: String(question),
      activeModel,
      relevantNeurons: isConversational ? [] : neurons,
      memoryFacts,
      learnedTriplets: isConversational ? [] : learnedTriplets,
      articleTitle,
      articleText: isConversational ? '' : articleText,
      selectedText,
      uploadedDocs,
      webSearchSources,
      webSearchSummary,
      reasoningEffort: apiConfig.reasoningEffort
    });

    // 1. If an external provider is selected (not gemini), try external provider first
    if (provider !== 'gemini') {
      const extResult = await callConfiguredExternalProvider(
        apiConfig,
        systemInstruction,
        String(question),
        history
      );
      if (extResult.text) {
        const modelLabel = extResult.modelUsed || `${activeModel} (${provider})`;
        const words = extResult.text.split(/(?<=\s)/);
        const step = Math.max(3, Math.ceil(words.length / 24));
        for (let i = 0; i < words.length; i += step) {
          const piece = words.slice(i, i + step).join('');
          res.write(`data: ${JSON.stringify({ delta: piece, modelUsed: modelLabel })}\n\n`);
        }
        res.write(`data: [DONE]\n\n`);
        return res.end();
      }
      if (
        extResult.error &&
        (provider === 'openai' || provider === 'anthropic' || provider === 'openrouter')
      ) {
        res.write(`data: ${JSON.stringify({ error: extResult.error, modelUsed: `${activeModel} (${provider})` })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        return res.end();
      }
    }

    // 2. Native Gemini Streaming via @google/genai SDK
    const ai = getGenAiClient(provider === 'gemini' ? apiConfig.apiKey : undefined);
    if (ai) {
      const recentHistoryText = Array.isArray(history)
        ? history
            .slice(-10)
            .map((m: any) => `${m.role === 'user' ? 'User' : 'SPIDAR'}: ${m.content}`)
            .join('\n\n')
        : '';

      const fullPrompt = recentHistoryText
        ? `Conversation history:\n${recentHistoryText}\n\nLatest user message: ${question}`
        : `Latest user message: ${question}`;

      const orderedModels = getOrderedGeminiModels(provider === 'gemini' ? activeModel : undefined);
      for (const model of orderedModels) {
        if (Date.now() < (modelQuotaCooldownUntil[model] || 0)) continue;
        try {
          const thinkingConfig = getThinkingConfigForModel(model, apiConfig.reasoningEffort);
          const streamResp = await ai.models.generateContentStream({
            model,
            contents: fullPrompt,
            config: {
              systemInstruction,
              ...(thinkingConfig ? { thinkingConfig } : {})
            }
          });

          const modelLabel =
            provider === 'gemini'
              ? `${model} (Google Gemini)`
              : `${activeModel} → ${model}`;

          let emitted = false;
          for await (const chunk of streamResp) {
            const textChunk = chunk?.text || '';
            if (textChunk) {
              emitted = true;
              res.write(`data: ${JSON.stringify({ delta: textChunk, modelUsed: modelLabel })}\n\n`);
            }
          }
          if (emitted) {
            res.write(`data: [DONE]\n\n`);
            return res.end();
          }
        } catch (err: any) {
          if (isQuotaOrRateLimitError(err)) {
            modelQuotaCooldownUntil[model] = Date.now() + 5 * 60 * 1000;
          }
          continue;
        }
      }
    }

    res.write(
      `data: ${JSON.stringify({
        error: 'Unable to stream from configured AI provider. Check API configuration in Extension Options.'
      })}\n\n`
    );
    res.write(`data: [DONE]\n\n`);
    return res.end();
  });

  function extractJsonBlock(raw: string): any {
    const cleaned = String(raw || '')
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const first = cleaned.indexOf('{');
      const last = cleaned.lastIndexOf('}');
      if (first !== -1 && last > first) {
        return JSON.parse(cleaned.slice(first, last + 1));
      }
      throw new Error('Invalid JSON response');
    }
  }

  // 2b. Drag-Spider-to-Chunk Natural Explainer Endpoint (/api/ai/explain-chunk)
  app.post('/api/ai/explain-chunk', async (req, res) => {
    const { chunkText = '', chunkIndex = 0, neurons = [], apiConfig = {} } = req.body || {};
    const cleanChunk = String(chunkText).trim();
    const provider = apiConfig?.provider || 'qwen-free';
    const activeModel = apiConfig?.selectedModel || 'qwen2.5-72b-instruct-free';
    const cacheKey = `${provider}:${activeModel}:${chunkIndex}:${cleanChunk.slice(0, 300)}`;

    if (chunkCache.has(cacheKey)) {
      return res.json(chunkCache.get(cacheKey));
    }

    const neuronsPreview = Array.isArray(neurons)
      ? neurons
          .slice(0, 5)
          .map((n: any) => `- ${n.title}: ${n.distilledInsight}`)
          .join('\n')
      : '';

    const chunkUserPrompt = `The user dragged the SPIDAR companion spider onto this specific chunk of text (Chunk #${
      Number(chunkIndex) + 1
    }) to summarize and explain it clearly.

Existing Neural Graph Nodes:
${neuronsPreview || 'None yet.'}

Target Text Chunk:
"""
${cleanChunk.slice(0, 2200)}
"""`;

    if (provider !== 'gemini' && provider !== 'qwen-free' && cleanChunk.length > 15) {
      const extRes = await callConfiguredExternalProvider(
        apiConfig,
        'You are SPIDAR Chunk Explainer. Return ONLY valid JSON matching: {"naturalSummary": "1-2 sentence summary", "plainExplanation": "Plain-English explanation of mechanisms & metrics", "whyItMatters": "1 sentence connecting to broader argument", "keyPhrases": ["phrase 1", "phrase 2", "phrase 3"]}.',
        chunkUserPrompt,
        []
      );
      if (extRes.text) {
        try {
          const parsed = extractJsonBlock(extRes.text);
          if (parsed.naturalSummary) {
            const payload = {
              ...parsed,
              modelUsed: extRes.modelUsed || `${activeModel} (${provider})`
            };
            chunkCache.set(cacheKey, payload);
            return res.json(payload);
          }
        } catch {
          // fall through
        }
      }
      if (extRes.error && (provider === 'openai' || provider === 'anthropic' || provider === 'openrouter')) {
        return res.status(400).json({ error: extRes.error });
      }
    }

    const ai = getGenAiClient(provider === 'gemini' ? apiConfig?.apiKey : undefined);
    if (ai && cleanChunk.length > 15) {
      const result = await generateWithFallbackModels(
        ai,
        (model) => ({
          model,
          contents: chunkUserPrompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                naturalSummary: {
                  type: Type.STRING,
                  description: 'A clear 1-2 sentence summary of what this chunk establishes.'
                },
                plainExplanation: {
                  type: Type.STRING,
                  description: 'A precise plain-English explanation of the mechanism, evidence, and metrics.'
                },
                whyItMatters: {
                  type: Type.STRING,
                  description: '1 sentence connecting this chunk to the broader argument or Neural Graph.'
                },
                keyPhrases: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3 to 5 key multi-word phrases or terms from this chunk.'
                }
              },
              required: ['naturalSummary', 'plainExplanation', 'whyItMatters', 'keyPhrases']
            }
          }
        }),
        apiConfig?.reasoningEffort,
        provider === 'gemini' ? activeModel : undefined
      );

      if (result?.response?.text) {
        try {
          const parsed = JSON.parse(result.response.text.trim());
          if (parsed.naturalSummary) {
            const payload = {
              ...parsed,
              modelUsed:
                provider === 'gemini'
                  ? `${result.modelUsed} (Google Gemini)`
                  : `${activeModel} → ${result.modelUsed}`
            };
            chunkCache.set(cacheKey, payload);
            return res.json(payload);
          }
        } catch {
          // continue
        }
      }
    }

    return res.status(503).json({ error: 'Unable to explain chunk with AI provider.' });
  });

  // 3. Structured Article Summarization Endpoint (/api/ai/summarize)
  app.post('/api/ai/summarize', async (req, res) => {
    const { text = '', title = 'Tab Analysis', lineContexts = [], apiConfig = {} } = req.body || {};
    const cleanText = String(text).trim();
    const provider = apiConfig?.provider || 'qwen-free';
    const activeModel = apiConfig?.selectedModel || 'qwen2.5-72b-instruct-free';
    const cacheKey = `${provider}:${activeModel}:${title}:${cleanText.slice(0, 400)}`;

    if (summaryCache.has(cacheKey)) {
      return res.json(summaryCache.get(cacheKey));
    }

    const linesPreview = Array.isArray(lineContexts)
      ? lineContexts
          .slice(0, 12)
          .map((l: any) => `Line ${l.lineIndex + 1}: ${l.text}`)
          .join('\n')
      : '';

    const summaryPrompt = `Analyze this webpage ("${title}") and its crawled line contexts. Synthesize an original, high-density executive analysis.

Crawled Line Contexts:
${linesPreview}

Full Text:
"""
${cleanText.slice(0, 6000)}
"""`;

    if (provider !== 'gemini' && provider !== 'qwen-free' && cleanText.length > 30) {
      const extRes = await callConfiguredExternalProvider(
        apiConfig,
        'You are SPIDAR Executive Web Analyzer. Return ONLY valid JSON matching: {"coreThesis": "1-2 sentence core thesis", "executiveBullets": ["takeaway 1", "takeaway 2", "takeaway 3"], "keyInsights": ["insight 1", "insight 2"], "actionItems": ["action 1", "action 2"]}.',
        summaryPrompt,
        []
      );
      if (extRes.text) {
        try {
          const parsed = extractJsonBlock(extRes.text);
          if (parsed.coreThesis) {
            const payload = {
              ...parsed,
              generatedBy: extRes.modelUsed || `${activeModel} (${provider})`
            };
            summaryCache.set(cacheKey, payload);
            return res.json(payload);
          }
        } catch {
          // fall through
        }
      }
      if (extRes.error && (provider === 'openai' || provider === 'anthropic' || provider === 'openrouter')) {
        return res.status(400).json({ error: extRes.error });
      }
    }

    const ai = getGenAiClient(provider === 'gemini' ? apiConfig.apiKey : undefined);
    if (ai && cleanText.length > 30) {
      const result = await generateWithFallbackModels(
        ai,
        (model) => ({
          model,
          contents: summaryPrompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                coreThesis: {
                  type: Type.STRING,
                  description: 'Synthesized 1-2 sentence core thesis explaining the main argument.'
                },
                executiveBullets: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3 synthesized key takeaways with concrete facts or metrics.'
                },
                keyInsights: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '2-3 deeper analytical implications or cross-paragraph connections.'
                },
                actionItems: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '2 concrete next steps or recommendations for the reader.'
                }
              },
              required: ['coreThesis', 'executiveBullets', 'keyInsights', 'actionItems']
            }
          }
        }),
        apiConfig.reasoningEffort,
        provider === 'gemini' ? activeModel : undefined
      );

      if (result?.response?.text) {
        try {
          const parsed = JSON.parse(result.response.text.trim());
          if (parsed.coreThesis) {
            const payload = {
              ...parsed,
              generatedBy:
                provider === 'gemini'
                  ? `${result.modelUsed} (Google Gemini)`
                  : `${activeModel} → ${result.modelUsed}`
            };
            summaryCache.set(cacheKey, payload);
            return res.json(payload);
          }
        } catch {
          // continue
        }
      }
    }

    return res.status(503).json({
      error: 'Unable to generate summary from AI provider.'
    });
  });

  // 4. Advanced Outline & Writing Engine: Generate Hierarchical Outline (/api/ai/outline)
  app.post('/api/ai/outline', async (req, res) => {
    const {
      assignmentPrompt = '',
      rubricCriteria = '',
      documentType = 'research_paper',
      webpageTitle = '',
      webpageText = '',
      selectedText = '',
      uploadedDocs = [],
      relevantNeurons = [],
      apiConfig = {}
    } = req.body || {};

    if (!assignmentPrompt || !String(assignmentPrompt).trim()) {
      return res.status(400).json({ error: 'Assignment instructions or topic prompt is required.' });
    }

    const provider = apiConfig.provider || 'qwen-free';
    const activeModel = apiConfig.selectedModel || 'qwen2.5-72b-instruct-free';

    // Retrieve live Web & Academic Search Sources to ground the outline in real citations
    const searchRes = await performRealWebSearch(
      String(assignmentPrompt).slice(0, 180),
      provider === 'gemini' ? apiConfig.apiKey : undefined
    );

    const webSourcesContext =
      searchRes.sources.length > 0
        ? searchRes.sources
            .map((s, i) => `- [Web/Academic Source #${i + 1}] "${s.title}" (${s.url}): ${s.snippet}`)
            .join('\n')
        : 'None retrieved.';

    const neuronsContext = Array.isArray(relevantNeurons) && relevantNeurons.length > 0
      ? relevantNeurons
          .slice(0, 10)
          .map(
            (n: any) =>
              `- [[${n.title}]]: ${n.distilledInsight} (Evidence: "${String(n.chunkText || '').slice(0, 300)}")`
          )
          .join('\n')
      : 'None.';

    const docsContext = Array.isArray(uploadedDocs) && uploadedDocs.length > 0
      ? uploadedDocs
          .slice(0, 6)
          .map(
            (d: any) =>
              `- [${String(d.docType || 'source').toUpperCase()}] "${d.title}":\n${String(d.content || '').slice(0, 2000)}`
          )
          .join('\n\n')
      : 'None.';

    const outlinePrompt = `You are SPIDAR's Advanced Academic & Research Outlining Engine.
Analyze the assignment instructions, grading rubric, source documents, webpage context, live web/academic search sources, and Neural Graph nodes below, then construct a rigorous, publication-grade hierarchical outline for a ${String(documentType).replace('_', ' ')}.

STRICT OUTLINING REQUIREMENTS:
- **NEVER use generic headings** like "Introduction", "Body Paragraph 1", "Main Point", or "Conclusion" alone. Every heading must state a substantive, content-specific analytical claim or section theme.
- **Avoid repetitive points and meaningless bullet lists**.
- Formulate a **strong, defensible Thesis Statement** and a coherent **Argument Architecture** explaining how the sections progress logically.
- Produce 4 to 6 structured sections (mix of Level 1 main sections and Level 2 subsections where appropriate).
- For EVERY section, provide:
  1. \`heading\`: Specific, substantive section title.
  2. \`level\`: 1 for major section, 2 for analytical subsection.
  3. \`coreArgument\`: The specific logical claim or sub-thesis established in this section.
  4. \`supportingEvidence\`: 2 to 3 concrete pieces of evidence, metrics, quotes, or examples drawn from the webpage, uploaded documents, live web search sources, or Neural Graph nodes.
  5. \`explanation\`: Analytical reasoning explaining HOW the evidence proves the claim and advances the overall thesis.
  6. \`counterargument\`: A credible counterargument, limitation, or alternative interpretation, paired with a rigorous rebuttal.
  7. \`sourceCitations\`: Specific source titles, URLs, or [[Neural Graph Node]] citations used in this section.

INPUT CONTEXT:
1. Assignment Instructions / Research Prompt:
"""
${String(assignmentPrompt).trim()}
"""

2. Grading Rubric / Evaluation Criteria:
"""
${String(rubricCriteria || 'Standard academic rigor: thesis clarity, evidence integration, analytical depth, counterargument handling, and structural coherence.').trim()}
"""

3. Selected Webpage Excerpt:
"""
${String(selectedText || 'None selected.').slice(0, 1500)}
"""

4. Uploaded Source & Assignment Documents:
${docsContext}

5. Retrieved Neural Graph Knowledge Nodes:
${neuronsContext}

6. Live Web & Academic Search Sources:
${webSourcesContext}

7. Active Webpage ("${webpageTitle}"):
"""
${String(webpageText || '').slice(0, 3500)}
"""`;

    if (provider !== 'gemini' && provider !== 'qwen-free') {
      const extOutline = await callConfiguredExternalProvider(
        apiConfig,
        'You are SPIDAR Academic Outlining Engine. Return ONLY valid JSON with keys: {"title": string, "assignmentAnalysis": {"coreObjective": string, "keyRequirements": string[], "rubricPriorities": string[], "toneAndAudience": string}, "thesisStatement": string, "argumentArchitecture": string, "sections": [{"heading": string, "level": 1, "coreArgument": string, "supportingEvidence": string[], "explanation": string, "counterargument": string, "sourceCitations": string[]}]}.',
        outlinePrompt,
        []
      );
      if (extOutline.text) {
        try {
          const parsed = extractJsonBlock(extOutline.text);
          if (parsed && parsed.thesisStatement && Array.isArray(parsed.sections)) {
            const sectionsWithIds = parsed.sections.map((sec: any, idx: number) => ({
              id: `sec-${Date.now()}-${idx}`,
              heading: String(sec.heading || `Section ${idx + 1}`),
              level: sec.level === 2 || sec.level === 3 ? sec.level : 1,
              coreArgument: String(sec.coreArgument || sec.claim || ''),
              supportingEvidence: Array.isArray(sec.supportingEvidence) ? sec.supportingEvidence : [],
              explanation: String(sec.explanation || ''),
              counterargument: String(sec.counterargument || ''),
              sourceCitations: Array.isArray(sec.sourceCitations) ? sec.sourceCitations : []
            }));

            return res.json({
              id: `outline-${Date.now()}`,
              title: parsed.title || 'Structured Analytical Outline',
              documentType,
              assignmentAnalysis: parsed.assignmentAnalysis || {
                coreObjective: String(assignmentPrompt).slice(0, 200),
                keyRequirements: ['Formulate defensible thesis', 'Integrate empirical evidence'],
                rubricPriorities: ['Analytical rigor', 'Counterargument handling'],
                toneAndAudience: 'Academic & Analytical'
              },
              thesisStatement: parsed.thesisStatement,
              argumentArchitecture: parsed.argumentArchitecture || parsed.argumentArc || '',
              sections: sectionsWithIds,
              modelUsed: extOutline.modelUsed || `${activeModel} (${provider})`,
              updatedAt: Date.now()
            });
          }
        } catch {
          // fall through
        }
      }
      if (extOutline.error && (provider === 'openai' || provider === 'anthropic' || provider === 'openrouter')) {
        return res.status(400).json({ error: extOutline.error });
      }
    }

    const ai = getGenAiClient(provider === 'gemini' ? apiConfig.apiKey : undefined);
    if (ai) {
      const result = await generateWithFallbackModels(
        ai,
        (model) => ({
          model,
          contents: outlinePrompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: 'Compelling, specific academic or professional title for the work.'
                },
                assignmentAnalysis: {
                  type: Type.OBJECT,
                  properties: {
                    coreObjective: {
                      type: Type.STRING,
                      description: '1-2 sentence synthesis of what the assignment/prompt fundamentally requires.'
                    },
                    keyRequirements: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: '3-4 specific deliverables or analytical tasks extracted from the prompt.'
                    },
                    rubricPriorities: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: '2-4 key evaluation criteria from the rubric and how this outline satisfies them.'
                    },
                    toneAndAudience: {
                      type: Type.STRING,
                      description: 'Target scholarly/professional register and intended audience.'
                    }
                  },
                  required: ['coreObjective', 'keyRequirements', 'rubricPriorities', 'toneAndAudience']
                },
                thesisStatement: {
                  type: Type.STRING,
                  description: 'A strong, arguable, nuanced 1-2 sentence thesis statement driving the entire work.'
                },
                argumentArchitecture: {
                  type: Type.STRING,
                  description: 'How the sections connect logically from premise to evidence, counterargument, and synthesis.'
                },
                sections: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      heading: {
                        type: Type.STRING,
                        description: 'Content-specific section heading (never generic).'
                      },
                      level: {
                        type: Type.INTEGER,
                        description: 'Hierarchy level: 1 for primary section, 2 for subsection.'
                      },
                      coreArgument: {
                        type: Type.STRING,
                        description: 'Logical argument or claim made in this section.'
                      },
                      supportingEvidence: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: '2-3 specific facts, metrics, quotes, or empirical points supporting the claim.'
                      },
                      explanation: {
                        type: Type.STRING,
                        description: 'Analytical explanation connecting the evidence to the thesis.'
                      },
                      counterargument: {
                        type: Type.STRING,
                        description: 'Relevant counterargument or limitation and how the section rebuts it.'
                      },
                      sourceCitations: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: 'Cited sources, URLs, document titles, or [[Node Titles]].'
                      }
                    },
                    required: [
                      'heading',
                      'level',
                      'coreArgument',
                      'supportingEvidence',
                      'explanation',
                      'counterargument',
                      'sourceCitations'
                    ]
                  }
                }
              },
              required: [
                'title',
                'assignmentAnalysis',
                'thesisStatement',
                'argumentArchitecture',
                'sections'
              ]
            }
          }
        }),
        'high',
        provider === 'gemini' ? activeModel : undefined
      );

      if (result?.response?.text) {
        try {
          const parsed = JSON.parse(result.response.text.trim());
          if (parsed && parsed.thesisStatement && Array.isArray(parsed.sections)) {
            const sectionsWithIds = parsed.sections.map((sec: any, idx: number) => ({
              id: `sec-${Date.now()}-${idx}`,
              heading: String(sec.heading || `Section ${idx + 1}`),
              level: sec.level === 2 || sec.level === 3 ? sec.level : 1,
              coreArgument: String(sec.coreArgument || ''),
              supportingEvidence: Array.isArray(sec.supportingEvidence) ? sec.supportingEvidence : [],
              explanation: String(sec.explanation || ''),
              counterargument: String(sec.counterargument || ''),
              sourceCitations: Array.isArray(sec.sourceCitations) ? sec.sourceCitations : []
            }));

            return res.json({
              id: `outline-${Date.now()}`,
              title: parsed.title || 'Structured Analytical Outline',
              documentType,
              assignmentAnalysis: parsed.assignmentAnalysis,
              thesisStatement: parsed.thesisStatement,
              argumentArchitecture: parsed.argumentArchitecture,
              sections: sectionsWithIds,
              modelUsed:
                provider === 'gemini'
                  ? `${result.modelUsed} (Google Gemini)`
                  : `${activeModel} → ${result.modelUsed}`,
              updatedAt: Date.now()
            });
          }
        } catch (err: any) {
          return res.status(500).json({
            error: `Failed to parse structured outline JSON: ${String(err?.message || err)}`
          });
        }
      }
    }

    return res.status(503).json({
      error: 'Unable to generate outline. Verify your AI provider connection in Extension Options.'
    });
  });

  // 5. Advanced Outline Section Transformer (/api/ai/outline-section)
  // Supports expanding, shortening, rewriting, strengthening counterarguments, or drafting a single section
  app.post('/api/ai/outline-section', async (req, res) => {
    const {
      outlineTitle = '',
      thesisStatement = '',
      section = {},
      action = 'expand', // 'expand' | 'shorten' | 'rewrite' | 'counterargument' | 'draft_section'
      customInstruction = '',
      webpageText = '',
      relevantNeurons = [],
      apiConfig = {}
    } = req.body || {};

    if (!section || !section.heading) {
      return res.status(400).json({ error: 'Target outline section is required.' });
    }

    const provider = apiConfig.provider || 'qwen-free';
    const activeModel = apiConfig.selectedModel || 'qwen2.5-72b-instruct-free';

    const actionDirectives: Record<string, string> = {
      expand:
        'EXPAND this section with deeper analytical granularity, additional concrete supporting evidence, and a more thorough explanation of the causal mechanisms.',
      shorten:
        'TIGHTEN and condense this section into its highest-signal core claim, sharpest evidence, and most concise analytical explanation without losing rigor.',
      rewrite:
        `REWRITE and sharpen this section to make the argument more original, compelling, and cohesive. ${customInstruction ? `User instruction: ${customInstruction}` : ''}`,
      counterargument:
        'STRENGTHEN the counterargument and rebuttal for this section: anticipate the strongest scholarly or technical objection and formulate a decisive, evidence-backed rebuttal.',
      draft_section:
        'WRITE A COMPLETE, PUBLICATION-READY PROSE DRAFT (2 to 3 cohesive paragraphs) for this section in `draftContent`, weaving together the core argument, supporting evidence, explanation, counterargument rebuttal, and citations while preserving the existing structured fields.'
    };

    const directive = actionDirectives[action] || actionDirectives.rewrite;
    const neuronsSnippet = Array.isArray(relevantNeurons)
      ? relevantNeurons
          .slice(0, 6)
          .map((n: any) => `- [[${n.title}]]: ${n.distilledInsight}`)
          .join('\n')
      : '';

    const prompt = `You are SPIDAR's Section Architecture & Writing Engine.
Overall Document Title: "${outlineTitle}"
Overall Thesis Statement: "${thesisStatement}"

Task Directive:
${directive}

Current Section State:
- Heading: ${section.heading}
- Level: ${section.level || 1}
- Core Argument: ${section.coreArgument}
- Supporting Evidence: ${JSON.stringify(section.supportingEvidence || [])}
- Analytical Explanation: ${section.explanation}
- Counterargument & Rebuttal: ${section.counterargument || 'None yet'}
- Citations: ${JSON.stringify(section.sourceCitations || [])}

Relevant Neural Graph Nodes:
${neuronsSnippet || 'None.'}

Reference Source Excerpt:
"""
${String(webpageText || '').slice(0, 2000)}
"""`;

    if (provider !== 'gemini' && provider !== 'qwen-free') {
      const extSec = await callConfiguredExternalProvider(
        apiConfig,
        'You are SPIDAR Section Refinement Engine. Return ONLY valid JSON with keys: {"heading": string, "coreArgument": string, "supportingEvidence": string[], "explanation": string, "counterargument": string, "sourceCitations": string[], "draftContent": string}.',
        prompt,
        []
      );
      if (extSec.text) {
        try {
          const parsed = extractJsonBlock(extSec.text);
          return res.json({
            section: {
              ...section,
              heading: parsed.heading || section.heading,
              coreArgument: parsed.coreArgument || parsed.claim || section.coreArgument,
              supportingEvidence:
                Array.isArray(parsed.supportingEvidence) && parsed.supportingEvidence.length > 0
                  ? parsed.supportingEvidence
                  : section.supportingEvidence,
              explanation: parsed.explanation || section.explanation,
              counterargument: parsed.counterargument || section.counterargument,
              sourceCitations:
                Array.isArray(parsed.sourceCitations) && parsed.sourceCitations.length > 0
                  ? parsed.sourceCitations
                  : section.sourceCitations,
              draftContent:
                action === 'draft_section' || section.draftContent
                  ? parsed.draftContent || parsed.draftedProse || section.draftContent
                  : section.draftContent
            },
            modelUsed: extSec.modelUsed || `${activeModel} (${provider})`
          });
        } catch {
          // fall through
        }
      }
    }

    const ai = getGenAiClient(provider === 'gemini' ? apiConfig.apiKey : undefined);
    if (ai) {
      const result = await generateWithFallbackModels(
        ai,
        (model) => ({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                heading: { type: Type.STRING },
                coreArgument: { type: Type.STRING },
                supportingEvidence: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                explanation: { type: Type.STRING },
                counterargument: { type: Type.STRING },
                sourceCitations: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                draftContent: {
                  type: Type.STRING,
                  description:
                    'Full multi-paragraph prose draft for this section if action is draft_section (or updated prose if already drafted).'
                }
              },
              required: [
                'heading',
                'coreArgument',
                'supportingEvidence',
                'explanation',
                'counterargument',
                'sourceCitations',
                'draftContent'
              ]
            }
          }
        }),
        apiConfig.reasoningEffort || 'medium',
        provider === 'gemini' ? activeModel : undefined
      );

      if (result?.response?.text) {
        try {
          const parsed = JSON.parse(result.response.text.trim());
          return res.json({
            section: {
              ...section,
              heading: parsed.heading || section.heading,
              coreArgument: parsed.coreArgument || section.coreArgument,
              supportingEvidence:
                Array.isArray(parsed.supportingEvidence) && parsed.supportingEvidence.length > 0
                  ? parsed.supportingEvidence
                  : section.supportingEvidence,
              explanation: parsed.explanation || section.explanation,
              counterargument: parsed.counterargument || section.counterargument,
              sourceCitations:
                Array.isArray(parsed.sourceCitations) && parsed.sourceCitations.length > 0
                  ? parsed.sourceCitations
                  : section.sourceCitations,
              draftContent:
                action === 'draft_section' || section.draftContent
                  ? parsed.draftContent || section.draftContent
                  : section.draftContent
            },
            modelUsed:
              provider === 'gemini'
                ? `${result.modelUsed} (Google Gemini)`
                : `${activeModel} → ${result.modelUsed}`
          });
        } catch (err: any) {
          return res.status(500).json({ error: `Failed to parse section update: ${String(err?.message || err)}` });
        }
      }
    }

    return res.status(503).json({ error: 'AI provider unavailable for section transformation.' });
  });

  // 6. Convert Structured Outline into Complete Cohesive Draft (/api/ai/outline-draft)
  app.post('/api/ai/outline-draft', async (req, res) => {
    const {
      outline,
      webpageText = '',
      uploadedDocs = [],
      relevantNeurons = [],
      apiConfig = {}
    } = req.body || {};

    if (!outline || !Array.isArray(outline.sections) || outline.sections.length === 0) {
      return res.status(400).json({ error: 'A valid structured outline with sections is required.' });
    }

    const sectionsBlueprint = outline.sections
      .map(
        (s: any, idx: number) =>
          `${idx + 1}. [H${s.level || 1}] ${s.heading}
   - Core Claim: ${s.coreArgument}
   - Evidence: ${(s.supportingEvidence || []).join(' | ')}
   - Analytical Explanation: ${s.explanation}
   - Counterargument & Rebuttal: ${s.counterargument || 'N/A'}
   - Citations: ${(s.sourceCitations || []).join(', ')}`
      )
      .join('\n\n');

    const docsSnippet = Array.isArray(uploadedDocs)
      ? uploadedDocs
          .slice(0, 4)
          .map((d: any) => `[${d.title}]: ${String(d.content || '').slice(0, 1200)}`)
          .join('\n')
      : '';

    const neuronsSnippet = Array.isArray(relevantNeurons)
      ? relevantNeurons
          .slice(0, 6)
          .map((n: any) => `[[${n.title}]]: ${n.distilledInsight}`)
          .join('\n')
      : '';

    const draftPrompt = `Convert the following structured outline into a complete, cohesive, publication-grade ${String(
      outline.documentType || 'research_paper'
    ).replace('_', ' ')} draft in clean Markdown.

REQUIREMENTS:
- Preserve the exact logical progression, Thesis Statement, and Argument Architecture of the outline.
- Use the section headings from the outline (` + '`##`' + ` for Level 1, ` + '`###`' + ` for Level 2).
- Write substantive, well-reasoned analytical paragraphs for every section—never output bare bullet lists in place of prose.
- Integrate the supporting evidence, quantitative metrics, analytical explanations, and counterargument rebuttals naturally into the prose.
- Include inline citations referencing the source documents or [[Neural Graph Nodes]].

OUTLINE BLUEPRINT:
Title: ${outline.title}
Thesis Statement: ${outline.thesisStatement}
Argument Architecture: ${outline.argumentArchitecture}

Sections:
${sectionsBlueprint}

Additional Grounding Context:
${neuronsSnippet}
${docsSnippet}
${String(webpageText || '').slice(0, 2000)}`;

    const provider = apiConfig.provider || 'qwen-free';
    if (provider !== 'gemini') {
      const extDraft = await callConfiguredExternalProvider(
        apiConfig,
        'You are an expert academic and technical writer. Produce a complete, rigorous Markdown draft faithfully following the user outline.',
        draftPrompt,
        []
      );
      if (extDraft.text) {
        return res.json({
          fullDraft: extDraft.text,
          modelUsed: extDraft.modelUsed || `${apiConfig.selectedModel} (${provider})`
        });
      }
    }

    const ai = getGenAiClient(provider === 'gemini' ? apiConfig.apiKey : undefined);
    if (ai) {
      const result = await generateWithFallbackModels(
        ai,
        (model) => ({
          model,
          contents: draftPrompt,
          config: {
            systemInstruction:
              'You are SPIDAR’s Academic & Technical Writing Engine. Transform structured outlines into complete, well-argued, cohesive prose drafts that preserve every claim, evidence item, and counterargument.'
          }
        }),
        'high'
      );

      if (result?.response?.text) {
        return res.json({
          fullDraft: result.response.text.trim(),
          modelUsed: `${result.modelUsed} (${provider})`
        });
      }
    }

    return res.status(503).json({
      error: 'Unable to generate full draft from AI provider.'
    });
  });

  // Helper to collect all live project source files + compiled production Chrome Extension MV3 bundle
  function collectAllProjectFiles(): { path: string; content: string; description: string; language: string }[] {
    const fileMap = new Map<string, { path: string; content: string; description: string; language: string }>();

    const addFile = (item: { path: string; content: string; description: string; language: string }) => {
      fileMap.set(item.path, item);
    };

    // 1. Place the ready-to-load unpacked Chrome Extension MV3 files directly at the ROOT
    // so the user can select the unzipped folder directly in chrome://extensions -> "Load unpacked"
    const extFiles = getAllExtensionFiles();
    for (const ef of extFiles) {
      addFile({
        path: ef.filename,
        content: ef.content,
        description: `Chrome Extension MV3 (Root): ${ef.description}`,
        language: ef.language
      });
    }

    // 2. Collect project root source files
    const rootFiles = [
      { rel: 'package.json', desc: 'Project dependencies & scripts', lang: 'json' },
      { rel: 'tsconfig.json', desc: 'TypeScript configuration', lang: 'json' },
      { rel: 'vite.config.ts', desc: 'Vite bundler configuration', lang: 'typescript' },
      { rel: 'index.html', desc: 'Web application HTML entry point', lang: 'html' },
      { rel: 'metadata.json', desc: 'Application metadata & capabilities', lang: 'json' },
      { rel: '.env.example', desc: 'Environment variable template', lang: 'text' },
      { rel: 'server.ts', desc: 'Full-stack Express & Multi-Provider AI backend server', lang: 'typescript' }
    ];

    for (const rf of rootFiles) {
      const fullPath = path.join(__dirname, rf.rel);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (rf.rel === 'index.html') {
          addFile({
            path: 'index.dev.html',
            content,
            description: 'Vite development HTML entry template',
            language: 'html'
          });
        }
        addFile({
          path: rf.rel,
          content,
          description: rf.desc,
          language: rf.lang
        });
      }
    }

    // 3. Collect all src/ TypeScript & React source files
    function walkDir(relDir: string) {
      const absDir = path.join(__dirname, relDir);
      if (!fs.existsSync(absDir)) return;
      const entries = fs.readdirSync(absDir, { withFileTypes: true });
      for (const entry of entries) {
        const relPath = path.posix.join(relDir, entry.name);
        if (entry.isDirectory()) {
          walkDir(relPath);
        } else if (entry.isFile() && /\.(ts|tsx|css|json|md|html|js)$/i.test(entry.name)) {
          const ext = path.extname(entry.name).toLowerCase();
          const lang =
            ext === '.ts' || ext === '.tsx'
              ? 'typescript'
              : ext === '.css'
              ? 'css'
              : ext === '.json'
              ? 'json'
              : ext === '.html'
              ? 'html'
              : 'javascript';
          addFile({
            path: relPath,
            content: fs.readFileSync(path.join(__dirname, relPath), 'utf8'),
            description: `Project source file (${relPath})`,
            language: lang
          });
        }
      }
    }

    walkDir('src');

    // 4. Synchronize AI Studio Preview & Installed Chrome Extension:
    // Bundle compiled dist/index.html, dist/popup.html, dist/options.html, dist/content.js,
    // dist/styles.css, and dist/assets/* at the root so the installed Chrome Extension mounts
    // the exact same React components & Tailwind CSS as the AI Studio Preview.
    const distDir = path.join(__dirname, 'dist');
    const distIndexHtmlPath = path.join(distDir, 'index.html');
    const distContentJsPath = path.join(distDir, 'content.js');
    const distStylesCssPath = path.join(distDir, 'styles.css');
    const distAssetsDir = path.join(distDir, 'assets');

    if (fs.existsSync(distIndexHtmlPath) && fs.statSync(distIndexHtmlPath).isFile()) {
      const compiledIndexHtml = fs.readFileSync(distIndexHtmlPath, 'utf8');

      addFile({
        path: 'index.html',
        content: compiledIndexHtml,
        description: 'Compiled React production entry point (Web Analyzer, Outline Studio, Neural Graph & Options)',
        language: 'html'
      });

      const compiledPopupHtml = compiledIndexHtml
        .replace(
          '</head>',
          '  <style>html, body { width: 370px; min-height: 500px; margin: 0; padding: 0; background: #090d15; overflow-x: hidden; }</style>\n  </head>'
        )
        .replace(/<body([^>]*)>/i, '<body$1 data-spidar-view="popup">');

      addFile({
        path: 'popup.html',
        content: compiledPopupHtml,
        description: 'Unified React Chrome Extension Toolbar Popup (Single Source of Truth with AI Studio Preview)',
        language: 'html'
      });

      const compiledOptionsHtml = compiledIndexHtml.replace(
        /<body([^>]*)>/i,
        '<body$1 data-spidar-view="options" style="margin:0;background:#06090f;">'
      );

      addFile({
        path: 'options.html',
        content: compiledOptionsHtml,
        description: 'Unified React Chrome Extension Options Page (Single Source of Truth with AI Studio Preview)',
        language: 'html'
      });
    }

    if (fs.existsSync(distContentJsPath) && fs.statSync(distContentJsPath).isFile()) {
      addFile({
        path: 'content.js',
        content: fs.readFileSync(distContentJsPath, 'utf8'),
        description: 'Compiled React Shadow DOM Content Script (src/contentScript.tsx -> SpidarCompanionOverlay, SpiderSvg & IntelligenceCard)',
        language: 'javascript'
      });
    }

    if (fs.existsSync(distStylesCssPath) && fs.statSync(distStylesCssPath).isFile()) {
      addFile({
        path: 'styles.css',
        content: fs.readFileSync(distStylesCssPath, 'utf8'),
        description: 'Compiled Tailwind CSS v4 & Shadow DOM stylesheet for the Chrome Extension Content Script',
        language: 'css'
      });
    }

    if (fs.existsSync(distAssetsDir) && fs.statSync(distAssetsDir).isDirectory()) {
      const assetEntries = fs.readdirSync(distAssetsDir, { withFileTypes: true });
      for (const entry of assetEntries) {
        if (entry.isFile() && /\.(js|css|json|svg)$/i.test(entry.name)) {
          const ext = path.extname(entry.name).toLowerCase();
          const lang = ext === '.css' ? 'css' : ext === '.json' ? 'json' : 'javascript';
          addFile({
            path: path.posix.join('assets', entry.name),
            content: fs.readFileSync(path.join(distAssetsDir, entry.name), 'utf8'),
            description: `Compiled production bundle asset (assets/${entry.name})`,
            language: lang
          });
        }
      }
    }

    return Array.from(fileMap.values());
  }

  async function buildCompleteProjectZipBuffer(): Promise<Buffer> {
    const zip = new JSZip();
    const allFiles = collectAllProjectFiles();
    for (const file of allFiles) {
      zip.file(file.path, file.content);
    }
    return await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
  }

  // Direct Download URLs for the complete SPIDAR v2.7 Source Code + Chrome Extension ZIP
  const serveCompleteZip = async (_req: express.Request, res: express.Response) => {
    try {
      const zipBuffer = await buildCompleteProjectZipBuffer();
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="spidar-v2.7-complete-source.zip"');
      res.setHeader('Content-Length', String(zipBuffer.length));
      res.setHeader('Cache-Control', 'no-store');
      return res.send(zipBuffer);
    } catch (err: any) {
      return res.status(500).json({ error: `Failed to generate ZIP: ${String(err?.message || err)}` });
    }
  };

  app.get('/download.zip', serveCompleteZip);
  app.get('/spidar-v2.7-complete-source.zip', serveCompleteZip);
  app.get('/api/download-source-zip', serveCompleteZip);

  app.get('/api/source-files', (_req, res) => {
    try {
      const files = collectAllProjectFiles();
      return res.json({
        count: files.length,
        files
      });
    } catch (err: any) {
      return res.status(500).json({ error: String(err?.message || err) });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SPIDAR server running on http://localhost:${PORT}`);
  });
}

startServer();
