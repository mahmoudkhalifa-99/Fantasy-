import React from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import type { Match, Player, Position, Team } from '../types';
import { JerseyKit } from './JerseyKit';
import { POSITIONS_SHORT } from '../utils/fantasyScoring';

// مكونات مشتركة بين شاشات: النقاط، اختيار التشكيلة، الانتقالات (نفس الشكل والملعب)

export const ScreenTopBar: React.FC<{ title: string; onBack: () => void }> = ({ title, onBack }) => (
  <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#04100c]/95 backdrop-blur-md border-b border-gray-200 dark:border-emerald-900/60 px-4 py-3 flex items-center justify-between">
    <button
      type="button"
      onClick={onBack}
      className="w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-emerald-900/40 flex items-center justify-center text-gray-800 dark:text-white transition-colors"
      aria-label="رجوع"
    >
      <ArrowLeft className="w-5 h-5" />
    </button>
    <h1 className="text-lg font-black text-gray-900 dark:text-white font-['Lalezar',sans-serif]">{title}</h1>
    <div className="w-8 h-8" />
  </div>
);

export const ScreenShell: React.FC<{ title: string; onBack: () => void; children: React.ReactNode }> = ({ title, onBack, children }) => (
  <div className="min-h-screen bg-[#f8faf9] dark:bg-[#04100c] text-gray-900 dark:text-[#e8f1ea] pb-28 font-['Cairo',sans-serif] animate-in fade-in duration-200" dir="rtl">
    <ScreenTopBar title={title} onBack={onBack} />
    <div className="max-w-md mx-auto px-3.5 pt-2.5 space-y-3">{children}</div>
  </div>
);

export const StatusLine: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-center text-xs font-bold text-gray-700 dark:text-emerald-300">{children}</div>
);

export const InfoCard: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`bg-white dark:bg-[#15251c] border border-gray-200 dark:border-emerald-900/60 rounded-2xl p-3 shadow-md ${className}`}>{children}</div>
);

/** الملعب الأخضر بنفس شكل شاشة الانتقالات */
export const GreenPitch: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative w-full rounded-3xl overflow-hidden border-2 border-emerald-500/40 shadow-2xl bg-gradient-to-b from-[#1b8a51] via-[#167041] to-[#0f4e2c]">
    <div
      className="absolute inset-0 pointer-events-none opacity-25"
      style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 32px, transparent 32px, transparent 64px)' }}
    />
    <div className="relative z-20 flex items-center justify-between px-3 pt-2">
      <div className="bg-[#00ff87] text-black font-black text-[10px] px-3 py-1 rounded-md shadow-md uppercase tracking-wider flex items-center gap-1">
        <span>🦁</span>
        <span>Fantasy</span>
      </div>
      <div className="w-28 h-4 border-b-2 border-x-2 border-white/60 rounded-b-md" />
      <div className="bg-[#963cff] text-white font-black text-[10px] px-3 py-1 rounded-md shadow-md uppercase tracking-wider flex items-center gap-1">
        <span>🦁</span>
        <span>Fantasy</span>
      </div>
    </div>
    <div className="absolute inset-2 top-8 border-2 border-white/35 rounded-2xl pointer-events-none">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-44 h-16 border-b-2 border-x-2 border-white/30 rounded-b-md" />
      <div className="absolute top-11 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white/50" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-32 h-32 rounded-full border-2 border-white/30" />
    </div>
    <div className="relative py-4 px-2 space-y-3 min-h-[460px] flex flex-col justify-around">{children}</div>
  </div>
);

export const PitchRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex justify-center items-center gap-2 sm:gap-3 z-10 w-full min-h-[95px]">{children}</div>
);

/** الدكة تحت الملعب */
export const BenchPanel: React.FC<{ title?: string; children: React.ReactNode }> = ({ title = 'الاحتياطي', children }) => (
  <div className="rounded-3xl border-2 border-emerald-500/30 bg-gradient-to-b from-[#0f4e2c] to-[#0b3a21] px-2 py-3">
    <div className="text-center text-xs font-black text-emerald-100 mb-2">{title}</div>
    <div className="flex justify-center items-start gap-2 sm:gap-3">{children}</div>
  </div>
);

