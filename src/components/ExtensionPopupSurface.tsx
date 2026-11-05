import React from 'react';
import {
  ArrowDownCircle,
  Brain,
  Download,
  Globe,
  Network,
  PenTool,
  Settings,
  ExternalLink
} from 'lucide-react';
import { ApiConfig } from '../types';
import { getProviderDefinition } from '../utils/aiProviders';
import { isChromeExtensionContext } from '../utils/chromeBridge';

export interface ExtensionPopupSurfaceProps {
  apiConfig: ApiConfig;
  neuronCount: number;
  factCount?: number;
  isStandalonePopup?: boolean;
  zipDownloading?: boolean;
  onTriggerTabCrawl: () => void;
  onSpiderSpeedChange: (speed: number) => void;
  onNavigateSurface: (
    target: 'analyzer' | 'outline-studio' | 'neural-graph' | 'extension-options'
  ) => void;
  onDownloadZip?: () => void;
  onOpenSourceInspector?: () => void;
}

export const ExtensionPopupSurface: React.FC<ExtensionPopupSurfaceProps> = ({
  apiConfig,
  neuronCount,
  isStandalonePopup = false,
  zipDownloading = false,
  onTriggerTabCrawl,
  onSpiderSpeedChange,
  onNavigateSurface,
  onDownloadZip,
  onOpenSourceInspector
}) => {
  const spiderSpeed = Math.max(0.4, Math.min(3.0, apiConfig.spiderSpeed ?? 1.0));
  const activeProviderDef = getProviderDefinition(apiConfig.provider || 'qwen-free');
  const inExtension = isChromeExtensionContext();

  return (
    <div
      className={`rounded-2xl bg-[#090d15] border border-slate-800/90 p-4 space-y-3.5 text-slate-200 shadow-xl ${
        isStandalonePopup ? 'w-full min-h-[480px] rounded-none border-0' : ''
      }`}
    >
      {/* Popup Top Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          <div>
            <h3 className="text-xs font-semibold text-white tracking-tight flex items-center gap-1.5">
              <span>SPIDAR</span>
              <span className="text-[10px] font-mono text-sky-400 font-normal">v2.7</span>
            </h3>
            <div className="text-[10px] text-slate-400 font-mono">
              {inExtension ? 'Chrome Extension MV3 Active' : 'Quick-Access Companion'}
            </div>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-mono">
          {neuronCount} Neurons
        </span>
      </div>

      {/* Primary Action: Crawl & Analyse Tab */}
      <button
        type="button"
        onClick={onTriggerTabCrawl}
        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-slate-100 hover:bg-white text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <ArrowDownCircle className="w-4 h-4 text-slate-800" />
          <span>Crawl &amp; Analyse Tab</span>
        </span>
        <span className="text-[10px] font-mono text-slate-600">Center Walk</span>
      </button>

      {/* Unified Quick-Launch Studio Views */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => onNavigateSurface('analyzer')}
          className="flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg bg-[#070a11] hover:bg-slate-900 border border-slate-800/90 text-[10.5px] font-medium text-slate-200 transition-colors cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5 text-sky-400" />
          <span>Web Analyzer</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigateSurface('outline-studio')}
          className="flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg bg-[#070a11] hover:bg-slate-900 border border-slate-800/90 text-[10.5px] font-medium text-slate-200 transition-colors cursor-pointer"
        >
          <PenTool className="w-3.5 h-3.5 text-emerald-400" />
          <span>Outline Studio</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigateSurface('neural-graph')}
          className="flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg bg-[#070a11] hover:bg-slate-900 border border-slate-800/90 text-[10.5px] font-medium text-slate-200 transition-colors cursor-pointer"
        >
          <Network className="w-3.5 h-3.5 text-purple-400" />
          <span>Neural Graph</span>
        </button>
      </div>

      {/* Active Provider, Model & Spider Speed Quick Controls */}
      <div className="p-2.5 rounded-lg bg-[#070a11] border border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Active Provider</span>
          <span className="font-mono text-[10.5px] text-slate-200">
            {activeProviderDef.shortLabel}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Model</span>
          <span className="font-mono text-[10.5px] text-emerald-400 truncate max-w-[180px]">
            {apiConfig.selectedModel || 'qwen2.5-72b-instruct-free'}
          </span>
        </div>

        {/* Spider & Scroll Speed Quick-Access Control */}
        <div className="space-y-1.5 pt-1.5 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-[11px]">
            <label htmlFor="popup-spider-speed" className="text-slate-300 font-medium">
              Spider &amp; Scroll Speed
            </label>
            <span className="font-mono text-[10.5px] text-sky-300">
              {spiderSpeed.toFixed(1)}x ({Math.round(190 * spiderSpeed)} px/s)
            </span>
          </div>
          <input
            id="popup-spider-speed"
            type="range"
            min="0.4"
            max="3.0"
            step="0.1"
            value={spiderSpeed}
            onChange={(e) => onSpiderSpeedChange(parseFloat(e.target.value))}
            aria-label="Spider Crawl and Scroll Speed"
            className="w-full accent-sky-400 cursor-pointer"
          />
          <div className="flex items-center justify-between gap-1">
            {[0.5, 1.0, 1.5, 2.0, 3.0].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onSpiderSpeedChange(spd)}
                className={`flex-1 py-0.5 rounded font-mono text-[10px] border transition-colors cursor-pointer ${
                  Math.abs(spiderSpeed - spd) < 0.06
                    ? 'bg-sky-500 text-slate-950 font-bold border-sky-400'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Open Dedicated Extension Options Page */}
        <button
          type="button"
          onClick={() => onNavigateSurface('extension-options')}
          className="w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5 text-emerald-400" />
          <span>Open Extension Options (API Config)</span>
          {isStandalonePopup && <ExternalLink className="w-3 h-3 text-slate-400 ml-0.5" />}
        </button>
      </div>

      {/* Footer Actions */}
      {!isStandalonePopup && (onDownloadZip || onOpenSourceInspector) ? (
        <div className="flex items-center justify-between gap-2 pt-1">
          {onDownloadZip && (
            <button
              type="button"
              disabled={zipDownloading}
              onClick={onDownloadZip}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>{zipDownloading ? 'Bundling...' : 'Download .ZIP'}</span>
            </button>
          )}
          {onOpenSourceInspector && (
            <button
              type="button"
              onClick={onOpenSourceInspector}
              className="py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Source
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <span className="flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span>{neuronCount} Indexed Neurons</span>
          </span>
          <span className="font-mono text-[10px] text-slate-500">1:1 Center Lock</span>
        </div>
      )}
    </div>
  );
};
