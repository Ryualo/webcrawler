/**
 * SPIDAR v2.7 — Unified Chrome Extension & AI Studio Preview Bridge
 * Provides a Single Source of Truth across:
 *   1. Google AI Studio Browser Preview (http://localhost:3000 & Cloud Run URL)
 *   2. Installed Chrome Extension Popup (popup.html / index.html?view=popup)
 *   3. Installed Chrome Extension Options Page (options.html / index.html?view=options)
 *   4. Installed Chrome Extension Full Studio Tabs (index.html?view=analyzer | outline-studio | neural-graph)
 *   5. Content Script On-Page Companion (content.js <-> chrome.storage.local)
 */

import {
  ApiConfig,
  AiProviderId,
  NeuralKnowledgeBase,
  ProviderProfileConfig
} from '../types';
import { createDefaultKnowledgeBase } from './neuralMemory';

export type SpidarSurfaceMode =
  | 'analyzer'
  | 'outline-studio'
  | 'neural-graph'
  | 'extension-options'
  | 'popup'
  | 'companion';

export interface LiveBrowserTabSnapshot {
  id: string;
  title: string;
  url: string;
  category: string;
  readTime: string;
  paragraphs: string[];
  selectedText?: string;
  tabId?: number;
  updatedAt?: number;
}

export const STORAGE_KEYS = {
  ACTIVE_CONFIG: 'spidar_api_config_v2_5',
  PROVIDER_PROFILES: 'spidar_provider_configs_v2_7',
  NEURAL_VAULT: 'spidar_neural_vault_v2_5',
  LEGACY_MEMORY: 'spidar_memory_v2_5',
  ACTIVE_TAB_SNAPSHOT: 'spidar_active_tab_context_v2_7'
} as const;

export const SPIDAR_CLOUD_BACKEND_URL =
  'https://ais-pre-ete2tpa2iqsjgml4b4irbp-243786387909.asia-northeast1.run.app';

export const SPIDAR_CLOUD_BACKEND_FALLBACK_URLS = [
  'https://ais-pre-ete2tpa2iqsjgml4b4irbp-243786387909.asia-northeast1.run.app',
  'https://ais-dev-ete2tpa2iqsjgml4b4irbp-243786387909.asia-northeast1.run.app'
];

declare const chrome: any;

/**
 * Returns true when running inside an installed Chrome/Edge Manifest V3 extension page (popup/options/tab).
 */
export function isChromeExtensionContext(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof chrome !== 'undefined' &&
      Boolean(chrome?.runtime?.id) &&
      window.location.protocol === 'chrome-extension:'
    );
  } catch {
    return false;
  }
}

/**
 * Returns true when running inside ANY Chrome extension context, including both
 * extension pages (chrome-extension://) AND content scripts injected into http/https webpages.
 */
export function isChromeExtensionRuntime(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (window.location.protocol === 'chrome-extension:') return true;
    if (typeof chrome !== 'undefined' && Boolean(chrome?.runtime?.id)) return true;
    // Also return true if running on an external webpage that is not the local/studio backend host
    const host = window.location.hostname || '';
    if (
      host &&
      host !== 'localhost' &&
      host !== '127.0.0.1' &&
      !host.includes('ete2tpa2iqsjgml4b4irbp')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Returns true if chrome.storage.local is accessible in the current execution context.
 */
export function hasChromeStorage(): boolean {
  try {
    return typeof chrome !== 'undefined' && Boolean(chrome?.storage?.local);
  } catch {
    return false;
  }
}

/**
 * Determines which SPIDAR surface mode should mount based on HTML data attributes or URL query params.
 */
export function getInitialSurfaceMode(): SpidarSurfaceMode {
  if (typeof window === 'undefined') return 'analyzer';

  const bodyView = document.body?.getAttribute('data-spidar-view')?.trim().toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const queryView = (params.get('view') || '').trim().toLowerCase();
  const effective = queryView || bodyView || '';

  if (effective === 'popup') return 'popup';
  if (effective === 'options' || effective === 'extension-options') return 'extension-options';
  if (effective === 'outline' || effective === 'outline-studio') return 'outline-studio';
  if (effective === 'graph' || effective === 'neural-graph') return 'neural-graph';
  if (effective === 'companion') return 'companion';

  const pathname = window.location.pathname.toLowerCase();
  if (pathname.endsWith('/popup.html')) return 'popup';
  if (pathname.endsWith('/options.html')) return 'extension-options';

  return 'analyzer';
}

/**
 * Updates the browser URL `?view=` parameter cleanly without reloading the page.
 */
export function syncUrlSurfaceMode(mode: SpidarSurfaceMode): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (mode === 'analyzer' && !url.pathname.endsWith('popup.html') && !url.pathname.endsWith('options.html')) {
      url.searchParams.delete('view');
    } else {
      const paramValue = mode === 'extension-options' ? 'options' : mode;
      url.searchParams.set('view', paramValue);
    }
    window.history.replaceState({}, '', url.toString());
  } catch {
    // Ignore history state errors in restricted frames
  }
}

