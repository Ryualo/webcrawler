import React, { useState } from 'react';
import { ArrowDownCircle, Play, Pause } from 'lucide-react';
import {
  SpiderLegJoints,
  SalientKeyword,
  WebSummaryResult,
  ChatMessage,
  NeuralKnowledgeBase,
  ContextualLine,
  ChunkExplanationResult,
  MemoryNeuron
} from '../types';
import { SpiderSvg } from './SpiderSvg';
import { IntelligenceCard } from './IntelligenceCard';
import { NeuralVaultModal } from './NeuralVaultModal';
import { RadialActionMenu, RadialActionId } from './RadialActionMenu';

export interface NearbyHighlightOverlay {
  id: string;
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  style: 'cyan_box' | 'pink_highlight';
}

export interface SpidarCompanionOverlayProps {
  showSpiderActor?: boolean;
  showHighlightBoxes?: boolean;
  spiderPos: { x: number; y: number };
  spiderTilt: number;
  legPhase: number;
  sleeping: boolean;
  currentJoints: SpiderLegJoints[];
  activeCrawlingAnimation: boolean;
  isCrawling: boolean;
  crawlPaused: boolean;
  crawlProgress: number;
  spiderSpeed: number;
  isTouchingKeyword: boolean;
  activeKeyword: SalientKeyword | null;
  activeLineIndex: number | null;
  isDraggingSpider: boolean;
  hoveredChunkIndex: number | null;
  nearbyHighlights: NearbyHighlightOverlay[];
  onSpiderClick: () => void;
  onSpiderPointerDown: (e: React.PointerEvent) => void;
  onSpiderPointerMove: (e: React.PointerEvent) => void;
  onSpiderPointerUp: () => void;
  onSpiderSpeedChange: (speed: number) => void;
  onToggleCrawlPause: () => void;
  onFinishCrawlNow: () => void;
  onStartCrawl: () => void;

  // Radial Spider Menu state & callbacks
  radialMenuOpen?: boolean;
  onToggleRadialMenu?: () => void;
  onCloseRadialMenu?: () => void;
  onSelectRadialAction?: (action: RadialActionId) => void;
  onExplainActiveChunk?: () => void;

  // Intelligence Card & Second Brain Vault state
  intelligenceCardOpen: boolean;
  intelligenceInitialTab: 'summary' | 'qa' | 'keywords' | 'vault';
  onOpenIntelligenceTab?: (tab: 'summary' | 'qa' | 'keywords' | 'vault') => void;
  onCloseIntelligenceCard: () => void;
  currentSummary: WebSummaryResult | null;
  chatMessages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onClearChat: () => void;
  isThinking: boolean;
  knowledgeBase: NeuralKnowledgeBase;
  minimalistMode: boolean;
  onToggleMinimalist: () => void;
  activeModelLabel: string;
  contextualLines: ContextualLine[];
  selectedChunkExplanation: ChunkExplanationResult | null;
  isExplainingChunk: boolean;
  onClearChunkExplanation: () => void;
  vaultModalOpen: boolean;
  onOpenVaultModal: () => void;
  onCloseVaultModal: () => void;
  onAddMemoryFact: (factText: string) => void;
  onAddNeuron: (chunkText: string, customTitle?: string) => void;
  onDeleteNeuron: (neuronId: string) => void;
  onDeleteMemoryFact: (factId: string) => void;
  onResetVault: () => void;
  onAskAboutNeuron: (neuron: MemoryNeuron) => void;
  onOpenFullStudio?: (view?: 'analyzer' | 'outline-studio' | 'neural-graph' | 'extension-options') => void;
}