export const EmptySlot: React.FC<{ pos: Position; onClick?: () => void }> = ({ pos, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex flex-col items-center justify-center w-[70px] sm:w-[86px] h-[95px] rounded-xl border-2 border-dashed border-white/40 hover:border-amber-400 bg-white/10 hover:bg-white/20 transition-all text-white p-1"
  >
    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center mb-1">
      <Plus className="w-4 h-4 text-white" />
    </div>
    <span className="text-[10px] font-bold text-white leading-tight">+ {POSITIONS_SHORT[pos]}</span>
  </button>
);

/** مباراة الفريق الجاية (زي شاشة الانتقالات): "الفريق (H)" أو TBD */
export function playerFixture(p: Player, matches: Record<string, Match>, teams: Record<string, Team>): string {
  const next = Object.values(matches).find((m) => (m.teamAId === p.teamId || m.teamBId === p.teamId) && m.status !== 'finished');
  if (!next) return 'TBD';
  const isHome = next.teamAId === p.teamId;
  const opp = teams[isHome ? next.teamBId : next.teamAId];
  return `${opp ? opp.name.slice(0, 4) : 'OPP'} (${isHome ? 'H' : 'A'})`;
}

const CHIP: Record<string, string> = {
  price: 'bg-[#102a1d] text-white border-emerald-500/40 text-[10px]',
  pos: 'bg-[#102a1d] text-emerald-200 border-emerald-500/40 text-[10px]',
  points: 'bg-amber-400 text-amber-950 border-amber-500 text-[12px] font-black',
  muted: 'bg-gray-700/70 text-gray-200 border-gray-500/40 text-[10px]',
};

interface CardProps {
  player: Player;
  team?: Team;
  chip?: React.ReactNode; // فوق القميص
  chipTone?: 'price' | 'pos' | 'points' | 'muted';
  subText?: string; // تحت الاسم (اختياري)
  isCaptain?: boolean;
  selected?: boolean;
  highlight?: boolean; // لاعب ينفع يتبدّل معاه
  dim?: boolean;
  onClick?: () => void;
}

/** كارت اللاعب بنفس شكل شاشة الانتقالات */
export const BoardCard: React.FC<CardProps> = ({ player, team, chip, chipTone = 'price', subText, isCaptain, selected, highlight, dim, onClick }) => (
  <div
    onClick={onClick}
    className={`flex flex-col items-center select-none w-[70px] sm:w-[86px] transition-transform ${onClick ? 'cursor-pointer active:scale-95' : ''} ${dim ? 'opacity-45' : ''} ${
      selected ? 'ring-4 ring-amber-300 rounded-xl' : highlight ? 'ring-4 ring-violet-300 rounded-xl animate-pulse' : ''
    }`}
  >
    {chip !== undefined && chip !== null && (
      <div className={`${CHIP[chipTone]} font-mono font-bold px-2 py-0.5 rounded-full border shadow-sm mb-0.5`}>{chip}</div>
    )}
    <div className="relative py-0.5">
      <JerseyKit c1={team?.c1} c2={team?.c2} pat={team?.pat} num={player.num} kitUrl={team?.kitUrl} isCaptain={isCaptain} size="md" />
    </div>
    <div className="w-full bg-white dark:bg-[#0f1f16] rounded-md shadow-md border border-gray-200 dark:border-emerald-800/80 text-center overflow-hidden mt-0.5">
      <div className="px-1 py-0.5 text-[11px] font-extrabold text-gray-900 dark:text-white truncate">{player.name}</div>
      {subText && (
        <div className="bg-gray-100 dark:bg-emerald-950/80 px-1 py-0.5 text-[9.5px] font-mono text-gray-600 dark:text-emerald-300 border-t border-gray-200 dark:border-emerald-800/60 truncate uppercase">
          {subText}
        </div>
      )}
    </div>
  </div>
);
