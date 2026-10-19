import React from 'react';
import { Player, Team, Position } from '../types';
import { JerseyKit } from './JerseyKit';
import { POSITIONS_SHORT, BENCH_POSITIONS, parseFormation, calculatePlayerRoundPoints } from '../utils/fantasyScoring';
import { Crown, Plus, Trash2, ShieldAlert, ArrowRightLeft } from 'lucide-react';

interface PitchViewProps {
  squadIds: string[];
  captainId: string;
  formation: string;
  players: Record<string, Player>;
  teams: Record<string, Team>;
  roundStats?: Record<string, any>;
  showPoints?: boolean;
  isReadOnly?: boolean;
  onSlotClick?: (pos: Position) => void;
  onRemovePlayer?: (playerId: string) => void;
  onReplacePlayer?: (playerId: string) => void;
  ptsMap?: Record<string, { round: number; total: number }>; // نقاط الجولة الحالية والإجمالي لكل لاعب
  onSetCaptain?: (playerId: string) => void;
  onPlayerClick?: (player: Player) => void;
  benchIds?: string[]; // الدكة الاحتياطي (مدافع + وسط + مهاجم)
  onBenchSlotClick?: (pos: Position, replacingId?: string) => void;
  onRemoveBench?: (playerId: string) => void;
}