/**
 * Opens or switches to a specific SPIDAR surface.
 * - If inside the compact Chrome Extension toolbar popup, opens a full Chrome tab (or Options page)
 *   so complex workspaces like Outline Studio, Neural Graph, or Extension Options have full viewport space.
 * - Otherwise switches the active React view directly.
 */
export function navigateToSpidarSurface(
  targetMode: 'analyzer' | 'outline-studio' | 'neural-graph' | 'extension-options',
  currentSurfaceMode: SpidarSurfaceMode,
  setWorkbenchTab?: (tab: 'analyzer' | 'outline-studio' | 'neural-graph' | 'extension-options') => void
): void {
  if (isChromeExtensionContext() && currentSurfaceMode === 'popup') {
    try {
      const viewParam = targetMode === 'extension-options' ? 'options' : targetMode;
      const targetUrl = chrome.runtime.getURL(`index.html?view=${viewParam}`);
      if (chrome?.tabs?.create) {
        chrome.tabs.create({ url: targetUrl });
        window.close();
        return;
      }
    } catch {
      // Fallback to in-place state update
    }
  }

  if (setWorkbenchTab) {
    setWorkbenchTab(targetMode);
    syncUrlSurfaceMode(targetMode);
  }
}

/**
 * Synchronizes ApiConfig & Provider Profiles to both localStorage and chrome.storage.local.
 */
export function persistConfigEverywhere(
  activeConfig: ApiConfig,
  allProfiles?: Record<AiProviderId, ProviderProfileConfig>
): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CONFIG, JSON.stringify(activeConfig));
      if (allProfiles) {
        localStorage.setItem(STORAGE_KEYS.PROVIDER_PROFILES, JSON.stringify(allProfiles));
      }
    } catch {
      // Ignore quota errors
    }
  }

  if (hasChromeStorage()) {
    try {
      const payload: Record<string, unknown> = {
        [STORAGE_KEYS.ACTIVE_CONFIG]: activeConfig
      };
      if (allProfiles) {
        payload[STORAGE_KEYS.PROVIDER_PROFILES] = allProfiles;
      }
      chrome.storage.local.set(payload);
    } catch {
      // Ignore storage errors
    }
  }
}

/**
 * Synchronizes NeuralKnowledgeBase to both localStorage and chrome.storage.local
 * (including backwards-compatible `spidar_memory_v2_5` array for content scripts).
 */
export function persistKnowledgeBaseEverywhere(kb: NeuralKnowledgeBase): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEYS.NEURAL_VAULT, JSON.stringify(kb));
    } catch {
      // Ignore quota errors
    }
  }

  if (hasChromeStorage()) {
    try {
      const compactMemory = (kb.neurons || []).slice(0, 60).map((n) => ({
        id: n.id,
        title: n.title,
        content: n.distilledInsight || n.chunkText,
        keyPhrases: n.keyPhrases || [],
        category: n.category || 'manual_deep_read',
        sourceTab: n.sourceTab || 'SPIDAR Studio',
        timestamp: n.timestamp || Date.now()
      }));
      chrome.storage.local.set({
        [STORAGE_KEYS.NEURAL_VAULT]: kb,
        [STORAGE_KEYS.LEGACY_MEMORY]: compactMemory
      });
    } catch {
      // Ignore storage errors
    }
  }
}

