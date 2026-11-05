import React, { useState, useEffect } from 'react';
import {
  Package,
  Download,
  Copy,
  Check,
  FileCode,
  CheckCircle2,
  Layout,
  Sliders,
  Link2,
  X
} from 'lucide-react';
import {
  getAllExtensionFiles,
  generateAndDownloadExtensionZip,
  ExtensionFileDefinition
} from '../utils/extensionGenerator';
import { ApiConfig } from '../types';
import { ExtensionPopupSurface } from './ExtensionPopupSurface';
import { resolveApiEndpoint } from '../utils/apiProxy';
import { SPIDAR_CLOUD_BACKEND_URL, isChromeExtensionContext } from '../utils/chromeBridge';

interface ExtensionStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiConfig?: ApiConfig;
  onUpdateApiConfig?: (cfg: ApiConfig) => void;
  onTriggerTabCrawl?: () => void;
  onOpenExtensionOptions?: () => void;
  onNavigateSurface?: (
    target: 'analyzer' | 'outline-studio' | 'neural-graph' | 'extension-options'
  ) => void;
  factCount?: number;
}

export const ExtensionStudioModal: React.FC<ExtensionStudioModalProps> = ({
  isOpen,
  onClose,
  apiConfig,
  onUpdateApiConfig,
  onTriggerTabCrawl,
  onOpenExtensionOptions,
  onNavigateSurface,
  factCount = 5
}) => {
  const defaultFiles: ExtensionFileDefinition[] = getAllExtensionFiles();
  const [files, setFiles] = useState<ExtensionFileDefinition[]>(defaultFiles);
  const [activeView, setActiveView] = useState<'popup-preview' | 'source-files'>('popup-preview');
  const [selectedFile, setSelectedFile] = useState<ExtensionFileDefinition>(defaultFiles[0]);
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetch(resolveApiEndpoint('/api/source-files'))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.files) && data.files.length > 0) {
          const mapped: ExtensionFileDefinition[] = data.files.map((f: any) => ({
            filename: f.path,
            description: f.description || f.path,
            language: f.language || 'typescript',
            content: f.content || ''
          }));
          setFiles(mapped);
          setSelectedFile(mapped[0]);
        }
      })
      .catch(() => {
        // Keep default extension files if offline
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const directDownloadUrl = isChromeExtensionContext()
    ? `${SPIDAR_CLOUD_BACKEND_URL}/download.zip`
    : typeof window !== 'undefined'
    ? `${window.location.origin}/download.zip`
    : '/download.zip';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleCopyLinkUrl = () => {
    navigator.clipboard.writeText(directDownloadUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleDownloadZip = async () => {
    setIsDownloading(true);
    try {
      await generateAndDownloadExtensionZip();
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ext-studio-title"
    >
      <div className="w-full max-w-4xl bg-[#0c1017] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-slate-100">
        {/* Clean Minimalist Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 bg-[#090c12] border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h2 id="ext-studio-title" className="text-sm font-semibold text-white flex items-center gap-2">
                <span>SPIDAR Complete Source Code &amp; Chrome Extension (.ZIP)</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 font-mono">
                  Full Project • v2.7
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Includes the unpacked Chrome Extension MV3 at the root (`manifest.json`, `background.js`, `content.js`) + full-stack source code (`server.ts`, `src/**`).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setActiveView('popup-preview')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  activeView === 'popup-preview'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layout className="w-3.5 h-3.5" />
                <span>Popup &amp; ZIP Link</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('source-files')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  activeView === 'source-files'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>All Source Files ({files.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadZip}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-semibold transition-all cursor-pointer"
            >
              {downloadSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />
                  <span>ZIP Downloaded</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>{isDownloading ? 'Bundling...' : 'Download Full .ZIP'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close Extension Studio"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Direct Download URL Bar */}
        <div className="px-6 py-2.5 bg-sky-950/30 border-b border-sky-500/20 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-sky-200 min-w-0 flex-1">
            <Link2 className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="font-semibold shrink-0">Direct Full Source .ZIP URL:</span>
            <a
              href="/download.zip"
              download="spidar-v2.7-complete-source.zip"
              className="font-mono text-[11px] text-sky-300 underline hover:text-white truncate"
            >
              {directDownloadUrl}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLinkUrl}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-200 cursor-pointer"
            >
              {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-sky-400" />}
              <span>{copiedUrl ? 'Copied Link!' : 'Copy Direct Link'}</span>
            </button>
          </div>
        </div>

        {/* Body */}
        {activeView === 'popup-preview' ? (
          <div className="flex-1 overflow-y-auto p-6 bg-[#090c12] flex flex-col md:flex-row items-center md:items-start justify-center gap-8">
            {/* Left: Shared Single-Source-of-Truth Extension Popup Surface */}
            {apiConfig && onUpdateApiConfig && (
              <ExtensionPopupSurface
                apiConfig={apiConfig}
                neuronCount={factCount}
                factCount={factCount}
                zipDownloading={isDownloading}
                onSpiderSpeedChange={(speed) =>
                  onUpdateApiConfig({
                    ...apiConfig,
                    spiderSpeed: speed
                  })
                }
                onTriggerTabCrawl={() => {
                  onClose();
                  if (onTriggerTabCrawl) onTriggerTabCrawl();
                }}
                onNavigateSurface={(target) => {
                  onClose();
                  if (target === 'extension-options' && onOpenExtensionOptions) {
                    onOpenExtensionOptions();
                  } else if (onNavigateSurface) {
                    onNavigateSurface(target);
                  }
                }}
                onDownloadZip={handleDownloadZip}
              />
            )}

            {/* Right: Architecture & Unpacked Install Guide */}
            <div className="flex-1 max-w-md space-y-4 text-xs text-slate-300">
              <div className="p-4 rounded-xl bg-[#0e131d] border border-slate-800 space-y-2">
                <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-sky-400" />
                  <span>What’s Inside `spidar-v2.7-complete-source.zip` ({files.length} Files)</span>
                </h3>
                <ul className="space-y-1.5 text-[11.5px] text-slate-400 leading-relaxed">
                  <li>
                    • <strong className="text-slate-200">Unified React Chrome Extension (Root Level):</strong> <code className="text-slate-300">manifest.json</code>, <code className="text-slate-300">background.js</code>, compiled React <code className="text-slate-300">content.js</code> + <code className="text-slate-300">styles.css</code> (Shadow DOM <code className="text-slate-300">&lt;SpidarCompanionOverlay /&gt;</code>, <code className="text-slate-300">&lt;SpiderSvg /&gt;</code>, <code className="text-slate-300">&lt;IntelligenceCard /&gt;</code>), <code className="text-slate-300">popup.html</code>, <code className="text-slate-300">options.html</code>, <code className="text-slate-300">index.html</code>, and <code className="text-slate-300">assets/*</code> are placed directly at the root of the ZIP.
                  </li>
                  <li>
                    • <strong className="text-slate-200">Full Web App &amp; AI Server (<code className="text-slate-300">server.ts</code>, <code className="text-slate-300">src/**</code>):</strong> Complete React + TypeScript + Express source code including <code className="text-slate-300">src/contentScript.tsx</code>, <code className="text-slate-300">src/components/SpidarCompanionOverlay.tsx</code>, Outline &amp; Writing Studio, Second Brain Neural Graph, and Multi-Provider AI Router.
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-[#0e131d] border border-slate-800 space-y-2">
                <h4 className="text-xs font-semibold text-white">How to Load in Chrome or Run Locally</h4>
                <ol className="space-y-1 text-[11.5px] text-slate-400 list-decimal list-inside">
                  <li>Click <strong>Download Full .ZIP</strong> above (or open <code className="text-sky-300">/download.zip</code>) and unzip the archive.</li>
                  <li>Open <code className="text-slate-200">chrome://extensions</code>, enable <strong>Developer mode</strong>, click <strong>Load unpacked</strong>, and select the unzipped folder directly (<code className="text-slate-200">manifest.json</code> is right at the root).</li>
                  <li>To also run the full-stack web studio locally: run <code className="text-slate-200">npm install &amp;&amp; npm run dev</code> inside the same folder.</li>
                </ol>
              </div>
            </div>
          </div>
        ) : (
          /* Source File Inspector */
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-[420px] overflow-hidden">
            <div className="md:col-span-4 bg-[#090c12] border-r border-slate-800 p-4 space-y-1.5 overflow-y-auto">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2 px-2">
                Complete Project Files ({files.length})
              </div>
              {files.map((file) => (
                <button
                  key={file.filename}
                  type="button"
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-start gap-2.5 cursor-pointer ${
                    selectedFile.filename === file.filename
                      ? 'bg-slate-800/90 border-slate-700 text-white'
                      : 'bg-slate-900/40 border-slate-800/60 text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  <FileCode className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div className="overflow-hidden">
                    <div className="text-xs font-semibold font-mono truncate">{file.filename}</div>
                    <div className="text-[10px] text-slate-500 line-clamp-1">{file.description}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="md:col-span-8 flex flex-col bg-[#070a0f] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#0c1017] border-b border-slate-800">
                <div>
                  <span className="text-xs font-semibold font-mono text-slate-200">
                    {selectedFile.filename}
                  </span>
                  <span className="text-[11px] text-slate-500 ml-2">— {selectedFile.description}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="flex-1 p-4 text-[11px] font-mono text-slate-300 overflow-auto leading-relaxed">
                {selectedFile.content}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