export const PitchView: React.FC<PitchViewProps> = ({
  squadIds,
  captainId,
  formation,
  players,
  teams,
  roundStats,
  showPoints = false,
  isReadOnly = false,
  onSlotClick,
  onRemovePlayer,
  onReplacePlayer,
  ptsMap,
  onSetCaptain,
  onPlayerClick,
  benchIds = [],
  onBenchSlotClick,
  onRemoveBench,
}) => {
  const reqCounts = parseFormation(formation);

  // Group squad players by position
  const grouped: Record<Position, Player[]> = {
    FWD: [],
    MID: [],
    DEF: [],
    GK: [],
  };

  squadIds.forEach((id) => {
    const p = players[id];
    if (p && grouped[p.pos]) {
      grouped[p.pos].push(p);
    }
  });

  const renderRow = (pos: Position, requiredCount: number) => {
    const filled = grouped[pos] || [];
    const emptyCount = Math.max(0, requiredCount - filled.length);

    return (
      <div className="flex justify-center items-center gap-2 sm:gap-4 z-10 w-full min-h-[95px] sm:min-h-[110px]">
        {filled.map((player) => {
          const team = teams[player.teamId];
          const isCaptain = player.id === captainId;
          const pts = showPoints && roundStats ? calculatePlayerRoundPoints(player, roundStats[player.id]) : null;
          const displayPts = pts !== null ? (isCaptain ? pts * 2 : pts) : null;

          return (
            <div
              key={player.id}
              onClick={() => onPlayerClick && onPlayerClick(player)}
              className="group relative flex flex-col items-center w-[84px] sm:w-[98px] transition-transform duration-150 hover:scale-105 cursor-pointer"
            >
              {/* Captain quick-action floating badge */}
              {!isReadOnly && onSetCaptain && (
                <button
                  type="button"
                  title={isCaptain ? 'الكابتن الحالي (x2)' : 'اجعله كابتن (x2)'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetCaptain(player.id);
                  }}
                  className={`absolute -top-2 left-1 z-20 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shadow-lg transition-all ${
                    isCaptain
                      ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-300'
                      : 'bg-black/60 text-white/80 hover:bg-amber-400 hover:text-black opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
                  }`}
                >
                  <Crown className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Remove player quick button */}
              {!isReadOnly && onRemovePlayer && (
                <button
                  type="button"
                  title="إزالة من التشكيلة"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemovePlayer(player.id);
                  }}
                  className="absolute -top-2 right-1 z-20 w-6 h-6 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-red-700"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}

              {/* Replace player quick button */}
              {!isReadOnly && onReplacePlayer && (
                <button
                  type="button"
                  title="تبديل اللاعب"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReplacePlayer(player.id);
                  }}
                  className="absolute top-5 -right-1 z-20 w-6 h-6 rounded-full bg-sky-600/90 text-white flex items-center justify-center shadow-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-sky-700"
                >
                  <ArrowRightLeft className="w-3 h-3" />
                </button>
              )}

              {/* Jersey graphic */}
              <div className="relative py-1">
                <JerseyKit
                  c1={team?.c1}
                  c2={team?.c2}
                  pat={team?.pat}
                  num={player.num}
                  kitUrl={team?.kitUrl}
                  isCaptain={isCaptain}
                  size="md"
                />
              </div>

              {/* Player Tag */}
              <div className="w-full bg-emerald-950/95 border border-emerald-600/40 backdrop-blur-sm rounded-lg overflow-hidden shadow-lg text-center mt-0.5">
                <div className="px-1 py-0.5 text-[11px] sm:text-xs font-bold text-white truncate leading-tight">
                  {player.name}
                </div>
                <div className="bg-emerald-900/90 px-1 py-0.5 text-[10px] text-emerald-200 flex items-center justify-between font-semibold border-t border-emerald-800/60">
                  <span className="truncate max-w-[50px]">{team?.name || 'فريق'}</span>
                  {showPoints ? (
                    <span className="font-extrabold text-amber-300">
                      {displayPts} {isCaptain ? '(x2)' : 'ن'}
                    </span>
                  ) : (
                    <span className="font-mono text-emerald-300">{player.price}م</span>
                  )}
                </div>
                {ptsMap && ptsMap[player.id] && (
                  <div className="bg-amber-400 text-amber-950 px-1 py-0.5 text-[10px] flex items-center justify-between font-black border-t border-amber-500/60">
                    <span title="نقاط الجولة الحالية">ج {isCaptain ? ptsMap[player.id].round * 2 : ptsMap[player.id].round}</span>
                    <span title="الإجمالي">إ {ptsMap[player.id].total}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Empty slots placeholders */}
        {!isReadOnly &&
          Array.from({ length: emptyCount }).map((_, idx) => (
            <button
              key={`empty-${pos}-${idx}`}
              type="button"
              onClick={() => onSlotClick && onSlotClick(pos)}
              className="flex flex-col items-center justify-center w-[78px] sm:w-[92px] h-[95px] sm:h-[105px] rounded-xl border-2 border-dashed border-white/40 hover:border-amber-400 bg-white/5 hover:bg-white/10 transition-all text-white/80 hover:text-white group/slot p-2"
              title={`إضافة ${POSITIONS_SHORT[pos]}`}
            >
              <div className="w-9 h-9 rounded-full bg-white/10 group-hover/slot:bg-amber-400/20 flex items-center justify-center mb-1 text-white/70 group-hover/slot:text-amber-300">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-white/90 group-hover/slot:text-amber-300">
                + {POSITIONS_SHORT[pos]}
              </span>
            </button>
          ))}
      </div>
    );
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border-2 border-emerald-500/30 shadow-2xl bg-gradient-to-b from-[#14532d] via-[#166534] to-[#0f3d23]">
      {/* Turf striped texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 36px, transparent 36px, transparent 72px)',
        }}
      />

      {/* Football Field Markings */}
      <div className="absolute inset-3 border-2 border-white/30 rounded-xl pointer-events-none">
        {/* Halfway line */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/30 -translate-y-1/2" />
        {/* Center circle */}
        <div className="absolute top-1/2 left-1/2 w-28 h-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/30" />
        {/* Center spot */}
        <div className="absolute top-1/2 left-1/2 w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/50" />

        {/* Top Goal Box */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-44 h-14 border-b-2 border-x-2 border-white/30 rounded-b-md" />
        {/* Top Penalty Arc */}
        <div className="absolute top-14 left-1/2 -translate-x-1/2 w-20 h-8 border-b-2 border-white/20 rounded-b-full" />

        {/* Bottom Goal Box */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-44 h-14 border-t-2 border-x-2 border-white/30 rounded-t-md" />
        {/* Bottom Penalty Arc */}
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-20 h-8 border-t-2 border-white/20 rounded-t-full" />
      </div>

      {/* Squad Formation Rows */}
      <div className="relative py-6 px-3 flex flex-col justify-between items-center gap-4 sm:gap-6 min-h-[480px]">
        {/* 1. Attackers (FWD) */}
        {renderRow('FWD', reqCounts.FWD)}

        {/* 2. Midfielders (MID) */}
        {renderRow('MID', reqCounts.MID)}

        {/* 3. Defenders (DEF) */}
        {renderRow('DEF', reqCounts.DEF)}

        {/* 4. Goalkeeper (GK) */}
        {renderRow('GK', reqCounts.GK)}
      </div>

      {/* الدكة الاحتياطي: مدافع + وسط + مهاجم */}
      {(!isReadOnly || benchIds.length > 0) && (
        <div className="relative bg-emerald-950/70 border-t-2 border-emerald-500/30 px-3 py-3">
          <div className="text-center text-xs font-black text-emerald-200 mb-2">الاحتياطي</div>
          <div className="flex justify-center items-start gap-2 sm:gap-4">
            {BENCH_POSITIONS.map((pos) => {
              const player = benchIds.map((id) => players[id]).find((p) => p && p.pos === pos);
              if (!player) {
                if (isReadOnly) return null;
                return (
                  <button
                    key={`bench-empty-${pos}`}
                    type="button"
                    onClick={() => onBenchSlotClick && onBenchSlotClick(pos)}
                    className="flex flex-col items-center justify-center w-[84px] sm:w-[98px] h-[95px] sm:h-[105px] rounded-xl border-2 border-dashed border-white/40 hover:border-amber-400 bg-white/5 hover:bg-white/10 transition-all text-white/80 hover:text-white p-2"
                    title={`إضافة ${POSITIONS_SHORT[pos]} احتياطي`}
                  >
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center mb-1">
                      <Plus className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold">+ {POSITIONS_SHORT[pos]}</span>
                  </button>
                );
              }
              const team = teams[player.teamId];
              const pts = showPoints && roundStats ? calculatePlayerRoundPoints(player, roundStats[player.id]) : null;
              return (
                <div
                  key={player.id}
                  onClick={() => onPlayerClick && onPlayerClick(player)}
                  className="group relative flex flex-col items-center w-[84px] sm:w-[98px] cursor-pointer"
                >
                  <div className="text-[10px] font-black text-emerald-300 mb-0.5">{POSITIONS_SHORT[pos]}</div>
                  {!isReadOnly && onRemoveBench && (
                    <button
                      type="button"
                      title="إزالة من الدكة"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveBench(player.id);
                      }}
                      className="absolute top-3 right-1 z-20 w-6 h-6 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg hover:bg-red-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  {!isReadOnly && onBenchSlotClick && (
                    <button
                      type="button"
                      title="تبديل اللاعب"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBenchSlotClick(pos, player.id);
                      }}
                      className="absolute top-9 -right-1 z-20 w-6 h-6 rounded-full bg-sky-600/90 text-white flex items-center justify-center shadow-lg hover:bg-sky-700"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                    </button>
                  )}
                  <div className="relative py-1">
                    <JerseyKit c1={team?.c1} c2={team?.c2} pat={team?.pat} num={player.num} kitUrl={team?.kitUrl} size="md" />
                  </div>
                  <div className="w-full bg-emerald-950/95 border border-emerald-600/40 rounded-lg overflow-hidden shadow-lg text-center mt-0.5">
                    <div className="px-1 py-0.5 text-[11px] sm:text-xs font-bold text-white truncate leading-tight">{player.name}</div>
                    <div className="bg-emerald-900/90 px-1 py-0.5 text-[10px] text-emerald-200 flex items-center justify-between font-semibold border-t border-emerald-800/60">
                      <span className="truncate max-w-[50px]">{team?.name || 'فريق'}</span>
                      {pts !== null ? (
                        <span className="font-extrabold text-amber-300">{pts} ن</span>
                      ) : (
                        <span className="font-mono text-emerald-300">{player.price}م</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-center text-[10px] text-emerald-300/70 mt-2">لو أساسي في نفس المركز مالعبش، الاحتياطي بياخد مكانه تلقائي</p>
        </div>
      )}
    </div>
  );
};