export const SpidarCompanionOverlay: React.FC<SpidarCompanionOverlayProps> = ({
  showSpiderActor = true,
  showHighlightBoxes = false,
  spiderPos,
  spiderTilt,
  legPhase,
  sleeping,
  currentJoints,
  activeCrawlingAnimation,
  isCrawling,
  crawlPaused,
  crawlProgress,
  spiderSpeed,
  isTouchingKeyword,
  activeKeyword,
  activeLineIndex,
  isDraggingSpider,
  hoveredChunkIndex,
  nearbyHighlights,
  onSpiderClick,
  onSpiderPointerDown,
  onSpiderPointerMove,
  onSpiderPointerUp,
  onSpiderSpeedChange,
  onToggleCrawlPause,
  onFinishCrawlNow,
  onStartCrawl,
  radialMenuOpen: controlledRadialOpen,
  onToggleRadialMenu,
  onCloseRadialMenu,
  onSelectRadialAction,
  onExplainActiveChunk,
  intelligenceCardOpen,
  intelligenceInitialTab,
  onOpenIntelligenceTab,
  onCloseIntelligenceCard,
  currentSummary,
  chatMessages,
  onSendMessage,
  onClearChat,
  isThinking,
  knowledgeBase,
  minimalistMode,
  onToggleMinimalist,
  activeModelLabel,
  contextualLines,
  selectedChunkExplanation,
  isExplainingChunk,
  onClearChunkExplanation,
  vaultModalOpen,
  onOpenVaultModal,
  onCloseVaultModal,
  onAddMemoryFact,
  onAddNeuron,
  onDeleteNeuron,
  onDeleteMemoryFact,
  onResetVault,
  onAskAboutNeuron,
  onOpenFullStudio
}) => {
  const [internalRadialOpen, setInternalRadialOpen] = useState(false);
  const isRadialOpen =
    typeof controlledRadialOpen === 'boolean' ? controlledRadialOpen : internalRadialOpen;

  const closeRadial = () => {
    if (onCloseRadialMenu) {
      onCloseRadialMenu();
    } else {
      setInternalRadialOpen(false);
    }
  };

  const handleSpiderActorClick = () => {
    if (onToggleRadialMenu) {
      onToggleRadialMenu();
      return;
    }
    onSpiderClick();
  };

  const handleRadialSelect = (action: RadialActionId) => {
    closeRadial();
    if (onSelectRadialAction) {
      onSelectRadialAction(action);
      return;
    }
    switch (action) {
      case 'analyse-tab':
        onStartCrawl();
        break;
      case 'popup-qa':
        onOpenIntelligenceTab?.('qa');
        break;
      case 'popup-chunk':
        onExplainActiveChunk?.();
        onOpenIntelligenceTab?.('summary');
        break;
      case 'popup-vault':
        onOpenIntelligenceTab?.('vault');
        break;
      case 'popup-phrases':
        onOpenIntelligenceTab?.('keywords');
        break;
      case 'popup-settings':
        onOpenFullStudio?.('extension-options');
        break;
    }
  };

  return (
    <>
      {/* Non-destructive Phrase Highlight Overlays for Live External Webpages */}
      {showHighlightBoxes && (isCrawling || isDraggingSpider) && nearbyHighlights.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-30">
          {nearbyHighlights.map((hl) => (
            <div
              key={`box-${hl.id}`}
              style={{
                left: `${hl.left - 3}px`,
                top: `${hl.top - 2}px`,
                width: `${hl.width + 6}px`,
                height: `${hl.height + 4}px`
              }}
              className={`fixed rounded transition-all duration-75 ${
                hl.style === 'pink_highlight'
                  ? 'bg-pink-500/30 border border-pink-400/90 shadow-[0_0_12px_rgba(244,114,182,0.45)]'
                  : 'bg-sky-500/20 border-[1.5px] border-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.4)]'
              }`}
            />
          ))}
        </div>
      )}

      {/* Multi-Phrase Scanner Tethers during active crawl or drag */}
      {(isCrawling || isDraggingSpider) && nearbyHighlights.length > 0 && (
        <svg className="fixed inset-0 w-screen h-screen pointer-events-none z-30 overflow-visible">
          {nearbyHighlights.map((hl) => {
            const targetX = hl.left + hl.width / 2;
            const targetY = hl.top + hl.height / 2;
            return (
              <g key={hl.id}>
                <line
                  x1={spiderPos.x}
                  y1={spiderPos.y}
                  x2={targetX}
                  y2={targetY}
                  stroke={hl.style === 'pink_highlight' ? '#f472b6' : '#38bdf8'}
                  strokeWidth={hl.style === 'pink_highlight' ? '1.6' : '1.2'}
                  strokeOpacity="0.6"
                />
                <circle
                  cx={targetX}
                  cy={targetY}
                  r="2.6"
                  fill={hl.style === 'pink_highlight' ? '#f472b6' : '#38bdf8'}
                  stroke="#ffffff"
                  strokeWidth="0.8"
                />
              </g>
            );
          })}
        </svg>
      )}

      {/* Long-Legged Interactive SPIDAR Companion Actor */}
      {showSpiderActor && (
        <button
          type="button"
          onClick={handleSpiderActorClick}
          onPointerDown={onSpiderPointerDown}
          onPointerMove={onSpiderPointerMove}
          onPointerUp={onSpiderPointerUp}
          aria-label="SPIDAR Interactive Companion"
          style={{
            left: `${spiderPos.x}px`,
            top: `${spiderPos.y}px`,
            transform: `translate(-50%, -50%) rotate(${spiderTilt}deg) scale(${sleeping ? 0.72 : 1})`
          }}
          className="fixed z-40 w-44 h-44 rounded-full focus:outline-none group cursor-grab active:cursor-grabbing select-none touch-none pointer-events-auto"
        >
          <SpiderSvg
            joints={currentJoints}
            accentColor="#7dd3fc"
            isCrawling={activeCrawlingAnimation}
            isTouchingKeyword={isTouchingKeyword}
            isDragging={isDraggingSpider}
            breathPhase={legPhase}
            activeKeyword={activeKeyword}
            sleeping={sleeping}
          />
          {isDraggingSpider && hoveredChunkIndex !== null && (
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-slate-950/90 border border-pink-400/70 text-[9.5px] font-mono font-semibold text-pink-200 whitespace-nowrap shadow-lg">
              DROP ON CHUNK #{hoveredChunkIndex + 1} TO EXPLAIN
            </span>
          )}
        </button>
      )}

      {/* Original Orbiting Radial Spider Menu around the Central Spider */}
      <RadialActionMenu
        x={spiderPos.x}
        y={spiderPos.y}
        isOpen={isRadialOpen}
        onSelectAction={handleRadialSelect}
        onClose={closeRadial}
        isCrawling={isCrawling}
        neuronCount={(knowledgeBase.neurons || []).length}
      />

      {/* Stationary Downward Crawl HUD (Bottom-Left) */}
      {isCrawling && (
        <div
          className="fixed left-6 bottom-6 z-40 w-80 bg-[#090d15]/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 shadow-2xl space-y-2.5 pointer-events-auto"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <ArrowDownCircle className="w-3.5 h-3.5 text-sky-400 animate-bounce" />
              <span>Center-Locked Crawl ({spiderSpeed.toFixed(1)}x)</span>
            </span>
            <span className="text-xs font-mono font-bold text-sky-400">
              {Math.round(crawlProgress * 100)}%
            </span>
          </div>

          <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
            <div
              style={{ width: `${Math.round(crawlProgress * 100)}%` }}
              className="h-full bg-sky-400 transition-all duration-75"
            />
          </div>

          <div className="text-[11px] text-slate-300 font-mono truncate">
            {isTouchingKeyword && activeKeyword
              ? `Line ${(activeLineIndex ?? 0) + 1}: Long legs scanning #${activeKeyword.word}`
              : `Scanning nearby sentences around Line ${(activeLineIndex ?? 0) + 1}`}
          </div>

          <div className="flex items-center justify-between gap-1 pt-0.5">
            <span className="text-[10px] font-mono text-slate-400 mr-1">Speed:</span>
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

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onToggleCrawlPause}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-medium cursor-pointer"
            >
              {crawlPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{crawlPaused ? 'Resume' : 'Pause'}</span>
            </button>
            <button
              type="button"
              onClick={onFinishCrawlNow}
              className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-white text-slate-950 text-xs font-semibold cursor-pointer"
            >
              View Summary Now
            </button>
          </div>
        </div>
      )}

      {/* Draggable Floating Intelligence Card */}
      {intelligenceCardOpen && (
        <IntelligenceCard
          x={48}
          y={96}
          summary={currentSummary}
          chatMessages={chatMessages}
          onSendMessage={onSendMessage}
          onClearChat={onClearChat}
          isThinking={isThinking}
          onClose={onCloseIntelligenceCard}
          memoryFacts={knowledgeBase.facts}
          neurons={knowledgeBase.neurons || []}
          knowledgeBase={knowledgeBase}
          minimalistMode={minimalistMode}
          onToggleMinimalist={onToggleMinimalist}
          initialTab={intelligenceInitialTab}
          activeModelLabel={activeModelLabel}
          contextualLines={contextualLines}
          selectedChunkExplanation={selectedChunkExplanation}
          isExplainingChunk={isExplainingChunk}
          onClearChunkExplanation={onClearChunkExplanation}
          onStartCrawl={onStartCrawl}
          onAddNeuron={onAddNeuron}
          onDeleteNeuron={onDeleteNeuron}
          onOpenFullStudio={onOpenFullStudio}
          onOpenVault={() => {
            onCloseIntelligenceCard();
            onOpenVaultModal();
          }}
        />
      )}

      {/* Full Second Brain Vault & Graph Modal */}
      <NeuralVaultModal
        isOpen={vaultModalOpen}
        onClose={onCloseVaultModal}
        knowledgeBase={knowledgeBase}
        onAddFact={onAddMemoryFact}
        onAddNeuron={onAddNeuron}
        onDeleteNeuron={onDeleteNeuron}
        onDeleteFact={onDeleteMemoryFact}
        onResetVault={onResetVault}
        onAskAboutNeuron={onAskAboutNeuron}
      />
    </>
  );
};
