import React from 'react';
import { ChevronRight, ArrowRightLeft } from 'lucide-react';
import type { Player, Position, Team, TournamentConfig } from '../types';
import { PitchView } from './PitchView';
import { SQUAD_SIZE, SUPPORTED_FORMATIONS } from '../utils/fantasyScoring';

interface Props {
  cfg: TournamentConfig;
  players: Record<string, Player>;
  teams: Record<string, Team>;
  squadIds: string[];
  benchIds: string[];
  captainId: string;
  formation: string;
  isDraftDirty: boolean;
  bookingMode?: boolean;
  deadlineText?: string;
  onBack: () => void;
  onSaveSquad: () => void;
  onFormationChange: (f: string) => void;
  onSetCaptain: (id: string) => void;
  onRemovePlayer: (id: string) => void;
  onReplacePlayer: (id: string) => void;
  onSlotClick: (pos: Position) => void;
  onBenchSlotClick: (pos: Position, replacingId?: string) => void;
  onRemoveBench: (id: string) => void;
  onSwapBench: (starterId: string, benchId: string) => void;
  onOpenTransfers: () => void;
}

/** شاشة اختيار التشكيلة: تعديل بس (الخطة، الكابتن، الدكة، التبديل). النقاط في شاشة النقاط، والانتقالات في شاشتها. */
export const PLPickTeamView: React.FC<Props> = ({
  cfg, players, teams, squadIds, benchIds, captainId, formation, isDraftDirty, bookingMode = false, deadlineText,
  onBack, onSaveSquad, onFormationChange, onSetCaptain, onRemovePlayer, onReplacePlayer, onSlotClick, onBenchSlotClick, onRemoveBench, onSwapBench, onOpenTransfers,
}) => {
  const totalCost = [...squadIds, ...benchIds].reduce((sum, pid) => sum + (Number(players[pid]?.price) || 0), 0);
  const remaining = Math.max(0, cfg.budget - totalCost);

  return (
    <div className="max-w-md mx-auto px-3.5 pt-3 pb-28 space-y-3 animate-in fade-in duration-200" dir="rtl">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-gray-100 dark:bg-emerald-950 border border-gray-200 dark:border-emerald-800 flex items-center justify-center text-gray-800 dark:text-emerald-200 cursor-pointer"
          aria-label="رجوع"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black text-gray-900 dark:text-white font-['Lalezar',sans-serif] truncate">اختيار التشكيلة</h2>
          <p className="text-[11px] text-gray-500 dark:text-emerald-400 truncate">
            {bookingMode ? 'تشكيلة الحجز' : `تشكيلة الجولة ${cfg.locked ? cfg.round + 1 : cfg.round}`}
            {deadlineText ? ` • ${deadlineText}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 bg-[#15251c] p-3 rounded-2xl border border-emerald-800">
        <div className="text-xs">
          <span className="text-emerald-300">اللاعبين: </span>
          <strong className="text-white font-mono">{squadIds.length}/{SQUAD_SIZE}</strong>
          <span className="mx-2">•</span>
          <span className="text-emerald-300">المتبقي: </span>
          <strong className="text-amber-300 font-mono">{remaining.toFixed(1)}م</strong>
        </div>
        <button
          type="button"
          onClick={onSaveSquad}
          disabled={!isDraftDirty}
          className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-xs rounded-xl shadow transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isDraftDirty ? 'حفظ التشكيلة' : 'محفوظة ✓'}
        </button>
      </div>

      <div>
        <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-300 mb-1">الخطة (دفاع-وسط-هجوم)</div>
        <div className="flex flex-wrap gap-1.5">
          {SUPPORTED_FORMATIONS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFormationChange(f)}
              className={`px-2.5 py-1 rounded-lg text-xs font-black font-mono transition-colors ${
                f === formation ? 'bg-amber-400 text-amber-950' : 'bg-emerald-900/60 text-emerald-200 hover:bg-emerald-800'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <PitchView
        squadIds={squadIds}
        benchIds={benchIds}
        captainId={captainId}
        formation={formation}
        players={players}
        teams={teams}
        onSlotClick={onSlotClick}
        onRemovePlayer={onRemovePlayer}
        onReplacePlayer={onReplacePlayer}
        onSetCaptain={onSetCaptain}
        onBenchSlotClick={onBenchSlotClick}
        onRemoveBench={onRemoveBench}
        onSwapBench={onSwapBench}
      />

      <button
        type="button"
        onClick={onOpenTransfers}
        className="w-full py-3 px-4 bg-[#102a45]/90 hover:bg-[#102a45] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 border border-white/20 cursor-pointer"
      >
        <ArrowRightLeft className="w-5 h-5 text-emerald-300" />
        <span>⇄ سوق الانتقالات (Transfers)</span>
      </button>
    </div>
  );
};
