import React from 'react';
import { SpiderLegJoints, SalientKeyword } from '../types';

interface SpiderSvgProps {
  joints: SpiderLegJoints[];
  accentColor?: string;
  isCrawling?: boolean;
  isTouchingKeyword?: boolean;
  isDragging?: boolean;
  breathPhase?: number;
  activeKeyword?: SalientKeyword | null;
  sleeping?: boolean;
  comprehensionIq?: number;
}

const HIP_COORDS = [
  { x: 110, y: 115 }, // L1
  { x: 108, y: 120 }, // L2
  { x: 108, y: 126 }, // L3
  { x: 111, y: 132 }, // L4
  { x: 130, y: 115 }, // R1
  { x: 132, y: 120 }, // R2
  { x: 132, y: 126 }, // R3
  { x: 129, y: 132 }  // R4
];

export const SpiderSvg: React.FC<SpiderSvgProps> = ({
  joints,
  accentColor = '#7dd3fc',
  isCrawling = false,
  isTouchingKeyword = false,
  isDragging = false,
  breathPhase = 0,
  sleeping = false
}) => {
  // Subtle organic breathing scale when stationary
  const breathWave = !isCrawling && !sleeping ? Math.sin(breathPhase * 0.85) : 0;
  // Dynamic crawling body stride oscillation & abdomen counter-sway when walking/scrolling
  const crawlStrideBobY = isCrawling ? Math.sin(breathPhase * 2.0) * 3.2 : 0;
  const crawlSwayX = isCrawling ? Math.cos(breathPhase) * 2.2 : 0;
  const abdomenWagDeg = isCrawling ? Math.sin(breathPhase) * 5.5 : 0;

  // Alternating pedipalp (front feeler) sweeping motion while walking
  const leftPalpReachY = isCrawling ? 164 + Math.sin(breathPhase) * 6 : isTouchingKeyword ? 168 : 163;
  const leftPalpReachX = isCrawling ? 106 + Math.cos(breathPhase) * 3 : isTouchingKeyword ? 106 : 108;
  const rightPalpReachY = isCrawling ? 164 - Math.sin(breathPhase) * 6 : isTouchingKeyword ? 168 : 163;
  const rightPalpReachX = isCrawling ? 134 - Math.cos(breathPhase) * 3 : isTouchingKeyword ? 134 : 132;

  const thoraxScaleX = 1 + breathWave * 0.045;
  const thoraxScaleY = 1 + breathWave * 0.055;
  const coreOpacity = 0.55 + breathWave * 0.25;

  const primaryStroke = isDragging
    ? '#f472b6'
    : isTouchingKeyword
    ? '#38bdf8'
    : accentColor;

  return (
    <svg
      className="w-full h-full overflow-visible pointer-events-none select-none"
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="spiderCorePulse" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={primaryStroke} stopOpacity={coreOpacity} />
          <stop offset="65%" stopColor="#38bdf8" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="wireframeBodyFill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0.96" />
        </linearGradient>
      </defs>

      {/* Soft Breathing / Crawling Aura Behind Spider Thorax */}
      <circle
        cx={120 + crawlSwayX}
        cy={120 + crawlStrideBobY}
        r={34 + breathWave * 4}
        fill="url(#spiderCorePulse)"
      />

      {/* 8 Long Spindly Wireframe-Articulated Legs with Continuous Stepping Gait */}
      {joints.map((leg, i) => {
        const baseHip = HIP_COORDS[i] || { x: 120, y: 120 };
        const hip = {
          x: baseHip.x + crawlSwayX,
          y: baseHip.y + crawlStrideBobY
        };
        const touching = Boolean(leg.isTouchingWord);
        const isPinkStyle = leg.highlightStyle === 'pink_highlight';
        const tipColor = touching
          ? isPinkStyle
            ? '#f472b6'
            : '#38bdf8'
          : '#fb7185';

        return (
          <g key={i}>
            {/* Drop-shadow under leg */}
            <polyline
              points={`${hip.x},${hip.y + 1.5} ${leg.kx},${Number(leg.ky) + 1.5} ${leg.ax},${Number(leg.ay) + 1.5} ${leg.fx},${Number(leg.fy) + 1.5}`}
              stroke="#020617"
              strokeOpacity="0.75"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />

            {/* Secondary Geometric Web-Truss Line (Hip -> Ankle) */}
            <line
              x1={hip.x}
              y1={hip.y}
              x2={leg.ax}
              y2={leg.ay}
              stroke="#38bdf8"
              strokeOpacity={touching ? '0.42' : '0.22'}
              strokeWidth="0.85"
            />

            {/* Segment 1: Long Slender Femur (Hip -> Knee) */}
            <line
              x1={hip.x}
              y1={hip.y}
              x2={leg.kx}
              y2={leg.ky}
              stroke={touching ? '#bae6fd' : '#7dd3fc'}
              strokeWidth={touching ? '2.1' : '1.75'}
              strokeLinecap="round"
            />

            {/* Segment 2: Long Slender Tibia (Knee -> Ankle) */}
            <line
              x1={leg.kx}
              y1={leg.ky}
              x2={leg.ax}
              y2={leg.ay}
              stroke={touching ? '#e0f2fe' : '#bae6fd'}
              strokeWidth={touching ? '1.8' : '1.45'}
              strokeLinecap="round"
            />

            {/* Segment 3: Needle Tarsus Reach Segment (Ankle -> Foot Tip) */}
            <line
              x1={leg.ax}
              y1={leg.ay}
              x2={leg.fx}
              y2={leg.fy}
              stroke={touching ? (isPinkStyle ? '#f472b6' : '#ffffff') : '#e2e8f0'}
              strokeWidth={touching ? '1.7' : '1.25'}
              strokeLinecap="round"
            />

            {/* Coxa Hip Vertex */}
            <circle
              cx={hip.x}
              cy={hip.y}
              r="1.8"
              fill="#020617"
              stroke="#7dd3fc"
              strokeWidth="1"
            />

            {/* Knee Joint Vertex */}
            <circle
              cx={leg.kx}
              cy={leg.ky}
              r="2.1"
              fill="#020617"
              stroke={touching ? '#ffffff' : '#38bdf8'}
              strokeWidth="1.2"
            />

            {/* Ankle Joint Vertex */}
            <circle
              cx={leg.ax}
              cy={leg.ay}
              r="1.6"
              fill="#020617"
              stroke="#bae6fd"
              strokeWidth="1"
            />

            {/* Word/Phrase Contact Ripple & Glowing Coral/Cyan Foot Tip */}
            {touching && (
              <circle
                cx={leg.fx}
                cy={leg.fy}
                r="5.5"
                fill="none"
                stroke={tipColor}
                strokeWidth="1.1"
                strokeOpacity="0.8"
              />
            )}
            <circle
              cx={leg.fx}
              cy={leg.fy}
              r={touching ? '2.8' : '2.2'}
              fill={tipColor}
              stroke="#ffffff"
              strokeWidth="0.9"
            />
          </g>
        );
      })}

      {/* Breathing & Crawling Geometric Wireframe Body */}
      <g
        transform={`translate(${120 + crawlSwayX}, ${120 + crawlStrideBobY}) scale(${thoraxScaleX.toFixed(3)}, ${thoraxScaleY.toFixed(3)}) translate(-120, -120)`}
      >
        {/* Elongated Geometric Abdomen with Counter-Sway during Crawling */}
        <g transform={`rotate(${abdomenWagDeg.toFixed(2)}, 120, 115)`}>
          <polygon
            points="120,76 133,88 131,111 120,117 109,111 107,88"
            fill="url(#wireframeBodyFill)"
            stroke="#bae6fd"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <line x1="120" y1="76" x2="120" y2="117" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.75" />
          <line x1="107" y1="88" x2="133" y2="88" stroke="#38bdf8" strokeWidth="0.9" strokeOpacity="0.55" />
          <line x1="108" y1="100" x2="132" y2="100" stroke="#38bdf8" strokeWidth="0.9" strokeOpacity="0.55" />
          <polygon
            points="120,83 126,94 120,108 114,94"
            fill={primaryStroke}
            fillOpacity={0.22 + breathWave * 0.08}
            stroke="#e0f2fe"
            strokeWidth="0.9"
          />
        </g>

        {/* Cephalothorax / Prosoma (Lower section facing downward along text flow) */}
        <polygon
          points="111,116 129,116 133,127 127,141 120,146 113,141 107,127"
          fill="url(#wireframeBodyFill)"
          stroke="#f8fafc"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <line x1="111" y1="116" x2="127" y2="141" stroke="#38bdf8" strokeWidth="0.85" strokeOpacity="0.6" />
        <line x1="129" y1="116" x2="113" y2="141" stroke="#38bdf8" strokeWidth="0.85" strokeOpacity="0.6" />

        {/* Alternating Articulated Pedipalps (Front Feelers that sweep as the spider walks) */}
        <polyline
          points={`112,140 102,152 ${leftPalpReachX.toFixed(1)},${leftPalpReachY.toFixed(1)}`}
          fill="none"
          stroke="#bae6fd"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={leftPalpReachX.toFixed(1)}
          cy={leftPalpReachY.toFixed(1)}
          r="1.8"
          fill="#fb7185"
          stroke="#ffffff"
          strokeWidth="0.7"
        />

        <polyline
          points={`128,140 138,152 ${rightPalpReachX.toFixed(1)},${rightPalpReachY.toFixed(1)}`}
          fill="none"
          stroke="#bae6fd"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={rightPalpReachX.toFixed(1)}
          cy={rightPalpReachY.toFixed(1)}
          r="1.8"
          fill="#fb7185"
          stroke="#ffffff"
          strokeWidth="0.7"
        />

        {/* Anterior Optical Eyes */}
        <circle cx="116.5" cy="138" r="1.8" fill={sleeping ? '#475569' : '#38bdf8'} stroke="#ffffff" strokeWidth="0.6" />
        <circle cx="123.5" cy="138" r="1.8" fill={sleeping ? '#475569' : '#38bdf8'} stroke="#ffffff" strokeWidth="0.6" />
        <circle cx="113" cy="135" r="1.2" fill={sleeping ? '#475569' : '#bae6fd'} />
        <circle cx="127" cy="135" r="1.2" fill={sleeping ? '#475569' : '#bae6fd'} />
      </g>
    </svg>
  );
};
