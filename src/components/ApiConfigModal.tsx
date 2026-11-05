import React, { useState, useEffect, useMemo } from 'react';
import {
  Sliders,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Search,
  Zap,
  ShieldCheck,
  Activity,
  X
} from 'lucide-react';
import {
  ApiConfig,
  AiProviderId,
  ReasoningEffort,
  CustomHeader,
  ProviderProfileConfig,
  ConnectionTestResult
} from '../types';
import {
  AI_PROVIDER_DEFINITIONS,
  getProviderDefinition,
  getDefaultModelsForProvider,
  getModelCapabilityInfo,
  searchModelsWithCapabilities,
  loadAllProviderProfiles,
  saveProviderProfileToStorage,
  formatPricePerMillion,
  formatContextWindow
} from '../utils/aiProviders';
import { fetchAvailableModels, testProviderConnection } from '../utils/apiProxy';

export interface ExtensionOptionsPanelProps {
  config: ApiConfig;
  onSaveConfig: (newConfig: ApiConfig) => void;
  onClose?: () => void;
  isEmbeddedPage?: boolean;
}

export const ExtensionOptionsPanel: React.FC<ExtensionOptionsPanelProps> = ({
  config,
  onSaveConfig,
  onClose,
  isEmbeddedPage = false
}) => {
  const [profiles, setProfiles] = useState<Record<AiProviderId, ProviderProfileConfig>>(() =>
    loadAllProviderProfiles()
  );
  const [activeProvider, setActiveProvider] = useState<AiProviderId>(config.provider || 'qwen-free');
  const [baseUrl, setBaseUrl] = useState<string>(config.baseUrl || 'https://text.pollinations.ai/openai');
  const [apiKey, setApiKey] = useState<string>(config.apiKey || '');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>(
    config.selectedModel || 'qwen2.5-72b-instruct-free'
  );
  const [availableModels, setAvailableModels] = useState<string[]>(
    config.availableModels || ['qwen2.5-72b-instruct-free', 'qwen2.5-coder-32b-free', 'qwq-32b-reasoning-free']
  );
  const [modelSearchQuery, setModelSearchQuery] = useState<string>('');
  const [showModelDropdown, setShowModelDropdown] = useState<boolean>(false);
  const [customHeaders, setCustomHeaders] = useState<CustomHeader[]>(config.customHeaders || []);
  const [azureApiVersionEnabled, setAzureApiVersionEnabled] = useState<boolean>(
    Boolean(config.setAzureApiVersion)
  );
  const [azureApiVersion, setAzureApiVersion] = useState<string>(
    config.azureApiVersion || '2024-10-21'
  );
  const [useAzureIdentity, setUseAzureIdentity] = useState<boolean>(
    Boolean(config.useAzureIdentityAuth)
  );
  const [modelConfigExpanded, setModelConfigExpanded] = useState<boolean>(false);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(
    config.reasoningEffort || 'medium'
  );
  const [temperature, setTemperature] = useState<number>(config.temperature ?? 0.35);
  const [maxTokens, setMaxTokens] = useState<number>(config.maxTokens ?? 2048);
  const [streamingEnabled, setStreamingEnabled] = useState<boolean>(
    config.streamingEnabled ?? true
  );
  const [spiderSpeed, setSpiderSpeed] = useState<number>(
    Math.max(0.4, Math.min(3.0, config.spiderSpeed ?? 1.0))
  );

  const [isDiscoveringModels, setIsDiscoveringModels] = useState<boolean>(false);
  const [discoveryNotice, setDiscoveryNotice] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  const providerDef = useMemo(() => getProviderDefinition(activeProvider), [activeProvider]);

  // Keep synced when external config changes (e.g., from chrome.storage.local sync)
  useEffect(() => {
    setSpiderSpeed(Math.max(0.4, Math.min(3.0, config.spiderSpeed ?? 1.0)));
    if (config.provider && config.provider !== activeProvider) {
      setActiveProvider(config.provider);
      setBaseUrl(config.baseUrl || getProviderDefinition(config.provider).defaultBaseUrl);
      setApiKey(config.apiKey || '');
      setSelectedModel(config.selectedModel || getProviderDefinition(config.provider).defaultModel);
      if (Array.isArray(config.availableModels) && config.availableModels.length > 0) {
        setAvailableModels(config.availableModels);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.spiderSpeed, config.provider, config.selectedModel]);

  // Switch provider and load its isolated persisted profile
  const handleProviderChange = (nextProvider: AiProviderId) => {
    // Save current draft into profiles state before switching
    const currentProfile: ProviderProfileConfig = {
      provider: activeProvider,
      baseUrl,
      apiKey,
      selectedModel,
      availableModels,
      customHeaders,
      setAzureApiVersion: azureApiVersionEnabled,
      azureApiVersion,
      useAzureIdentityAuth: useAzureIdentity,
      reasoningEffort,
      temperature,
      maxTokens,
      streamingEnabled
    };
    saveProviderProfileToStorage(currentProfile, spiderSpeed);
    const updatedProfiles = loadAllProviderProfiles();
    setProfiles(updatedProfiles);

    const targetProfile = updatedProfiles[nextProvider];
    const targetDef = getProviderDefinition(nextProvider);

    setActiveProvider(nextProvider);
    setBaseUrl(targetProfile?.baseUrl ?? targetDef.defaultBaseUrl);
    setApiKey(targetProfile?.apiKey ?? '');
    setSelectedModel(targetProfile?.selectedModel || targetDef.defaultModel);
    setAvailableModels(
      targetProfile?.availableModels?.length
        ? targetProfile.availableModels
        : getDefaultModelsForProvider(nextProvider)
    );
    setCustomHeaders(targetProfile?.customHeaders || []);
    setAzureApiVersionEnabled(Boolean(targetProfile?.setAzureApiVersion));
    setAzureApiVersion(targetProfile?.azureApiVersion || '2024-10-21');
    setUseAzureIdentity(Boolean(targetProfile?.useAzureIdentityAuth));
    setReasoningEffort(targetProfile?.reasoningEffort || 'medium');
    setTemperature(targetProfile?.temperature ?? 0.35);
    setMaxTokens(targetProfile?.maxTokens ?? 2048);
    setStreamingEnabled(targetProfile?.streamingEnabled ?? true);
    setTestResult(null);
    setDiscoveryNotice(null);
  };

  // Automatically discover models when user authenticates or clicks Discover Models
  const handleDiscoverModels = async (silent = false) => {
    if (activeProvider === 'local') return;
    setIsDiscoveringModels(true);
    if (!silent) setDiscoveryNotice('Discovering available models from provider...');
    try {
      const models = await fetchAvailableModels(baseUrl, apiKey, activeProvider, {
        customHeaders,
        setAzureApiVersion: azureApiVersionEnabled,
        azureApiVersion
      });
      if (models.length > 0) {
        setAvailableModels(models);
        if (!models.includes(selectedModel)) {
          setSelectedModel(models[0]);
        }
        setDiscoveryNotice(`Discovered ${models.length} available models.`);
      }
    } catch (err: any) {
      if (!silent) {
        setDiscoveryNotice(
          `Using curated ${providerDef.label} model catalog (${err?.message || 'offline'}).`
        );
      }
    } finally {
      setIsDiscoveringModels(false);
    }
  };

  // Auto-discover models after API key is entered (debounced)
  useEffect(() => {
    if (!apiKey || apiKey.trim().length < 8 || activeProvider === 'local') return;
    const timer = setTimeout(() => {
      handleDiscoverModels(true);
    }, 650);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, activeProvider]);

  const enrichedModels = useMemo(() => {
    return searchModelsWithCapabilities(availableModels, activeProvider, modelSearchQuery);
  }, [availableModels, activeProvider, modelSearchQuery]);

  const selectedModelInfo = useMemo(() => {
    return getModelCapabilityInfo(selectedModel, activeProvider);
  }, [selectedModel, activeProvider]);

  const handleAddHeader = () => {
    setCustomHeaders((prev) => [
      ...prev,
      {
        id: `hdr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        key: '',
        value: ''
      }
    ]);
  };

  const handleUpdateHeader = (id: string, field: 'key' | 'value', val: string) => {
    setCustomHeaders((prev) =>
      prev.map((h) => (h.id === id ? { ...h, [field]: val } : h))
    );
  };

  const handleRemoveHeader = (id: string) => {
    setCustomHeaders((prev) => prev.filter((h) => h.id !== id));
  };

  const buildCurrentApiConfig = (overrideSpeed?: number): ApiConfig => ({
    provider: activeProvider,
    baseUrl: baseUrl.trim(),
    apiKey: apiKey.trim(),
    selectedModel: selectedModel.trim() || providerDef.defaultModel,
    availableModels,
    temperature,
    maxTokens,
    spiderSpeed: overrideSpeed ?? spiderSpeed,
    reasoningEffort,
    customHeaders: customHeaders.filter((h) => h.key.trim().length > 0),
    setAzureApiVersion: azureApiVersionEnabled,
    azureApiVersion,
    useAzureIdentityAuth: useAzureIdentity,
    streamingEnabled
  });

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);
    const currentCfg = buildCurrentApiConfig();
    const res = await testProviderConnection(currentCfg);
    setTestResult(res);
    if (res.ok && res.discoveredModels && res.discoveredModels.length > 0) {
      setAvailableModels(res.discoveredModels);
    }
    setIsTestingConnection(false);
  };

  const handleSaveConfiguration = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const nextConfig = buildCurrentApiConfig();
    const profileToSave: ProviderProfileConfig = {
      provider: activeProvider,
      baseUrl: nextConfig.baseUrl,
      apiKey: nextConfig.apiKey,
      selectedModel: nextConfig.selectedModel,
      availableModels: nextConfig.availableModels,
      customHeaders: nextConfig.customHeaders || [],
      setAzureApiVersion: Boolean(nextConfig.setAzureApiVersion),
      azureApiVersion: nextConfig.azureApiVersion || '2024-10-21',
      useAzureIdentityAuth: Boolean(nextConfig.useAzureIdentityAuth),
      reasoningEffort: nextConfig.reasoningEffort || 'low',
      temperature: nextConfig.temperature,
      maxTokens: nextConfig.maxTokens,
      streamingEnabled: nextConfig.streamingEnabled ?? true
    };
    saveProviderProfileToStorage(profileToSave, spiderSpeed);
    setProfiles(loadAllProviderProfiles());
    onSaveConfig(nextConfig);
    setSaveBanner(`Saved ${providerDef.label} configuration (${nextConfig.selectedModel}).`);
    setTimeout(() => setSaveBanner(null), 3200);
    if (onClose && !isEmbeddedPage) {
      onClose();
    }
  };

  return (
    <div className="text-slate-100">
      <form
        onSubmit={handleSaveConfiguration}
        className={`grid grid-cols-1 ${
          isEmbeddedPage ? 'lg:grid-cols-12 gap-6' : 'gap-5'
        }`}
      >
        {/* Left / Primary Column: Cline-Style API Configuration */}
        <div
          className={`${
            isEmbeddedPage ? 'lg:col-span-7' : ''
          } bg-[#18181b] border border-[#2c2c32] rounded-xl p-5 space-y-4 shadow-xl`}
        >
          {/* Cline-Style Section Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#2c2c32]">
            <div className="flex items-center gap-2.5">
              <Sliders className="w-4 h-4 text-slate-300" />
              <h2 className="text-sm font-semibold text-slate-100 tracking-tight">
                API Configuration
              </h2>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#242429] text-slate-300 border border-[#34343c]">
              Isolated Per-Provider Storage
            </span>
          </div>

          {/* API Provider Dropdown */}
          <div className="space-y-1.5">
            <label
              htmlFor="cline-api-provider"
              className="block text-xs font-medium text-slate-200"
            >
              API Provider
            </label>
            <select
              id="cline-api-provider"
              value={activeProvider}
              onChange={(e) => handleProviderChange(e.target.value as AiProviderId)}
              className="w-full px-3 py-2 rounded-md bg-[#25252b] border border-[#3c3c44] focus:border-[#007fd4] focus:outline-none text-xs text-slate-100 font-medium cursor-pointer"
            >
              {AI_PROVIDER_DEFINITIONS.map((prov) => (
                <option key={prov.id} value={prov.id}>
                  {prov.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {providerDef.helperNote}
            </p>
          </div>

          {/* Dynamic Base URL Field */}
          {providerDef.requiresBaseUrl && (
            <div className="space-y-1.5">
              <label
                htmlFor="cline-base-url"
                className="block text-xs font-medium text-slate-200"
              >
                Base URL
              </label>
              <input
                id="cline-base-url"
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={providerDef.defaultBaseUrl}
                className="w-full px-3 py-2 rounded-md bg-[#25252b] border border-[#3c3c44] focus:border-[#007fd4] focus:outline-none text-xs text-slate-100 font-mono"
              />
            </div>
          )}

          {/* Dynamic Masked API Key Input with Show/Hide Toggle */}
          {activeProvider !== 'local' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="cline-api-key"
                  className="block text-xs font-medium text-slate-200"
                >
                  {providerDef.keyLabel}
                </label>
                <span className="text-[10.5px] font-mono text-slate-400">
                  {apiKey.trim()
                    ? 'Key configured in local profile'
                    : providerDef.requiresApiKey
                    ? 'Required for live calls'
                    : 'Optional for local daemon'}
                </span>
              </div>
              <div className="relative flex items-center">
                <input
                  id="cline-api-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={providerDef.keyPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full pl-3 pr-10 py-2 rounded-md bg-[#25252b] border border-[#007fd4]/80 focus:border-[#007fd4] focus:outline-none text-xs text-slate-100 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((s) => !s)}
                  aria-label={showApiKey ? 'Hide API Key' : 'Show API Key'}
                  title={showApiKey ? 'Hide API Key' : 'Show API Key'}
                  className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-100 rounded transition-colors cursor-pointer"
                >
                  {showApiKey ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                This key is stored locally and only used to make API requests from this extension.
              </p>
            </div>
          )}

          {/* Searchable Model ID Selector with Auto-Discovery, Capabilities & Pricing */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="cline-model-id"
                className="block text-xs font-medium text-slate-200"
              >
                Model ID
              </label>
              {activeProvider !== 'local' && (
                <button
                  type="button"
                  onClick={() => handleDiscoverModels(false)}
                  disabled={isDiscoveringModels}
                  className="inline-flex items-center gap-1.5 text-[11px] text-sky-400 hover:text-sky-300 font-medium cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${isDiscoveringModels ? 'animate-spin' : ''}`}
                  />
                  <span>
                    {isDiscoveringModels ? 'Discovering...' : 'Discover Models'}
                  </span>
                </button>
              )}
            </div>

            {/* Direct Model ID Input + Searchable Catalog Picker */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  id="cline-model-id"
                  type="text"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  onFocus={() => setShowModelDropdown(true)}
                  placeholder={providerDef.defaultModel}
                  className="flex-1 px-3 py-2 rounded-md bg-[#25252b] border border-[#3c3c44] focus:border-[#007fd4] focus:outline-none text-xs text-slate-100 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowModelDropdown((v) => !v)}
                  className="px-3 py-2 rounded-md bg-[#25252b] hover:bg-[#2f2f37] border border-[#3c3c44] text-xs text-slate-200 font-medium cursor-pointer"
                >
                  {showModelDropdown ? 'Hide List' : `Models (${availableModels.length})`}
                </button>
              </div>

              {discoveryNotice && (
                <div className="text-[11px] font-mono text-sky-400">{discoveryNotice}</div>
              )}

              {/* Searchable Model Browser with Capabilities & Pricing */}
              {showModelDropdown && (
                <div className="rounded-lg bg-[#121216] border border-[#34343c] p-2.5 space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={modelSearchQuery}
                      onChange={(e) => setModelSearchQuery(e.target.value)}
                      placeholder="Filter models by ID, capability (reasoning, vision), or provider..."
                      aria-label="Search available models"
                      className="w-full pl-8 pr-3 py-1.5 rounded bg-[#1d1d22] border border-[#34343c] focus:border-[#007fd4] focus:outline-none text-xs text-slate-100"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {enrichedModels.map((item) => {
                      const isSelected = item.id === selectedModel;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedModel(item.id);
                            setShowModelDropdown(false);
                          }}
                          className={`w-full text-left p-2 rounded-md border transition-colors flex flex-col gap-1 cursor-pointer ${
                            isSelected
                              ? 'bg-[#007fd4]/20 border-[#007fd4] text-white'
                              : 'bg-[#1a1a20] hover:bg-[#24242c] border-transparent text-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-semibold truncate">
                              {item.id}
                            </span>
                            <span className="text-[10px] font-mono text-emerald-300 shrink-0">
                              {formatPricePerMillion(
                                item.inputPricePerMillion,
                                item.outputPricePerMillion
                              )}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-slate-400">
                            <span className="px-1.5 py-0.2 rounded bg-[#26262f] text-slate-300">
                              Ctx {formatContextWindow(item.contextWindow)}
                            </span>
                            {item.supportsStreaming && (
                              <span className="px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-300">
                                Streaming
                              </span>
                            )}
                            {item.supportsReasoning && (
                              <span className="px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-300">
                                Reasoning
                              </span>
                            )}
                            {item.supportsVision && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300">
                                Vision
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Custom Headers with "Add Header" Button (matching Cline screenshot) */}
          {providerDef.supportsCustomHeaders && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-200">Custom Headers</span>
                <button
                  type="button"
                  onClick={handleAddHeader}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded bg-[#1d74a8] hover:bg-[#2389c6] text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Header</span>
                </button>
              </div>

              {customHeaders.length > 0 && (
                <div className="space-y-2">
                  {customHeaders.map((hdr) => (
                    <div key={hdr.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={hdr.key}
                        onChange={(e) => handleUpdateHeader(hdr.id, 'key', e.target.value)}
                        placeholder="Header-Name (e.g. X-Title)"
                        className="flex-1 px-2.5 py-1.5 rounded bg-[#25252b] border border-[#3c3c44] text-xs text-slate-100 font-mono"
                      />
                      <input
                        type="text"
                        value={hdr.value}
                        onChange={(e) => handleUpdateHeader(hdr.id, 'value', e.target.value)}
                        placeholder="Header Value"
                        className="flex-1 px-2.5 py-1.5 rounded bg-[#25252b] border border-[#3c3c44] text-xs text-slate-100 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveHeader(hdr.id)}
                        className="p-1.5 rounded bg-[#25252b] hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-[#3c3c44] cursor-pointer"
                        aria-label="Remove Custom Header"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Azure Compatibility Options (when OpenAI Compatible is selected, matching screenshot) */}
          {providerDef.supportsAzureOptions && (
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={azureApiVersionEnabled}
                  onChange={(e) => setAzureApiVersionEnabled(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#25252b] border-[#3c3c44] accent-[#007fd4]"
                />
                <span>Set Azure API version</span>
              </label>

              {azureApiVersionEnabled && (
                <input
                  type="text"
                  value={azureApiVersion}
                  onChange={(e) => setAzureApiVersion(e.target.value)}
                  placeholder="2024-10-21"
                  className="w-full px-3 py-1.5 rounded bg-[#25252b] border border-[#3c3c44] text-xs text-slate-100 font-mono"
                />
              )}

              <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useAzureIdentity}
                  onChange={(e) => setUseAzureIdentity(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#25252b] border-[#3c3c44] accent-[#007fd4]"
                />
                <span>Use Azure Identity Authentication</span>
              </label>
            </div>
          )}

          {/* Collapsible > MODEL CONFIGURATION Section */}
          <div className="pt-1 border-t border-[#2c2c32]">
            <button
              type="button"
              onClick={() => setModelConfigExpanded((v) => !v)}
              className="w-full flex items-center gap-1.5 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              {modelConfigExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              <span>MODEL CONFIGURATION</span>
            </button>

            {modelConfigExpanded && (
              <div className="mt-2.5 p-3 rounded-lg bg-[#121216] border border-[#2c2c32] space-y-3 text-xs">
                {/* Active Model Capability & Pricing Summary */}
                <div className="p-2.5 rounded bg-[#1b1b22] border border-[#2e2e38] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-sky-300">
                      {selectedModelInfo.name}
                    </span>
                    <span className="font-mono text-[11px] text-emerald-300">
                      {formatPricePerMillion(
                        selectedModelInfo.inputPricePerMillion,
                        selectedModelInfo.outputPricePerMillion
                      )}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {selectedModelInfo.description}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-0.5 text-[10.5px] font-mono text-slate-300">
                    <span>
                      Context: <strong>{formatContextWindow(selectedModelInfo.contextWindow)}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Max Output: <strong>{selectedModelInfo.maxOutputTokens.toLocaleString()}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Streaming: <strong>{selectedModelInfo.supportsStreaming ? 'Yes' : 'No'}</strong>
                    </span>
                  </div>
                </div>

                {/* Streaming Responses Toggle */}
                <label className="flex items-center justify-between text-xs text-slate-200 cursor-pointer">
                  <span>Enable Real-Time Token Streaming (SSE)</span>
                  <input
                    type="checkbox"
                    checked={streamingEnabled}
                    onChange={(e) => setStreamingEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#007fd4]"
                  />
                </label>

                {/* Sampling Temperature */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Sampling Temperature</span>
                    <span className="font-mono text-sky-300">{temperature.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-[#007fd4] cursor-pointer"
                  />
                </div>

                {/* Max Output Tokens */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Max Output Tokens</span>
                    <span className="font-mono text-sky-300">{maxTokens}</span>
                  </div>
                  <input
                    type="range"
                    min="256"
                    max="4096"
                    step="128"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
                    className="w-full accent-[#007fd4] cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Complex Prompts Note (matching Cline screenshot) */}
          <p className="text-xs leading-relaxed text-[#f28b82]">
            (Note: SPIDAR uses complex prompts, so behavior can vary across models. Less
            capable models may not work as expected.)
          </p>

          {/* Reasoning Effort Dropdown */}
          <div className="space-y-1.5">
            <label
              htmlFor="cline-reasoning-effort"
              className="block text-xs font-medium text-slate-200"
            >
              Reasoning Effort
            </label>
            <select
              id="cline-reasoning-effort"
              value={reasoningEffort}
              onChange={(e) => setReasoningEffort(e.target.value as ReasoningEffort)}
              className="w-full px-3 py-2 rounded-md bg-[#25252b] border border-[#3c3c44] focus:border-[#007fd4] focus:outline-none text-xs text-slate-100 cursor-pointer"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <p className="text-[11px] text-slate-400">
              Higher effort improves depth, but uses more tokens
            </p>
          </div>

          {/* Connection Test Status Banner */}
          {testResult && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                testResult.ok
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-500/10 border-rose-500/40 text-rose-200'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <div className="font-semibold">
                  {testResult.ok
                    ? `Connection Verified (${testResult.latencyMs}ms)`
                    : `Connection Issue (${testResult.status.replace('_', ' ').toUpperCase()})`}
                </div>
                <div className="text-[11px] opacity-90">{testResult.message}</div>
              </div>
            </div>
          )}

          {saveBanner && (
            <div className="p-2.5 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
              <span>{saveBanner}</span>
            </div>
          )}

          {/* Action Controls: Test Connection & Save Configuration */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#2c2c32]">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTestingConnection}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#25252b] hover:bg-[#303038] border border-[#3c3c44] text-xs font-medium text-slate-100 transition-colors cursor-pointer"
            >
              <Activity
                className={`w-3.5 h-3.5 text-sky-400 ${
                  isTestingConnection ? 'animate-pulse' : ''
                }`}
              />
              <span>
                {isTestingConnection ? 'Testing Connection...' : 'Test Connection'}
              </span>
            </button>

            <div className="flex items-center gap-2">
              {onClose && !isEmbeddedPage && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-md bg-[#25252b] hover:bg-[#303038] text-xs text-slate-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-[#1d74a8] hover:bg-[#2389c6] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>

        {/* Right / Secondary Column: Crawler Speed, Saved Provider Profiles & Security */}
        <div
          className={`${
            isEmbeddedPage ? 'lg:col-span-5' : ''
          } space-y-4`}
        >
          {/* Spider Crawl & Scroll Speed Card */}
          <div className="bg-[#18181b] border border-[#2c2c32] rounded-xl p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <label
                htmlFor="options-spider-speed"
                className="text-xs font-semibold text-white flex items-center gap-2"
              >
                <Zap className="w-3.5 h-3.5 text-sky-400" />
                <span>Spider Crawl &amp; Scroll Speed (1:1 Center-Locked)</span>
              </label>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                {spiderSpeed.toFixed(1)}x • {Math.round(190 * spiderSpeed)} px/s
              </span>
            </div>

            <input
              id="options-spider-speed"
              type="range"
              min="0.4"
              max="3.0"
              step="0.1"
              value={spiderSpeed}
              onChange={(e) => {
                const nextSpeed = parseFloat(e.target.value);
                setSpiderSpeed(nextSpeed);
                onSaveConfig(buildCurrentApiConfig(nextSpeed));
              }}
              aria-label="Spider Crawl and Scroll Speed"
              className="w-full accent-sky-400 cursor-pointer"
            />

            <div className="flex items-center justify-between gap-1.5">
              {[
                { label: '0.5x Slow', val: 0.5 },
                { label: '1.0x Normal', val: 1.0 },
                { label: '1.5x Fast', val: 1.5 },
                { label: '2.0x Rapid', val: 2.0 },
                { label: '3.0x Turbo', val: 3.0 }
              ].map((preset) => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => {
                    setSpiderSpeed(preset.val);
                    onSaveConfig(buildCurrentApiConfig(preset.val));
                  }}
                  className={`flex-1 py-1 px-2 rounded-md font-mono text-[10.5px] border transition-colors cursor-pointer ${
                    Math.abs(spiderSpeed - preset.val) < 0.06
                      ? 'bg-sky-500 text-slate-950 font-bold border-sky-400'
                      : 'bg-[#25252b] hover:bg-[#303038] text-slate-300 border-[#3c3c44]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Provider Switcher & Saved Profile Matrix */}
          <div className="bg-[#18181b] border border-[#2c2c32] rounded-xl p-5 space-y-3 shadow-xl">
            <div className="text-xs font-semibold text-white">
              Saved Provider Profiles
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Each provider stores its own isolated Base URL, API credentials, custom headers, and preferred model. Click any provider to switch immediately:
            </p>
            <div className="space-y-1.5">
              {AI_PROVIDER_DEFINITIONS.map((prov) => {
                const prof = profiles[prov.id];
                const isCurrent = prov.id === activeProvider;
                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => handleProviderChange(prov.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-[#007fd4]/15 border-[#007fd4] text-white'
                        : 'bg-[#202026] hover:bg-[#27272f] border-[#2e2e36] text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold">{prov.label}</div>
                      <div className="text-[10.5px] font-mono text-slate-400">
                        Model: {prof?.selectedModel || prov.defaultModel}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        isCurrent
                          ? 'bg-[#007fd4] text-white font-semibold'
                          : prof?.apiKey
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-[#2a2a32] text-slate-400'
                      }`}
                    >
                      {isCurrent ? 'Active' : prof?.apiKey ? 'Key Saved' : 'Ready'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Manifest V3 Credential Isolation Guarantee */}
          <div className="p-4 rounded-xl bg-[#18181b] border border-[#2c2c32] flex items-start gap-3 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-white">
                Manifest V3 Credential Isolation
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                API keys are persisted solely inside the extension&apos;s isolated options storage and background service worker. Webpage content scripts never receive or log API credentials.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

interface ApiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ApiConfig;
  onSaveConfig: (newConfig: ApiConfig) => void;
}

export const ApiConfigModal: React.FC<ApiConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-config-title"
    >
      <div className="w-full max-w-2xl bg-[#111115] border border-[#2c2c32] rounded-2xl shadow-2xl overflow-hidden text-slate-100 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-[#16161a] border-b border-[#2c2c32]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#242429] border border-[#34343c] text-sky-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 id="api-config-title" className="text-sm font-bold text-white">
                SPIDAR Extension Options — API Configuration
              </h2>
              <p className="text-[11px] text-slate-400">
                Multi-provider AI settings, model discovery, reasoning effort, and crawler speed.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close API Configuration"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <ExtensionOptionsPanel
            config={config}
            onSaveConfig={onSaveConfig}
            onClose={onClose}
            isEmbeddedPage={false}
          />
        </div>
      </div>
    </div>
  );
};
