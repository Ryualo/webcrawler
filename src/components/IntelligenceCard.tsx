import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Bot,
  Brain,
  Hash,
  Copy,
  Check,
  Send,
  Sparkles,
  Minimize2,
  Maximize2,
  GripHorizontal,
  RotateCcw,
  Download,
  ArrowDownCircle,
  ExternalLink,
  X
} from 'lucide-react';
import {
  WebSummaryResult,
  ChatMessage,
  MemoryFact,
  MemoryNeuron,
  NeuralKnowledgeBase,
  ContextualLine,
  ChunkExplanationResult
} from '../types';
import { NeuralBrainGraph } from './NeuralBrainGraph';
import { downloadExtractedBrainFile } from '../utils/neuralMemory';

export interface IntelligenceCardProps {
  x: number;
  y: number;
  summary: WebSummaryResult | null;
  chatMessages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onClearChat?: () => void;
  isThinking: boolean;
  onClose: () => void;
  memoryFacts: MemoryFact[];
  neurons?: MemoryNeuron[];
  knowledgeBase?: NeuralKnowledgeBase;
  onOpenVault: () => void;
  minimalistMode?: boolean;
  onToggleMinimalist?: () => void;
  initialTab?: 'summary' | 'qa' | 'keywords' | 'vault';
  activeModelLabel?: string;
  contextualLines?: ContextualLine[];
  selectedChunkExplanation?: ChunkExplanationResult | null;
  isExplainingChunk?: boolean;
  onClearChunkExplanation?: () => void;
  onStartCrawl?: () => void;
  onAddNeuron?: (chunkText: string, customTitle?: string) => void;
  onDeleteNeuron?: (neuronId: string) => void;
  onOpenFullStudio?: (view?: 'analyzer' | 'outline-studio' | 'neural-graph' | 'extension-options') => void;
}

const SUGGESTED_PROMPTS = [
  "Who are you & what's your purpose?",
  'Explain the core mechanism of this page',
  'How does quantum computing work?'
];

