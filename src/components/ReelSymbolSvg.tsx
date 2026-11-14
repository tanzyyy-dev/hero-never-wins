import React, { useId } from 'react'
import type { SymbolId } from '../engine'

interface ReelSymbolSvgProps {
  id: SymbolId
  className?: string
  isCenter?: boolean
}

export const ReelSymbolSvg: React.FC<ReelSymbolSvgProps> = ({ id, className = '', isCenter = false }) => {
  const uid = useId()
  // viewBox: 64 x 42 (リールドラムのセル枠に完璧にフィットするアスペクト比)
  switch (id) {
    case 'seven':
      return (
        <svg viewBox="0 0 64 42" className={`symbol-svg symbol-seven ${className}`}>
          <defs>
            <linearGradient id="sevenGoldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff5b8" />
              <stop offset="35%" stopColor="#ffd700" />
              <stop offset="70%" stopColor="#d48800" />
              <stop offset="100%" stopColor="#fff099" />
            </linearGradient>
            <linearGradient id="sevenRubyBody" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ff7085" />
              <stop offset="25%" stopColor="#ff1438" />
              <stop offset="65%" stopColor="#b30018" />
              <stop offset="100%" stopColor="#66000a" />
            </linearGradient>
            <filter id="sevenGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.8" />
            </filter>
          </defs>
          <g filter={isCenter ? 'url(#sevenGlow)' : undefined}>
            {/* Outer Gold Extrusion / Border */}
            <path
              d="M 12 7 L 54 7 L 36 37 L 22 37 L 35 15 L 12 15 Z"
              fill="url(#sevenGoldBorder)"
              stroke="#590008"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            {/* Inner Ruby Body */}
            <path
              d="M 14.5 9.5 L 50.5 9.5 L 34.5 35 L 24.5 35 L 37.5 17.5 L 14.5 17.5 Z"
              fill="url(#sevenRubyBody)"
            />
            {/* Top Gloss Highlight */}
            <path
              d="M 16 10.5 L 49 10.5 L 43 14 L 16 14 Z"
              fill="#ffffff"
              opacity="0.65"
            />
            {/* Slash Highlight */}
            <path
              d="M 37.5 18 L 35.5 34 L 33 34 L 35 18 Z"
              fill="#ffffff"
              opacity="0.35"
            />
          </g>
        </svg>
      )

    case 'bell':
      return (
        <svg viewBox="0 0 64 42" className={`symbol-svg symbol-bell ${className}`}>
          <defs>
            <linearGradient id="bellGoldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fff8cc" />
              <stop offset="25%" stopColor="#ffcc00" />
              <stop offset="70%" stopColor="#d48800" />
              <stop offset="100%" stopColor="#7a4b00" />
            </linearGradient>
            <linearGradient id="bellRibbonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff2244" />
              <stop offset="50%" stopColor="#ff6688" />
              <stop offset="100%" stopColor="#cc0022" />
            </linearGradient>
            <filter id="bellShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.75" />
            </filter>
          </defs>
          <g filter={isCenter ? 'url(#bellShadow)' : undefined}>
            {/* Clapper (下部の舌) */}
            <circle cx="32" cy="35.5" r="4.5" fill="#ffd700" stroke="#4a3000" strokeWidth="1" />
            {/* Bell Main Body */}
            <path
              d="M 32 6 C 26 6 22 10 21 18 C 20 25 15 28 14 31 L 50 31 C 49 28 44 25 43 18 C 42 10 38 6 32 6 Z"
              fill="url(#bellGoldGrad)"
              stroke="#4a3000"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            {/* Bell Bottom Rim */}
            <ellipse cx="32" cy="31" rx="18" ry="3.2" fill="url(#bellGoldGrad)" stroke="#4a3000" strokeWidth="1.2" />
            {/* Top Crown Ring */}
            <ellipse cx="32" cy="6" rx="4" ry="2.2" fill="#ffe57f" stroke="#4a3000" strokeWidth="1" />
            {/* Specular Highlight */}
            <path
              d="M 27 10 C 29 9 34 9 36 10 C 37 14 36 22 36 27 C 33 28 29 28 27 27 C 27 21 26 14 27 10 Z"
              fill="#ffffff"
              opacity="0.45"
            />
            {/* Red Bow Ribbon on Top */}
            <path
              d="M 32 10 C 29 7 24 8 26 12 C 28 15 32 12 32 12 C 32 12 36 15 38 12 C 40 8 35 7 32 10 Z"
              fill="url(#bellRibbonGrad)"
              stroke="#59000a"
              strokeWidth="0.8"
            />
          </g>
        </svg>
      )

    case 'replay':
      return (
        <svg viewBox="0 0 64 42" className={`symbol-svg symbol-replay ${className}`}>
          <defs>
            <linearGradient id={`${uid}-repPlateGrad`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#00f6ff" />
              <stop offset="35%" stopColor="#0099ff" />
              <stop offset="75%" stopColor="#0044aa" />
              <stop offset="100%" stopColor="#001a55" />
            </linearGradient>
            <linearGradient id={`${uid}-repTextGrad`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="45%" stopColor="#d9f6ff" />
              <stop offset="100%" stopColor="#80d4ff" />
            </linearGradient>
            <filter id={`${uid}-repGlow`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.8" />
            </filter>
          </defs>
          <g filter={isCenter ? `url(#${uid}-repGlow)` : undefined}>
            {/* Oval Base Plate */}
            <ellipse cx="32" cy="21" rx="27" ry="15" fill="#00183b" stroke="#00d9ff" strokeWidth="1.8" />
            <ellipse cx="32" cy="21" rx="24.5" ry="12.5" fill={`url(#${uid}-repPlateGrad)`} />
            {/* Upper Reflection */}
            <path
              d="M 12 18 C 16 11 48 11 52 18 C 45 14 19 14 12 18 Z"
              fill="#ffffff"
              opacity="0.45"
            />
            {/* "REPLAY" Text */}
            <text
              x="32"
              y="25.5"
              textAnchor="middle"
              fontFamily="Impact, 'Arial Black', sans-serif"
              fontSize="12.5"
              fontWeight="900"
              fontStyle="italic"
              letterSpacing="1"
              fill={`url(#${uid}-repTextGrad)`}
              stroke="#001a44"
              strokeWidth="0.8"
            >
              REPLAY
            </text>
            {/* Side Accent Stars */}
            <polygon points="10,21 11,23 13,23 11.5,24.5 12,26.5 10,25 8,26.5 8.5,24.5 7,23 9,23" fill="#ffffff" opacity="0.85" />
            <polygon points="54,21 55,23 57,23 55.5,24.5 56,26.5 54,25 52,26.5 52.5,24.5 51,23 53,23" fill="#ffffff" opacity="0.85" />
          </g>
        </svg>
      )

    case 'bar':
      return (
        <svg viewBox="0 0 64 42" className={`symbol-svg symbol-bar ${className}`}>
          <defs>
            <linearGradient id="barMetalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#404859" />
              <stop offset="30%" stopColor="#1e2430" />
              <stop offset="70%" stopColor="#0c1017" />
              <stop offset="100%" stopColor="#252d3d" />
            </linearGradient>
            <linearGradient id="barGoldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff2a3" />
              <stop offset="50%" stopColor="#d49b20" />
              <stop offset="100%" stopColor="#7a5508" />
            </linearGradient>
          </defs>
          <g>
            <rect x="7" y="9" width="50" height="24" rx="3.5" fill="url(#barGoldBorder)" stroke="#000" strokeWidth="1" />
            <rect x="9" y="11" width="46" height="20" rx="2.5" fill="url(#barMetalGrad)" />
            <text
              x="32"
              y="26.5"
              textAnchor="middle"
              fontFamily="Impact, 'Arial Black', sans-serif"
              fontSize="16.5"
              fontWeight="900"
              letterSpacing="3"
              fill="#ffffff"
              stroke="#0a0e14"
              strokeWidth="1"
            >
              BAR
            </text>
          </g>
        </svg>
      )

    case 'cherry':
      return (
        <svg viewBox="0 0 64 42" className={`symbol-svg symbol-cherry ${className}`}>
          <defs>
            <radialGradient id={`${uid}-cherryRed`} cx="35%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#ff8599" />
              <stop offset="40%" stopColor="#ff1438" />
              <stop offset="85%" stopColor="#a30018" />
              <stop offset="100%" stopColor="#4d000b" />
            </radialGradient>
            <linearGradient id={`${uid}-cherryStem`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#55cc44" />
              <stop offset="100%" stopColor="#226611" />
            </linearGradient>
          </defs>
          <g>
            {/* Green Stem */}
            <path d="M 32 8 C 30 14 24 22 23 27" stroke={`url(#${uid}-cherryStem)`} strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <path d="M 32 8 C 35 15 41 23 43 27" stroke={`url(#${uid}-cherryStem)`} strokeWidth="2.4" fill="none" strokeLinecap="round" />
            {/* Leaf */}
            <path d="M 32 8 C 38 6 44 9 43 14 C 37 13 33 10 32 8 Z" fill="#44bb33" stroke="#1b5e1b" strokeWidth="0.8" />
            {/* Left Cherry */}
            <circle cx="22" cy="28.5" r="8.5" fill={`url(#${uid}-cherryRed)`} stroke="#380007" strokeWidth="1" />
            <ellipse cx="19.5" cy="26" rx="2.5" ry="1.6" fill="#ffffff" opacity="0.75" />
            {/* Right Cherry */}
            <circle cx="42" cy="28.5" r="8.5" fill={`url(#${uid}-cherryRed)`} stroke="#380007" strokeWidth="1" />
            <ellipse cx="39.5" cy="26" rx="2.5" ry="1.6" fill="#ffffff" opacity="0.75" />
          </g>
        </svg>
      )

    case 'melon':
      return (
        <svg viewBox="0 0 64 42" className={`symbol-svg symbol-melon ${className}`}>
          <defs>
            <linearGradient id={`${uid}-melonRind`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#30c24c" />
              <stop offset="100%" stopColor="#0f5c20" />
            </linearGradient>
            <linearGradient id={`${uid}-melonFlesh`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ff5e6c" />
              <stop offset="100%" stopColor="#cc1829" />
            </linearGradient>
          </defs>
          <g>
            {/* Outer Rind (Half Moon Slice) */}
            <path d="M 12 16 C 14 32 50 32 52 16 Z" fill={`url(#${uid}-melonRind)`} stroke="#093813" strokeWidth="1.2" />
            <path d="M 14 17 C 16 30 48 30 50 17 Z" fill="#ebffea" />
            {/* Red Flesh */}
            <path d="M 16 18 C 18 28 46 28 48 18 Z" fill={`url(#${uid}-melonFlesh)`} stroke="#800a15" strokeWidth="0.8" />
            {/* Seeds */}
            <ellipse cx="25" cy="22" rx="1" ry="1.6" fill="#1c0507" />
            <ellipse cx="32" cy="24" rx="1" ry="1.6" fill="#1c0507" />
            <ellipse cx="39" cy="22" rx="1" ry="1.6" fill="#1c0507" />
          </g>
        </svg>
      )

    case 'blank':
    default:
      return (
        <svg viewBox="0 0 64 42" className={`symbol-svg symbol-star ${className}`}>
          <defs>
            <linearGradient id="starGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#bde8ff" />
              <stop offset="50%" stopColor="#47adff" />
              <stop offset="100%" stopColor="#1560bd" />
            </linearGradient>
          </defs>
          <g>
            <polygon
              points="32,8 35.5,17 45,17.5 37.5,23.5 40,32.5 32,27 24,32.5 26.5,23.5 19,17.5 28.5,17"
              fill="url(#starGrad)"
              stroke="#0a2a5e"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      )
  }
}

