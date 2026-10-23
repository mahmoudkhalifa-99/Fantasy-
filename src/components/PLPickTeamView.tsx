import React, { useState } from 'react';
import type { Match, Player, Position, Team, TournamentConfig } from '../types';
import { BenchPanel, BoardCard, EmptySlot, GreenPitch, InfoCard, PitchRow, ScreenShell, StatusLine, playerFixture } from './FantasyBoard';
import { SQUAD_SIZE, SUPPORTED_FORMATIONS, POSITIONS_SHORT, POS_ORDER, parseFormation } from '../utils/fantasyScoring';
import { ArrowRightLeft } from 'lucide-react';

interface Props {
  cfg: TournamentConfig;
  players: Record<string, Player>;
  teams: Record<string, Team>;
  matches: Record<string, Match>;
  squadIds: string[];
  benchIds: string[];
  captainId: string;
  viceId: string;
  formation: string;
  isDraftDirty: boolean;
  editRound: number;
  bookingMode?: boolean;
  deadlineText?: string;
  onBack: () => void;
  onSaveSquad: () => void;
  onFormationChange: (f: string) => void;
  onSetCaptain: (id: string) => void;
  onSetVice: (id: string) => void;
  onSlotClick: (pos: Position) => void;
  onBenchSlotClick: (pos: Position, replacingId?: string) => void;
  onRemoveBench: (id: string) => void;
  onSwapBench: (starterId: string, benchId: string) => void;
  onOpenTransfers: () => void;
}

