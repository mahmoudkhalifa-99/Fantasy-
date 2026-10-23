import React from 'react';
import { KitPattern } from '../types';

interface JerseyKitProps {
  c1?: string;
  c2?: string;
  pat?: KitPattern;
  num?: number | null;
  kitUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  isCaptain?: boolean;
}

const SHIRT_PATH =
  'M30 10 L10 24 L2 46 L20 52 L24 44 L24 92 L76 92 L76 44 L80 52 L98 46 L90 24 L70 10 C66 18 58 22 50 22 C42 22 34 18 30 10 Z';

function getLuminance(hex?: string): number {
  if (!hex) return 0.5;
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return 0.5;
  const num = parseInt(match[1], 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export const JerseyKit: React.FC<JerseyKitProps> = ({
  c1 = '#16a34a',
  c2 = '#ffffff',
  pat = 'plain',
  num,
  kitUrl,
  size = 'md',
  isCaptain = false,
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
  }[size];

  if (kitUrl) {
    return (
      <div className={`relative ${sizeClasses} flex items-center justify-center shrink-0`}>
        <img
          src={kitUrl}
          alt="Jersey"
          className="w-full h-full object-contain filter drop-shadow-md"
        />
        {isCaptain && (
          <div className="absolute -top-1 -right-1 bg-amber-400 text-amber-950 text-xs font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-emerald-950 shadow-md">
            C
          </div>
        )}
      </div>
    );
  }

  const isLight = getLuminance(c1) > 0.55;
  const textColor = isLight ? '#111827' : '#ffffff';
  const strokeColor = isLight ? '#ffffff' : '#000000';

  // Unique clip id based on colors & pattern
  const clipId = `shirt-clip-${(c1 + c2 + pat).replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div className={`relative ${sizeClasses} flex items-center justify-center shrink-0 select-none`}>
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full filter drop-shadow-md overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={clipId}>
            <path d={SHIRT_PATH} />
          </clipPath>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          {/* Base primary color */}
          <rect width="100" height="100" fill={c1} />

          {/* Pattern overlay */}
          {pat === 'stripes' && (
            <>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <rect
                  key={i}
                  x={2 + i * 16.5}
                  y="0"
                  width="8.25"
                  height="100"
                  fill={c2}
                />
              ))}
            </>
          )}

          {pat === 'hoops' && (
            <>
              {[0, 1, 2, 3, 4].map((i) => (
                <rect
                  key={i}
                  x="0"
                  y={14 + i * 18}
                  width="100"
                  height="9"
                  fill={c2}
                />
              ))}
            </>
          )}

          {pat === 'halves' && (
            <rect x="50" y="0" width="50" height="100" fill={c2} />
          )}
        </g>

        {/* Shirt outline */}
        <path
          d={SHIRT_PATH}
          fill="none"
          stroke="rgba(0,0,0,0.4)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Collar detail */}
        <path
          d="M36 11 C40 19 45 22 50 22 C55 22 60 19 64 11"
          fill="none"
          stroke={c2}
          strokeWidth="3.5"
        />

        {/* Squad Number */}
        {num !== null && num !== undefined && (
          <text
            x="50"
            y="66"
            textAnchor="middle"
            fontFamily="Cairo, sans-serif"
            fontSize={String(num).length > 1 ? '30' : '36'}
            fontWeight="900"
            fill={textColor}
            stroke={strokeColor}
            strokeWidth="2.5"
            paintOrder="stroke"
          >
            {num}
          </text>
        )}
      </svg>

      {/* Captain badge */}
      {isCaptain && (
        <div className="absolute -top-1 -right-1 bg-amber-400 text-amber-950 text-xs font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-emerald-950 shadow-md">
          C
        </div>
      )}
    </div>
  );
};