export const IntelligenceCard: React.FC<IntelligenceCardProps> = ({
  x,
  y,
  summary,
  chatMessages,
  onSendMessage,
  onClearChat,
  isThinking,
  onClose,
  memoryFacts,
  neurons = [],
  knowledgeBase,
  onOpenVault,
  minimalistMode = false,
  onToggleMinimalist,
  initialTab = 'summary',
  activeModelLabel,
  contextualLines = [],
  selectedChunkExplanation = null,
  isExplainingChunk = false,
  onClearChunkExplanation,
  onStartCrawl,
  onAddNeuron,
  onDeleteNeuron,
  onOpenFullStudio
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'qa' | 'keywords' | 'vault'>(initialTab);
  const [inputQuestion, setInputQuestion] = useState('');
  const [newNeuronText, setNewNeuronText] = useState('');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({
    x: Math.max(16, Math.min((typeof window !== 'undefined' ? window.innerWidth : 1200) - 490, x)),
    y: Math.max(76, Math.min((typeof window !== 'undefined' ? window.innerHeight : 800) - 540, y))
  }));
  const draggingHeaderRef = useRef(false);
  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (isExplainingChunk || selectedChunkExplanation) {
      setActiveTab('summary');
    }
  }, [isExplainingChunk, selectedChunkExplanation]);

  useEffect(() => {
    if (activeTab === 'qa') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isThinking, activeTab]);

  const handleHeaderPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    draggingHeaderRef.current = true;
    dragOffsetRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleHeaderPointerMove = (e: React.PointerEvent) => {
    if (!draggingHeaderRef.current) return;
    setPos({
      x: Math.max(12, Math.min(window.innerWidth - 360, e.clientX - dragOffsetRef.current.dx)),
      y: Math.max(56, Math.min(window.innerHeight - 120, e.clientY - dragOffsetRef.current.dy))
    });
  };

  const handleHeaderPointerUp = () => {
    draggingHeaderRef.current = false;
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 1800);
  };

  const handleSend = (overridePrompt?: string) => {
    const q = (overridePrompt ?? inputQuestion).trim();
    if (!q || isThinking) return;
    onSendMessage(q);
    if (!overridePrompt) setInputQuestion('');
  };

  const effectiveContextualLines =
    summary?.contextualLines && summary.contextualLines.length > 0
      ? summary.contextualLines
      : contextualLines;

  const highContextLines = effectiveContextualLines.filter(
    (l) => l.hasHighContext || (l.phrases && l.phrases.length > 0) || (l.keywords && l.keywords.length > 0)
  );

  return (
    <div
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      className={`fixed z-50 w-[475px] max-w-[calc(100vw-32px)] bg-[#090d16]/98 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 shadow-2xl text-slate-100 flex flex-col transition-all duration-150 pointer-events-auto ${
        minimalistMode ? 'max-h-[430px]' : 'max-h-[560px]'
      }`}
    >
      {/* Draggable Header */}
      <div
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 mb-2.5 cursor-grab active:cursor-grabbing select-none touch-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="p-1.5 rounded-lg bg-slate-900 text-sky-400 border border-slate-800 shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-white tracking-wide flex items-center gap-2">
              <span className="truncate">SPIDAR Intelligence</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-emerald-400 border border-slate-800 shrink-0">
                {neurons.length} Neurons
              </span>
            </h3>
            <div className="text-[10px] text-slate-400 font-mono truncate max-w-[260px]">
              {summary?.generatedBy || activeModelLabel || 'Dual-Mode AI & Deep-Read Second Brain'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onStartCrawl && (
            <button
              type="button"
              onClick={onStartCrawl}
              title="Crawl & Analyse Tab (1:1 Center Walk)"
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-white text-slate-950 text-[10.5px] font-bold transition-colors cursor-pointer mr-0.5"
            >
              <ArrowDownCircle className="w-3 h-3" />
              <span>Crawl</span>
            </button>
          )}
          {onOpenFullStudio && (
            <button
              type="button"
              onClick={() => onOpenFullStudio('analyzer')}
              title="Open Full SPIDAR Studio Workspace"
              className="p-1.5 text-sky-400 hover:text-sky-200 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Open Full Studio"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
          {onToggleMinimalist && (
            <button
              type="button"
              onClick={onToggleMinimalist}
              title={minimalistMode ? 'Expand View' : 'Minimalist View'}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Toggle minimalist view"
            >
              {minimalistMode ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close intelligence card"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800/80 mb-3 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('summary')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
            activeTab === 'summary'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Deep Read</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('qa')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
            activeTab === 'qa'
              ? 'bg-slate-800 text-sky-300 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>AI Q&amp;A</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('keywords')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
            activeTab === 'keywords'
              ? 'bg-slate-800 text-cyan-300 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Hash className="w-3.5 h-3.5" />
          <span>Phrases</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vault')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
            activeTab === 'vault'
              ? 'bg-slate-800 text-purple-300 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          <span>2nd Brain</span>
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[250px] text-xs select-text">
        {activeTab === 'summary' && (
          <>
            {(isExplainingChunk || selectedChunkExplanation) && (
              <div className="p-3 rounded-xl bg-slate-950 border border-pink-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-pink-300 font-bold">
                    {isExplainingChunk
                      ? 'Explaining Dropped Text Chunk...'
                      : `Chunk #${(selectedChunkExplanation?.chunkIndex ?? 0) + 1} Summary & Explanation`}
                  </span>
                  {onClearChunkExplanation && !isExplainingChunk && (
                    <button
                      type="button"
                      onClick={onClearChunkExplanation}
                      className="text-[10px] font-mono text-slate-400 hover:text-white cursor-pointer"
                    >
                      Dismiss ✕
                    </button>
                  )}
                </div>

                {isExplainingChunk ? (
                  <p className="text-pink-200 text-xs">
                    SPIDAR is reading this text chunk and wiring a Neuron into your Second Brain...
                  </p>
                ) : selectedChunkExplanation ? (
                  <div className="space-y-2">
                    <p className="text-slate-100 leading-relaxed font-medium">
                      {selectedChunkExplanation.naturalSummary}
                    </p>
                    <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
                      <div className="text-[10px] font-mono uppercase text-sky-300 font-semibold">
                        Plain-English Explanation
                      </div>
                      <p className="text-slate-200 leading-relaxed">
                        {selectedChunkExplanation.plainExplanation}
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/90 border border-purple-500/30 space-y-1">
                      <div className="text-[10px] font-mono uppercase text-purple-300 font-semibold">
                        Second Brain Connection
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        {selectedChunkExplanation.whyItMatters}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedChunkExplanation.keyPhrases.map((kp, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-pink-500/20 text-pink-200 border border-pink-400/40"
                        >
                          {kp}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('qa');
                        onSendMessage(
                          `Can you explain more about Chunk #${
                            selectedChunkExplanation.chunkIndex + 1
                          } regarding ${selectedChunkExplanation.keyPhrases[0] || 'this mechanism'}?`
                        );
                      }}
                      className="w-full py-1.5 px-3 rounded-lg bg-pink-500 hover:bg-pink-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Ask Follow-Up in AI Q&amp;A
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[10.5px] font-semibold text-sky-400 uppercase tracking-wider">
                <span>Synthesized Core Thesis (98% Deep-Read Retention)</span>
                <button
                  type="button"
                  onClick={() => handleCopy(summary?.coreThesis || '', 'thesis')}
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-sky-300 cursor-pointer"
                >
                  {copiedSection === 'thesis' ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  {copiedSection === 'thesis' ? 'Copied' : 'Copy'}
                </button>
              </div>
              {isThinking && !summary ? (
                <div className="flex items-center gap-2 py-1 text-sky-300">
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                  <span>Synthesizing webpage thesis and indexing Second Brain Neurons...</span>
                </div>
              ) : (
                <p className="text-slate-200 leading-relaxed">
                  {summary?.coreThesis ||
                    'Drag SPIDAR onto any paragraph to explain it, or click Crawl to synthesize the full tab.'}
                </p>
              )}
              {!summary && !isThinking && onStartCrawl && (
                <button
                  type="button"
                  onClick={onStartCrawl}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-100 hover:bg-white text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
                >
                  <ArrowDownCircle className="w-3.5 h-3.5" />
                  <span>Crawl &amp; Analyse This Tab Now</span>
                </button>
              )}
            </div>

            {!minimalistMode && (
              <div className="space-y-1.5">
                <div className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                  Retained Deep-Read Passages &amp; Takeaways
                </div>
                <div className="space-y-1.5">
                  {(summary?.executiveBullets || ['Awaiting tab scan...']).map((bullet, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/90 text-slate-200 leading-relaxed"
                    >
                      {bullet}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'qa' && (
          <div className="flex flex-col h-[310px]">
            {chatMessages.length > 0 && onClearChat && (
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800/80 text-[10px] font-mono">
                <span className="text-purple-300">
                  Second Brain: {neurons.length} Neurons Persist Independently
                </span>
                <button
                  type="button"
                  onClick={onClearChat}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Clear Chat (Keep Brain)</span>
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 mb-2">
              {chatMessages.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sky-400 font-semibold">
                      <Bot className="w-4 h-4" />
                      <span>Dual-Mode AI &amp; Second Brain Q&amp;A</span>
                    </div>
                    <span className="text-[9.5px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      Context Indexer
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Ask general questions for direct AI synthesis, query manually read passages for exhaustive deep-read recall, or enter a person/entity name to clarify context and link a Second Brain Neuron.
                  </p>
                  <div className="space-y-1 pt-1">
                    <div className="text-[10px] text-slate-500 uppercase font-mono">
                      Suggested Analytical Prompts:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {SUGGESTED_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => handleSend(prompt)}
                          className="text-left text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sky-300 transition-colors cursor-pointer"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[92%] p-3 rounded-xl text-xs leading-relaxed whitespace-pre-line ${
                        msg.role === 'user'
                          ? 'bg-sky-500 text-slate-950 font-semibold'
                          : 'bg-slate-950 border border-slate-800 text-slate-100'
                      }`}
                    >
                      {(msg.content || (msg.isStreaming ? 'Synthesizing...' : ''))
                        .replace(/\*\*/g, '')
                        .replace(/`([^`]+)`/g, '$1')}
                    </div>
                    {msg.role === 'assistant' && !msg.isStreaming && (
                      <div className="flex flex-col items-start gap-1 mt-1 max-w-[92%]">
                        {msg.webSources && msg.webSources.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {msg.webSources.slice(0, 4).map((src, sIdx) => (
                              <a
                                key={`${src.url}-${sIdx}`}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={src.snippet}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-[9.5px] font-mono text-sky-300 truncate max-w-[200px]"
                              >
                                <span>↗</span>
                                <span className="truncate">{src.title}</span>
                              </a>
                            ))}
                          </div>
                        )}
                        {msg.trainedNeuron && (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/40 text-[10px] font-mono text-emerald-300">
                            <Sparkles className="w-3 h-3 text-emerald-400" />
                            <span>
                              Indexed Neuron: [[{msg.trainedNeuron.title}]]
                            </span>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-[9.5px] text-slate-500 font-mono">
                          <span>{msg.modelUsed || 'AI Synthesis'}</span>
                          {msg.activatedNeurons && msg.activatedNeurons.length > 0 && (
                            <span className="text-purple-400">
                              • Fired Neuron: [[{msg.activatedNeurons[0]}]]
                            </span>
                          )}
                          {msg.citedLines && msg.citedLines.length > 0 && (
                            <span className="text-cyan-400">
                              • Lines {msg.citedLines.join(', ')}
                            </span>
                          )}
                          {onAddNeuron && msg.content && (
                            <button
                              type="button"
                              onClick={() =>
                                onAddNeuron(
                                  msg.content,
                                  `AI Synthesis: ${msg.content.split(/\s+/).slice(0, 5).join(' ')}`
                                )
                              }
                              className="text-sky-400 hover:text-sky-200 underline cursor-pointer"
                            >
                              + Save to Graph
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
              {isThinking && chatMessages.every((m) => !m.isStreaming) && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sky-400 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
                  <span>Synthesizing...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <input
                type="text"
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask a question, query deep-read memory, or enter an entity name..."
                aria-label="Ask AI about this article"
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-sky-500 focus:outline-none text-xs text-white placeholder-slate-500"
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!inputQuestion.trim() || isThinking}
                className="p-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 transition-colors cursor-pointer"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'keywords' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Phrases &amp; words scanned across nearby sentences:</span>
              <span className="text-cyan-400 font-mono font-bold">
                {highContextLines.length} Lines
              </span>
            </div>

            {highContextLines.length > 0 ? (
              <div className="space-y-2">
                {highContextLines.map((line) => (
                  <div
                    key={line.lineIndex}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="text-[10px] font-mono font-bold text-cyan-300 uppercase">
                        Line {line.lineIndex + 1} • {line.contextType.replace('_', ' ')}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {(line.phrases || []).map((p) => (
                          <span
                            key={p.id}
                            className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                              p.style === 'pink_highlight'
                                ? 'bg-pink-500/25 text-pink-200 border border-pink-400/50'
                                : 'bg-sky-500/15 text-sky-200 border border-sky-400/60'
                            }`}
                          >
                            {p.phrase}
                          </span>
                        ))}
                        {(line.keywords || []).slice(0, 3).map((kw) => (
                          <span
                            key={kw.word}
                            className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-slate-300 border border-slate-800"
                          >
                            #{kw.word}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{line.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400">
                Click Crawl to scan and index high-salience phrases across this page.
              </div>
            )}
          </div>
        )}

        {activeTab === 'vault' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <div className="text-xs font-bold text-white">
                  Neural Graph ({neurons.length} Neurons)
                </div>
                <div className="text-[10.5px] text-slate-400">
                  {memoryFacts.length} Facts • Persists Independently of Chat
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {knowledgeBase && (
                  <button
                    type="button"
                    onClick={() => downloadExtractedBrainFile(knowledgeBase, 'json')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Extract Brain</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenVault}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  <Brain className="w-3 h-3" />
                  <span>Full Graph</span>
                </button>
              </div>
            </div>

            {onAddNeuron && (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newNeuronText}
                  onChange={(e) => setNewNeuronText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newNeuronText.trim()) {
                      onAddNeuron(newNeuronText.trim());
                      setNewNeuronText('');
                    }
                  }}
                  placeholder="Store a new concept or entity context as a Neuron..."
                  aria-label="Store new Second Brain neuron"
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-purple-400 focus:outline-none text-xs text-white placeholder-slate-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newNeuronText.trim()) return;
                    onAddNeuron(newNeuronText.trim());
                    setNewNeuronText('');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs cursor-pointer"
                >
                  + Neuron
                </button>
              </div>
            )}

            {knowledgeBase ? (
              <NeuralBrainGraph
                knowledgeBase={knowledgeBase}
                compact={true}
                onDeleteNeuron={onDeleteNeuron}
                onAskAboutNeuron={(neuron) => {
                  setActiveTab('qa');
                  onSendMessage(
                    `Provide a detailed explanation of the "${neuron.title}" neuron in my Second Brain.`
                  );
                }}
              />
            ) : (
              <div className="space-y-2 max-h-[210px] overflow-y-auto pr-1">
                {neurons.map((neuron) => (
                  <div
                    key={neuron.id}
                    className="p-2.5 rounded-xl bg-slate-950 border border-purple-500/30 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-300">[[{neuron.title}]]</span>
                      <span className="text-[10px] font-mono text-emerald-400">
                        {neuron.strength}x synapse
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {neuron.distilledInsight}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