/** شاشة اختيار التشكيلة: الخطة + التبديل بين الأساسي والاحتياطي + الكابتن. (تغيير لاعب بلاعب من بره من شاشة Transfers) */
export const PLPickTeamView: React.FC<Props> = ({
  cfg, players, teams, matches, squadIds, benchIds, captainId, viceId, formation, isDraftDirty, editRound, bookingMode = false, deadlineText,
  onBack, onSaveSquad, onFormationChange, onSetCaptain, onSetVice, onSlotClick, onBenchSlotClick, onRemoveBench, onSwapBench, onOpenTransfers,
}) => {
  const [sel, setSel] = useState<string | null>(null);
  const isBench = (id: string) => benchIds.includes(id);

  const totalCost = [...squadIds, ...benchIds].reduce((sum, pid) => sum + (Number(players[pid]?.price) || 0), 0);
  const remaining = Math.max(0, cfg.budget - totalCost);

  const canSwap = (a: string | null, b: string) => {
    if (!a || a === b) return false;
    const pa = players[a];
    const pb = players[b];
    return !!pa && !!pb && pa.pos === pb.pos && pa.pos !== 'GK' && isBench(a) !== isBench(b);
  };

  const onCard = (id: string) => {
    if (sel && canSwap(sel, id)) {
      if (isBench(sel)) onSwapBench(id, sel);
      else onSwapBench(sel, id);
      setSel(null);
    } else {
      setSel(sel === id ? null : id);
    }
  };

  const reqCounts = parseFormation(formation);
  const grouped: Record<Position, string[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  squadIds.forEach((id) => {
    const p = players[id];
    if (p) grouped[p.pos].push(id);
  });

  const card = (id: string) => {
    const p = players[id];
    if (!p) return null;
    return (
      <BoardCard
        key={id}
        player={p}
        team={teams[p.teamId]}
        chip={POSITIONS_SHORT[p.pos]}
        chipTone="pos"
        subText={playerFixture(p, matches, teams)}
        isCaptain={id === captainId}
        isVice={id === viceId}
        selected={sel === id}
        highlight={canSwap(sel, id)}
        onClick={() => onCard(id)}
      />
    );
  };

  const selPlayer = sel ? players[sel] : undefined;
  const selIsStarter = !!sel && !isBench(sel);
  const hasCounterpart = !!selPlayer && selPlayer.pos !== 'GK' && (selIsStarter ? benchIds : squadIds).some((id) => players[id]?.pos === selPlayer.pos);

  const benchSlots: Position[] = ['DEF', 'MID', 'FWD'];

  return (
    <ScreenShell title="Pick Team" onBack={onBack}>
      <StatusLine>
        <span>{bookingMode ? 'اختيار تشكيلة الحجز' : `اختيار تشكيلة الجولة ${editRound}`}</span>
        <span className="mx-2">•</span>
        <span>{deadlineText ?? (cfg.locked ? 'الجولة الحالية اتقفلت' : 'التعديل مفتوح')}</span>
      </StatusLine>

      <InfoCard className="grid grid-cols-3 gap-1 text-center items-center">
        <div>
          <div className="text-base font-black text-gray-900 dark:text-white font-mono">{squadIds.length}/{SQUAD_SIZE}</div>
          <div className="text-[10px] text-gray-500 dark:text-emerald-400 font-bold leading-tight">اللاعبين</div>
        </div>
        <div className="flex flex-col items-center">
          <div className="bg-emerald-600 text-white text-[11px] font-mono font-black px-2.5 py-0.5 rounded-full shadow-sm">{remaining.toFixed(1)} م</div>
          <div className="text-[10px] text-gray-500 dark:text-emerald-400 font-bold leading-tight mt-0.5">الميزانية</div>
        </div>
        <button
          type="button"
          onClick={onSaveSquad}
          disabled={!isDraftDirty}
          className="mx-auto px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-xs rounded-xl shadow transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isDraftDirty ? 'حفظ التشكيلة' : 'محفوظة ✓'}
        </button>
      </InfoCard>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {SUPPORTED_FORMATIONS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onFormationChange(f)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-black font-mono border transition-colors ${
              f === formation
                ? 'bg-white dark:bg-emerald-700 text-gray-900 dark:text-white border-gray-300 dark:border-emerald-500 shadow-sm'
                : 'bg-gray-200 dark:bg-[#15251c] text-gray-600 dark:text-emerald-300 border-gray-300 dark:border-emerald-800'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <GreenPitch>
        {POS_ORDER.map((pos) => {
          const filled = grouped[pos];
          const empty = Math.max(0, reqCounts[pos] - filled.length);
          return (
            <PitchRow key={pos}>
              {filled.map((id) => card(id))}
              {Array.from({ length: empty }).map((_, i) => (
                <EmptySlot key={`e-${pos}-${i}`} pos={pos} onClick={() => onSlotClick(pos)} />
              ))}
            </PitchRow>
          );
        })}
      </GreenPitch>

      <BenchPanel>
        {benchSlots.map((pos) => {
          const id = benchIds.find((b) => players[b]?.pos === pos);
          return id ? card(id) : <EmptySlot key={`b-${pos}`} pos={pos} onClick={() => onBenchSlotClick(pos)} />;
        })}
      </BenchPanel>

      {/* شريط الإجراءات للاعب المحدد */}
      <InfoCard className="space-y-2">
        {selPlayer ? (
          <>
            <div className="text-xs font-black text-gray-900 dark:text-white text-center">
              {selPlayer.name} ({POSITIONS_SHORT[selPlayer.pos]})
            </div>
            <p className="text-[11px] text-center font-bold text-violet-600 dark:text-violet-300">
              {hasCounterpart
                ? `دوس على ${selIsStarter ? 'الاحتياطي' : 'الأساسي'} المتلمّع (نفس المركز) عشان تبدّلهم`
                : selPlayer.pos === 'GK'
                ? 'الحارس مالوش بديل في الدكة'
                : `مفيش ${selIsStarter ? 'احتياطي' : 'أساسي'} بنفس المركز تبدّل معاه`}
            </p>
            <div className="flex gap-2 justify-center">
              {selIsStarter && sel !== captainId && (
                <button
                  type="button"
                  onClick={() => { onSetCaptain(sel!); setSel(null); }}
                  className="px-3 py-1.5 rounded-xl bg-amber-400 text-amber-950 text-xs font-black"
                >
                  👑 خليه كابتن
                </button>
              )}
              {selIsStarter && sel !== captainId && sel !== viceId && (
                <button
                  type="button"
                  onClick={() => { onSetVice(sel!); setSel(null); }}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-900 text-xs font-black"
                >
                  V نائب الكابتن
                </button>
              )}
              {!selIsStarter && (
                <button
                  type="button"
                  onClick={() => { onRemoveBench(sel!); setSel(null); }}
                  className="px-3 py-1.5 rounded-xl bg-red-600/90 text-white text-xs font-black"
                >
                  شيل من الدكة
                </button>
              )}
              <button type="button" onClick={() => setSel(null)} className="px-3 py-1.5 rounded-xl bg-gray-200 dark:bg-emerald-900 text-gray-800 dark:text-emerald-100 text-xs font-black">
                إلغاء
              </button>
            </div>
          </>
        ) : (
          <p className="text-[11px] text-center font-bold text-gray-600 dark:text-emerald-300">
            دوس على لاعب أساسي ثم على احتياطي بنفس مركزه عشان تبدّلهم، أو اختار لاعب أساسي عشان تخليه كابتن (C) أو نائب الكابتن (V). لو الكابتن ما لعبش، الـ x2 بتروح للنائب.
          </p>
        )}
      </InfoCard>

      <button
        type="button"
        onClick={onOpenTransfers}
        className="w-full py-3 px-4 bg-[#102a45]/90 hover:bg-[#102a45] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 border border-white/20"
      >
        <ArrowRightLeft className="w-5 h-5 text-emerald-300" />
        <span>تغيير لاعب بلاعب من بره: Transfers</span>
      </button>
    </ScreenShell>
  );
};
