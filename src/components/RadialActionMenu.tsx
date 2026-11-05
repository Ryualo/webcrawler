import React from 'react';
import {
  Activity,
  MessageSquare,
  Sparkles,
  Brain,
  Hash,
  Settings,
  X
} from 'lucide-react';

export type RadialActionId =
  | 'analyse-tab'
  | 'popup-qa'
  | 'popup-chunk'
  | 'popup-vault'
  | 'popup-phrases'
  | 'popup-settings';

export interface RadialActionMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  onSelectAction: (action: RadialActionId) => void;
  onClose: () => void;
  isCrawling: boolean;
  neuronCount?: number;
}

interface RadialButtonConfig {
  id: RadialActionId;
  label: string;
  sublabel: string;
  angleDeg: number;
  icon: React.ComponentType<{ className?: string }>;
  ringClass: string;
  badgeText?: string;
}

export const RadialActionMenu: React.FC<RadialActionMenuProps> = ({
  x,
  y,
  isOpen,
  onSelectAction,
  onClose,
  isCrawling,
  neuronCount = 0
}) => {
  if (!isOpen) return null;

  // Clamp center anchor so the 118px orbit radius never clips off-screen edges
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const margin = 148;
  const anchorX = Math.max(margin, Math.min(vw - margin, x));
  const anchorY = Math.max(margin, Math.min(vh - margin, y));
  const orbitRadius = 112;

  const actions: RadialButtonConfig[] = [
    {
      id: 'analyse-tab',
      label: isCrawling ? 'Crawling...' : 'Crawl',
      sublabel: 'Scan Page',
      angleDeg: -90, // Top (12 o'clock)
      icon: Activity,
      ringClass:
        'border-sky-400/70 bg-slate-950/95 text-sky-300 hover:border-sky-300 hover:bg-sky-950/90 shadow-[0_0_20px_rgba(56,189,248,0.35)]'
    },
    {
      id: 'popup-qa',
      label: 'Q&A Chat',
      sublabel: 'Ask SPIDAR',
      angleDeg: -30, // Top-Right (2 o'clock)
      icon: MessageSquare,
      ringClass:
        'border-indigo-400/70 bg-slate-950/95 text-indigo-300 hover:border-indigo-300 hover:bg-indigo-950/90 shadow-[0_0_20px_rgba(129,140,248,0.32)]'
    },
    {
      id: 'popup-chunk',
      label: 'Chunk Explain',
      sublabel: 'Deep Decode',
      angleDeg: 30, // Bottom-Right (4 o'clock)
      icon: Sparkles,
      ringClass:
        'border-pink-400/70 bg-slate-950/95 text-pink-300 hover:border-pink-300 hover:bg-pink-950/90 shadow-[0_0_20px_rgba(244,114,182,0.32)]'
    },
    {
      id: 'popup-vault',
      label: '2nd Brain',
      sublabel: 'Neural Vault',
      angleDeg: 90, // Bottom (6 o'clock)
      icon: Brain,
      ringClass:
        'border-emerald-400/70 bg-slate-950/95 text-emerald-300 hover:border-emerald-300 hover:bg-emerald-950/90 shadow-[0_0_20px_rgba(52,211,153,0.32)]',
      badgeText: neuronCount > 0 ? String(neuronCount) : undefined
    },
    {
      id: 'popup-phrases',
      label: 'Phrases',
      sublabel: 'Salient Terms',
      angleDeg: 150, // Bottom-Left (8 o'clock)
      icon: Hash,
      ringClass:
        'border-amber-400/70 bg-slate-950/95 text-amber-300 hover:border-amber-300 hover:bg-amber-950/90 shadow-[0_0_20px_rgba(251,191,36,0.3)]'
    },
    {
      id: 'popup-settings',
      label: 'Options',
      sublabel: 'API & Models',
      angleDeg: -150, // Top-Left (10 o'clock)
      icon: Settings,
      ringClass:
        'border-purple-400/70 bg-slate-950/95 text-purple-300 hover:border-purple-300 hover:bg-purple-950/90 shadow-[0_0_20px_rgba(192,132,252,0.3)]'
    }
  ];

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none select-none"
      aria-label="SPIDAR Radial Spider Menu"
    >
      {/* Subtle click-outside backdrop to dismiss radial menu */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/20 backdrop-blur-[1px] pointer-events-auto"
      />

      {/* Silk Web Orbit Ring & Radial Spokes SVG */}
      <svg
        className="fixed inset-0 w-screen h-screen pointer-events-none overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="spidarRadialGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.24" />
            <stop offset="70%" stopColor="#818cf8" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#090d15" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient aura around spider */}
        <circle
          cx={anchorX}
          cy={anchorY}
          r={orbitRadius + 28}
          fill="url(#spidarRadialGlow)"
        />

        {/* Inner & outer spiderweb silk rings */}
        <circle
          cx={anchorX}
          cy={anchorY}
          r={orbitRadius * 0.56}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="0.9"
          strokeDasharray="3 4"
          strokeOpacity="0.35"
        />
        <circle
          cx={anchorX}
          cy={anchorY}
          r={orbitRadius}
          fill="none"
          stroke="#7dd3fc"
          strokeWidth="1.2"
          strokeDasharray="5 5"
          strokeOpacity="0.45"
        />

        {/* Silk tether spokes from actual spider position to each radial node */}
        {actions.map((item) => {
          const rad = (item.angleDeg * Math.PI) / 180;
          const nodeX = anchorX + Math.cos(rad) * orbitRadius;
          const nodeY = anchorY + Math.sin(rad) * orbitRadius;
          return (
            <g key={`spoke-${item.id}`}>
              <line
                x1={anchorX}
                y1={anchorY}
                x2={nodeX}
                y2={nodeY}
                stroke="#7dd3fc"
                strokeWidth="1.25"
                strokeOpacity="0.42"
              />
              <circle
                cx={nodeX}
                cy={nodeY}
                r="3"
                fill="#38bdf8"
                fillOpacity="0.8"
              />
            </g>
          );
        })}
      </svg>

      {/* Central Close / Hub Button over Spider */}
      <button
        type="button"
        onClick={onClose}
        style={{
          left: `${anchorX}px`,
          top: `${anchorY}px`,
          transform: 'translate(-50%, -50%)'
        }}
        title="Close Radial Menu"
        className="fixed z-50 w-12 h-12 rounded-full bg-slate-950/90 border border-sky-400/60 text-sky-300 hover:text-white hover:border-sky-300 hover:scale-110 transition-all duration-150 flex items-center justify-center shadow-[0_0_24px_rgba(56,189,248,0.45)] cursor-pointer pointer-events-auto"
      >
        <X className="w-5 h-5" />
      </button>

      {/* 6 Orbiting Action Buttons */}
      {actions.map((item) => {
        const rad = (item.angleDeg * Math.PI) / 180;
        const nodeX = anchorX + Math.cos(rad) * orbitRadius;
        const nodeY = anchorY + Math.sin(rad) * orbitRadius;
        const IconComponent = item.icon;

        return (
          <button
            key={item.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectAction(item.id);
            }}
            style={{
              left: `${nodeX}px`,
              top: `${nodeY}px`,
              transform: 'translate(-50%, -50%)'
            }}
            className={`fixed z-50 group flex flex-col items-center justify-center w-[74px] h-[74px] rounded-full border-[1.5px] backdrop-blur-xl transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer pointer-events-auto ${item.ringClass}`}
          >
            {item.badgeText && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 font-mono text-[9.5px] font-bold shadow">
                {item.badgeText}
              </span>
            )}
            <IconComponent className="w-4 h-4 mb-0.5 transition-transform duration-150 group-hover:scale-110" />
            <span className="text-[10px] font-semibold tracking-tight leading-tight text-white">
              {item.label}
            </span>
            <span className="text-[8.5px] font-mono text-slate-400 leading-none mt-0.5">
              {item.sublabel}
            </span>
          </button>
        );
      })}
    </div>
  );
};
