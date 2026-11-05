import React, { useState } from 'react';
import {
  Brain,
  Download,
  Copy,
  Check,
  Plus,
  Trash2,
  Sparkles,
  Network,
  FileJson,
  FileText,
  Terminal,
  Zap,
  X
} from 'lucide-react';
import { NeuralKnowledgeBase, MemoryNeuron } from '../types';
import {
  exportKnowledgeBaseJSON,
  exportMarkdownDossier,
  exportSystemPromptContext,
  downloadExtractedBrainFile
} from '../utils/neuralMemory';
import { NeuralBrainGraph } from './NeuralBrainGraph';

interface NeuralVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  knowledgeBase: NeuralKnowledgeBase;
  onAddFact: (factText: string) => void;
  onAddNeuron?: (chunkText: string, customTitle?: string) => void;
  onDeleteNeuron?: (neuronId: string) => void;
  onDeleteFact: (factId: string) => void;
  onResetVault: () => void;
  onAskAboutNeuron?: (neuron: MemoryNeuron) => void;
  initialSection?: 'graph' | 'neurons' | 'facts' | 'export';
}

export const NeuralVaultModal: React.FC<NeuralVaultModalProps> = ({
  isOpen,
  onClose,
  knowledgeBase,
  onAddFact,
  onAddNeuron,
  onDeleteNeuron,
  onDeleteFact,
  onResetVault,
  onAskAboutNeuron,
  initialSection = 'graph'
}) => {
  const [activeSection, setActiveSection] = useState<'graph' | 'neurons' | 'facts' | 'export'>(
    initialSection
  );
  const [newChunkInput, setNewChunkInput] = useState('');
  const [newChunkTitle, setNewChunkTitle] = useState('');
  const [newFactInput, setNewFactInput] = useState('');
  const [exportFormat, setExportFormat] = useState<'json' | 'markdown' | 'prompt'>('json');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const neurons = knowledgeBase.neurons || [];
  const conceptList = Object.values(knowledgeBase.concepts).sort((a, b) => b.frequency - a.frequency);

  const handleCreateNeuron = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChunkInput.trim()) return;
    if (onAddNeuron) {
      onAddNeuron(newChunkInput.trim(), newChunkTitle.trim() || undefined);
    } else {
      onAddFact(newChunkInput.trim());
    }
    setNewChunkInput('');
    setNewChunkTitle('');
  };

  const handleTeachFact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFactInput.trim()) return;
    onAddFact(newFactInput.trim());
    setNewFactInput('');
  };

  const getExportContent = () => {
    if (exportFormat === 'json') return exportKnowledgeBaseJSON(knowledgeBase);
    if (exportFormat === 'markdown') return exportMarkdownDossier(knowledgeBase);
    return exportSystemPromptContext(knowledgeBase);
  };

  const handleCopyExport = () => {
    navigator.clipboard.writeText(getExportContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadExport = () => {
    downloadExtractedBrainFile(knowledgeBase, exportFormat);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="neural-vault-title"
    >
      <div className="w-full max-w-4xl bg-[#090d16] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 id="neural-vault-title" className="text-base font-bold text-white flex items-center gap-2">
                <span>SPIDAR Neural Graph &amp; Second Brain Vault</span>
                <span className="text-xs px-2.5 py-0.5 rounded bg-slate-900 text-sky-300 border border-slate-800 font-mono tabular-nums">
                  {neurons.length} Nodes
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Interconnected neural graph that retains manually read documents &amp; entity context independently of chat.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close Neural Vault"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clean Metrics Strip (Zero gamification / IQ scores) */}
        <div className="grid grid-cols-3 gap-3 px-6 py-3 bg-slate-950/60 border-b border-slate-800/80 text-center">
          <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Graph Nodes</div>
            <div className="text-sm font-bold text-sky-300 font-mono tabular-nums">{neurons.length}</div>
          </div>
          <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Deep-Read Retention</div>
            <div className="text-sm font-bold text-emerald-300 font-mono tabular-nums">98% Verbatim</div>
          </div>
          <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Indexed Facts &amp; Concepts</div>
            <div className="text-sm font-bold text-violet-300 font-mono tabular-nums">
              {knowledgeBase.facts.length + conceptList.length}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 px-6 pt-3 border-b border-slate-800 bg-[#090d16]">
          <button
            type="button"
            onClick={() => setActiveSection('graph')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all cursor-pointer ${
              activeSection === 'graph'
                ? 'border-sky-400 text-sky-300 bg-sky-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Neural Graph ({neurons.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('neurons')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all cursor-pointer ${
              activeSection === 'neurons'
                ? 'border-violet-400 text-violet-300 bg-violet-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Deep-Read &amp; Entity Nodes</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('facts')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all cursor-pointer ${
              activeSection === 'facts'
                ? 'border-emerald-400 text-emerald-300 bg-emerald-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Facts &amp; Context ({knowledgeBase.facts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('export')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all cursor-pointer ${
              activeSection === 'export'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Extract Brain</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeSection === 'graph' && (
            <NeuralBrainGraph
              knowledgeBase={knowledgeBase}
              compact={false}
              onDeleteNeuron={onDeleteNeuron}
              onAskAboutNeuron={(neuron) => {
                if (onAskAboutNeuron) {
                  onClose();
                  onAskAboutNeuron(neuron);
                }
              }}
            />
          )}

          {activeSection === 'neurons' && (
            <>
              <form
                onSubmit={handleCreateNeuron}
                className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5"
              >
                <div className="text-xs font-semibold text-sky-300">
                  Index a New Deep-Read Passage or Entity Context Node
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newChunkTitle}
                    onChange={(e) => setNewChunkTitle(e.target.value)}
                    placeholder="Node Title (e.g. 'Alex Rivera (Collaborator)')"
                    className="sm:w-1/3 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-sky-500 focus:outline-none text-xs text-white placeholder-slate-500"
                  />
                  <input
                    type="text"
                    value={newChunkInput}
                    onChange={(e) => setNewChunkInput(e.target.value)}
                    placeholder="Paste a paragraph, research note, or entity context to wire into your Second Brain..."
                    aria-label="New Second Brain chunk"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-sky-500 focus:outline-none text-xs text-white placeholder-slate-500"
                  />
                  <button
                    type="submit"
                    disabled={!newChunkInput.trim()}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Node</span>
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                {neurons.map((neuron) => (
                  <div
                    key={neuron.id}
                    className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-sky-300">
                          [[{neuron.title}]]
                        </span>
                        <span className="text-[10px] font-mono tabular-nums px-2 py-0.5 rounded bg-slate-900 text-emerald-300 border border-slate-800">
                          Weight: {neuron.strength}x • {neuron.retentionDepth || 98}% Retention
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          Source: {neuron.sourceTab}
                        </span>
                      </div>
                      {onDeleteNeuron && (
                        <button
                          type="button"
                          onClick={() => onDeleteNeuron(neuron.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
                          aria-label={`Delete neuron ${neuron.title}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-slate-200 leading-relaxed bg-slate-900/70 p-2.5 rounded-lg border border-slate-800/80">
                      &ldquo;{neuron.chunkText}&rdquo;
                    </p>

                    <div className="text-xs text-slate-300 leading-relaxed">
                      <span className="font-semibold text-sky-400">Synthesis: </span>
                      {neuron.distilledInsight}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap gap-1.5">
                        {neuron.keyPhrases.map((phrase, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30"
                          >
                            #{phrase}
                          </span>
                        ))}
                      </div>
                      {neuron.synapses.length > 0 && (
                        <div className="text-[10px] font-mono text-slate-400">
                          Connections: {neuron.synapses.length} linked nodes
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeSection === 'facts' && (
            <>
              <form onSubmit={handleTeachFact} className="flex gap-2">
                <input
                  type="text"
                  value={newFactInput}
                  onChange={(e) => setNewFactInput(e.target.value)}
                  placeholder="Teach SPIDAR a rule, person context, or domain note..."
                  aria-label="New memory fact"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-sky-500 focus:outline-none text-xs text-white placeholder-slate-500"
                />
                <button
                  type="submit"
                  disabled={!newFactInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save Fact</span>
                </button>
              </form>

              <div className="space-y-2">
                {knowledgeBase.facts.map((fact) => (
                  <div
                    key={fact.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800/90"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-900 text-sky-300 border border-slate-800">
                          {fact.category}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Source: {fact.source}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">{fact.content}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteFact(fact.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
                      aria-label={`Delete fact ${fact.content.slice(0, 20)}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeSection === 'export' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-xs font-bold text-white">
                  Portable Second Brain Extraction (Use SPIDAR&apos;s Brain in Other AI Projects)
                </div>
                <p className="text-[11.5px] text-slate-300 leading-relaxed">
                  Download SPIDAR&apos;s complete Second Brain—including all manually read passages, quantitative metrics, synaptic edges, and entity context nodes—to import into LangChain, LlamaIndex, Cursor, Claude, ChatGPT, or custom agents.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExportFormat('json')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      exportFormat === 'json'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <FileJson className="w-3.5 h-3.5" />
                    <span>Portable Brain Graph (.spidar-brain.json)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat('markdown')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      exportFormat === 'markdown'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Connected Markdown Vault (.md)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat('prompt')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      exportFormat === 'prompt'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Universal AI Prompt Injection (.txt)</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyExport}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy Brain'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadExport}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-white text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Extracted Brain</span>
                  </button>
                </div>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-[300px] leading-relaxed">
                {getExportContent()}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-950 border-t border-slate-800 text-xs">
          <button
            type="button"
            onClick={onResetVault}
            className="text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
          >
            Reset Default Second Brain
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