/**
 * Merges any neurons saved by the on-page content script (`spidar_memory_v2_5`)
 * into the full `NeuralKnowledgeBase` (`spidar_neural_vault_v2_5`).
 */
export function mergeContentScriptMemoryIntoVault(
  vault: NeuralKnowledgeBase | null | undefined,
  contentScriptItems: any[] | null | undefined
): NeuralKnowledgeBase {
  const base: NeuralKnowledgeBase =
    vault && Array.isArray(vault.neurons) && Array.isArray(vault.facts)
      ? { ...vault, neurons: [...vault.neurons], facts: [...vault.facts] }
      : createDefaultKnowledgeBase();

  if (!Array.isArray(contentScriptItems) || contentScriptItems.length === 0) {
    return base;
  }

  let modified = false;
  for (const item of contentScriptItems) {
    const rawContent = String(item?.content || '').trim();
    if (!rawContent || rawContent.length < 8) continue;
    const rawTitle = String(
      item?.title ||
        rawContent
          .split(/\s+/)
          .slice(0, 6)
          .join(' ')
    ).trim();

    const exists = base.neurons.some(
      (n) =>
        n.id === item.id ||
        n.title.toLowerCase() === rawTitle.toLowerCase() ||
        n.chunkText.toLowerCase() === rawContent.toLowerCase()
    );

    if (!exists) {
      modified = true;
      base.neurons.unshift({
        id: String(item.id || `ext-neuron-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
        title: rawTitle,
        chunkText: rawContent,
        distilledInsight: rawContent.slice(0, 260),
        keyPhrases: Array.isArray(item.keyPhrases) ? item.keyPhrases : ['web context'],
        synapses: base.neurons[0] ? [base.neurons[0].id] : [],
        synapseEdges: base.neurons[0]
          ? [{ targetId: base.neurons[0].id, relation: 'related_to', weight: 1.5 }]
          : [],
        strength: 1.8,
        sourceTab: String(item.sourceTab || 'Active Chrome Tab'),
        timestamp: Number(item.timestamp || Date.now()),
        category: item.category === 'entity_context' ? 'entity_context' : 'manual_deep_read',
        retentionDepth: 95,
        fullSentences: [rawContent]
      });
    }
  }

  if (modified) {
    base.updatedAt = Date.now();
  }
  return base;
}

/**
 * Loads initial synchronized state from `chrome.storage.local` when running inside the extension,
 * and subscribes to live storage updates across Popup, Options, Content Script, and Studio tabs.
 */
export function subscribeToCrossContextSync(callbacks: {
  onApiConfigSync?: (config: ApiConfig) => void;
  onKnowledgeBaseSync?: (kb: NeuralKnowledgeBase) => void;
  onActiveTabSnapshotSync?: (snapshot: LiveBrowserTabSnapshot) => void;
}): () => void {
  let isMounted = true;

  if (hasChromeStorage()) {
    try {
      chrome.storage.local.get(
        [
          STORAGE_KEYS.ACTIVE_CONFIG,
          STORAGE_KEYS.PROVIDER_PROFILES,
          STORAGE_KEYS.NEURAL_VAULT,
          STORAGE_KEYS.LEGACY_MEMORY,
          STORAGE_KEYS.ACTIVE_TAB_SNAPSHOT
        ],
        (res: Record<string, any>) => {
          if (!isMounted || !res) return;

          if (res[STORAGE_KEYS.PROVIDER_PROFILES]) {
            try {
              localStorage.setItem(
                STORAGE_KEYS.PROVIDER_PROFILES,
                JSON.stringify(res[STORAGE_KEYS.PROVIDER_PROFILES])
              );
            } catch {
              // ignore
            }
          }

          if (res[STORAGE_KEYS.ACTIVE_CONFIG] && callbacks.onApiConfigSync) {
            const cfg = res[STORAGE_KEYS.ACTIVE_CONFIG] as ApiConfig;
            try {
              localStorage.setItem(STORAGE_KEYS.ACTIVE_CONFIG, JSON.stringify(cfg));
            } catch {
              // ignore
            }
            callbacks.onApiConfigSync(cfg);
          }

          if (res[STORAGE_KEYS.NEURAL_VAULT] || res[STORAGE_KEYS.LEGACY_MEMORY]) {
            const merged = mergeContentScriptMemoryIntoVault(
              res[STORAGE_KEYS.NEURAL_VAULT],
              res[STORAGE_KEYS.LEGACY_MEMORY]
            );
            try {
              localStorage.setItem(STORAGE_KEYS.NEURAL_VAULT, JSON.stringify(merged));
            } catch {
              // ignore
            }
            if (callbacks.onKnowledgeBaseSync) {
              callbacks.onKnowledgeBaseSync(merged);
            }
          }

          if (res[STORAGE_KEYS.ACTIVE_TAB_SNAPSHOT] && callbacks.onActiveTabSnapshotSync) {
            callbacks.onActiveTabSnapshotSync(res[STORAGE_KEYS.ACTIVE_TAB_SNAPSHOT]);
          }
        }
      );
    } catch {
      // Ignore initial read error
    }
  }

  const handleChromeStorageChange = (
    changes: Record<string, { newValue?: any }>,
    areaName: string
  ) => {
    if (!isMounted || areaName !== 'local') return;

    if (changes[STORAGE_KEYS.ACTIVE_CONFIG]?.newValue && callbacks.onApiConfigSync) {
      const nextCfg = changes[STORAGE_KEYS.ACTIVE_CONFIG].newValue as ApiConfig;
      try {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_CONFIG, JSON.stringify(nextCfg));
      } catch {
        // ignore
      }
      callbacks.onApiConfigSync(nextCfg);
    }

    if (changes[STORAGE_KEYS.NEURAL_VAULT]?.newValue && callbacks.onKnowledgeBaseSync) {
      const nextKb = changes[STORAGE_KEYS.NEURAL_VAULT].newValue as NeuralKnowledgeBase;
      try {
        localStorage.setItem(STORAGE_KEYS.NEURAL_VAULT, JSON.stringify(nextKb));
      } catch {
        // ignore
      }
      callbacks.onKnowledgeBaseSync(nextKb);
    } else if (changes[STORAGE_KEYS.LEGACY_MEMORY]?.newValue && callbacks.onKnowledgeBaseSync) {
      let currentVault: NeuralKnowledgeBase | null = null;
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.NEURAL_VAULT);
        if (raw) currentVault = JSON.parse(raw);
      } catch {
        // ignore
      }
      const merged = mergeContentScriptMemoryIntoVault(
        currentVault,
        changes[STORAGE_KEYS.LEGACY_MEMORY].newValue
      );
      callbacks.onKnowledgeBaseSync(merged);
    }

    if (changes[STORAGE_KEYS.ACTIVE_TAB_SNAPSHOT]?.newValue && callbacks.onActiveTabSnapshotSync) {
      callbacks.onActiveTabSnapshotSync(changes[STORAGE_KEYS.ACTIVE_TAB_SNAPSHOT].newValue);
    }
  };

  const handleWindowStorage = (e: StorageEvent) => {
    if (!isMounted || !e.newValue) return;
    try {
      if (e.key === STORAGE_KEYS.ACTIVE_CONFIG && callbacks.onApiConfigSync) {
        callbacks.onApiConfigSync(JSON.parse(e.newValue));
      } else if (e.key === STORAGE_KEYS.NEURAL_VAULT && callbacks.onKnowledgeBaseSync) {
        callbacks.onKnowledgeBaseSync(JSON.parse(e.newValue));
      }
    } catch {
      // ignore parse errors
    }
  };

  if (hasChromeStorage() && chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener(handleChromeStorageChange);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleWindowStorage);
  }

  return () => {
    isMounted = false;
    if (hasChromeStorage() && chrome?.storage?.onChanged) {
      chrome.storage.onChanged.removeListener(handleChromeStorageChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleWindowStorage);
    }
  };
}

/**
 * Queries the active HTTP/HTTPS browser tab when running inside Chrome Extension
 * and extracts its live DOM paragraphs, title, URL, and selected text.
 */
export async function captureLiveActiveChromeTab(): Promise<LiveBrowserTabSnapshot | null> {
  if (!isChromeExtensionContext() || !chrome?.tabs?.query) {
    return null;
  }

  try {
    const tabs: any[] = await chrome.tabs.query({ currentWindow: true });
    const targetTab =
      tabs.find(
        (t) =>
          t.active &&
          typeof t.url === 'string' &&
          (t.url.startsWith('http://') || t.url.startsWith('https://'))
      ) ||
      tabs.find(
        (t) =>
          typeof t.url === 'string' &&
          (t.url.startsWith('http://') || t.url.startsWith('https://'))
      );

    if (!targetTab || !targetTab.id) {
      return null;
    }

    // 1. Try asking content.js for extracted page paragraphs
    try {
      const response = await chrome.tabs.sendMessage(targetTab.id, {
        type: 'SPIDAR_EXTRACT_PAGE_CONTEXT'
      });
      if (response && Array.isArray(response.paragraphs) && response.paragraphs.length > 0) {
        const snapshot: LiveBrowserTabSnapshot = {
          id: 'tab-live-chrome',
          title: response.title || targetTab.title || 'Active Browser Tab',
          url: response.url || targetTab.url || 'https://active-tab',
          category: 'Live Chrome Tab',
          readTime: `${Math.max(1, Math.ceil(response.paragraphs.join(' ').split(/\s+/).length / 200))} min read`,
          paragraphs: response.paragraphs,
          selectedText: response.selectedText || '',
          tabId: targetTab.id,
          updatedAt: Date.now()
        };
        if (hasChromeStorage()) {
          chrome.storage.local.set({ [STORAGE_KEYS.ACTIVE_TAB_SNAPSHOT]: snapshot });
        }
        return snapshot;
      }
    } catch {
      // Content script might not be injected yet; fall back to chrome.scripting.executeScript
    }

    // 2. Fallback: extract paragraphs via chrome.scripting.executeScript
    if (chrome?.scripting?.executeScript) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: targetTab.id },
        func: () => {
          const blocks = Array.from(
            document.querySelectorAll('article p, main p, p, h1, h2, h3, li, blockquote')
          )
            .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
            .filter((txt) => txt.length >= 45)
            .slice(0, 36);
          const fallback =
            blocks.length > 0
              ? blocks
              : [(document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 3000)].filter(
                  Boolean
                );
          return {
            title: document.title || 'Active Webpage',
            url: window.location.href,
            selectedText: (window.getSelection()?.toString() || '').trim(),
            paragraphs: fallback
          };
        }
      });

      const extracted = results?.[0]?.result;
      if (extracted && Array.isArray(extracted.paragraphs) && extracted.paragraphs.length > 0) {
        const snapshot: LiveBrowserTabSnapshot = {
          id: 'tab-live-chrome',
          title: extracted.title || targetTab.title || 'Active Browser Tab',
          url: extracted.url || targetTab.url || 'https://active-tab',
          category: 'Live Chrome Tab',
          readTime: `${Math.max(1, Math.ceil(extracted.paragraphs.join(' ').split(/\s+/).length / 200))} min read`,
          paragraphs: extracted.paragraphs,
          selectedText: extracted.selectedText || '',
          tabId: targetTab.id,
          updatedAt: Date.now()
        };
        if (hasChromeStorage()) {
          chrome.storage.local.set({ [STORAGE_KEYS.ACTIVE_TAB_SNAPSHOT]: snapshot });
        }
        return snapshot;
      }
    }
  } catch {
    // Ignore tab permission errors on restricted chrome:// pages
  }

  return null;
}

/**
 * Triggers the 1:1 center-locked downward spider crawl on the active Chrome tab's content script
 * AND returns whether a live tab message was dispatched.
 */
export async function triggerActiveChromeTabCrawl(
  spiderSpeed: number,
  mode: 'visible' | 'full-tab' = 'full-tab'
): Promise<boolean> {
  if (!isChromeExtensionContext() || !chrome?.tabs?.query) {
    return false;
  }

  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (
      activeTab?.id &&
      typeof activeTab.url === 'string' &&
      (activeTab.url.startsWith('http://') || activeTab.url.startsWith('https://'))
    ) {
      await chrome.tabs.sendMessage(activeTab.id, {
        type: 'SPIDAR_TRIGGER_CRAWL',
        mode,
        speed: spiderSpeed,
        spiderSpeed
      });
      return true;
    }
  } catch {
    // Active tab may be the extension's own workbench tab or a restricted page
  }

  return false;
}
