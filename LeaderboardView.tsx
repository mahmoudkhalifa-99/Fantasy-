import React, { useState } from 'react';
import { Entry, Player, Team, TournamentConfig } from '../types';
import { calculateSquadRoundPoints, roundPenalty } from '../utils/fantasyScoring';
import { Trophy, Medal, Crown, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { JerseyKit } from './JerseyKit';

interface LeaderboardViewProps {
  entries: Record<string, Entry>;
  players: Record<string, Player>;
  teams: Record<string, Team>;
  cfg: TournamentConfig;
  allRoundStats: Record<number, { p: Record<string, any> }>;
  currentUserId: string;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  entries,
  players,
  teams,
  cfg,
  allRoundStats,
  currentUserId,
}) => {
  const [roundFilter, setRoundFilter] = useState<'total' | number>('total');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  const statRoundNumbers = Object.keys(allRoundStats)
    .map(Number)
    .sort((a, b) => a - b);

  // Compute points for each entry
  const rows = Object.values(entries).map((entry) => {
    // Total tournament points
    let totalScore = 0;
    const roundScores: Record<number, number> = {};

    for (const rNum of statRoundNumbers) {
      // Find squad for this round (or fallback to latest preceding round)
      let squadForRound = entry.rounds[rNum];
      if (!squadForRound) {
        for (let i = rNum - 1; i >= 1; i--) {
          if (entry.rounds[i]) {
            squadForRound = entry.rounds[i];
            break;
          }
        }
      }

      if (squadForRound) {
        const roundPts = calculateSquadRoundPoints(
          squadForRound.ids,
          squadForRound.cap,
          players,
          allRoundStats[rNum]?.p || {},
          squadForRound.bench || []
        ) - roundPenalty(entry.rounds, rNum);
        roundScores[rNum] = roundPts;
        totalScore += roundPts;
      } else {
        roundScores[rNum] = 0;
      }
    }

    const currentDisplayScore =
      roundFilter === 'total' ? totalScore : roundScores[Number(roundFilter)] || 0;

    return {
      entry,
      totalScore,
      roundScores,
      currentDisplayScore,
    };
  });

  // Sort by score descending
  rows.sort((a, b) => {
    if (b.currentDisplayScore !== a.currentDisplayScore) {
      return b.currentDisplayScore - a.currentDisplayScore;
    }
    return a.entry.name.localeCompare(b.entry.name, 'ar');
  });

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="bg-gradient-to-r from-[#173824] to-[#0e2417] border border-emerald-600/40 rounded-2xl p-4 sm:p-5 shadow-xl flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-400 text-amber-950 flex items-center justify-center font-black shadow-lg">
            <Trophy className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white font-['Lalezar',sans-serif]">
              جدول ترتيب دورة {cfg.name}
            </h2>
            <p className="text-xs text-emerald-300">
              المشاركون: {rows.length} مدرب • المنافسة على جائزة بطل الحارة الكبرى
            </p>
          </div>
        </div>

        {/* Round switch filter */}
        <div className="flex items-center gap-1.5 bg-[#0a140f] p-1 rounded-xl border border-emerald-800/60 text-xs">
          <button
            type="button"
            onClick={() => setRoundFilter('total')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              roundFilter === 'total'
                ? 'bg-amber-400 text-amber-950 shadow-sm'
                : 'text-emerald-300 hover:text-white'
            }`}
          >
            المجموع الكلي
          </button>
          {statRoundNumbers.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoundFilter(r)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                roundFilter === r
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-300 hover:text-white'
              }`}
            >
              الجولة {r}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-[#122218] border border-emerald-700/40 rounded-2xl overflow-hidden shadow-xl">
        <div className="divide-y divide-emerald-800/40">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-emerald-400/80">
              <Trophy className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="font-bold">لا يوجد مشاركون حتى الآن</p>
              <p className="text-xs text-emerald-500 mt-1">سجل تشكيلتك لتكون أول المتصدرين!</p>
            </div>
          ) : (
            rows.map((row, index) => {
              const isCurrentUser = row.entry.id === currentUserId;
              const isExpanded = expandedEntryId === row.entry.id;

              // Find squad for current filter
              const targetR = roundFilter === 'total' ? cfg.round : Number(roundFilter);
              let activeSquad = row.entry.rounds[targetR];
              if (!activeSquad) {
                for (let i = targetR - 1; i >= 1; i--) {
                  if (row.entry.rounds[i]) {
                    activeSquad = row.entry.rounds[i];
                    break;
                  }
                }
              }

              const capPlayer = activeSquad ? players[activeSquad.cap] : null;

              return (
                <div
                  key={row.entry.id}
                  className={`transition-colors ${
                    isCurrentUser
                      ? 'bg-emerald-900/40 border-r-4 border-amber-400'
                      : 'hover:bg-emerald-900/20'
                  }`}
                >
                  <div
                    onClick={() =>
                      setExpandedEntryId(isExpanded ? null : row.entry.id)
                    }
                    className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    {/* Rank & User Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Rank Badge */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 shadow-md ${
                          index === 0
                            ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-300'
                            : index === 1
                            ? 'bg-slate-300 text-slate-900 ring-2 ring-slate-200'
                            : index === 2
                            ? 'bg-amber-700 text-white ring-2 ring-amber-600'
                            : 'bg-emerald-950 text-emerald-300'
                        }`}
                      >
                        {index === 0 ? (
                          <Crown className="w-4 h-4" />
                        ) : index === 1 ? (
                          <Medal className="w-4 h-4" />
                        ) : index === 2 ? (
                          <Medal className="w-4 h-4" />
                        ) : (
                          index + 1
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-white text-sm sm:text-base truncate">
                            {row.entry.name}
                          </span>
                          {isCurrentUser && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 font-black">
                              أنت
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-emerald-400/80 flex items-center gap-2 mt-0.5">
                          {capPlayer ? (
                            <span>
                              الكابتن: <strong className="text-amber-300">{capPlayer.name}</strong>
                            </span>
                          ) : (
                            <span>لم يحدد الكابتن</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Points & Expand Arrow */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xl sm:text-2xl font-black text-amber-300 font-['Lalezar',sans-serif] leading-none">
                          {row.currentDisplayScore}
                        </span>
                        <span className="block text-[10px] text-emerald-400 font-bold">نقطة</span>
                      </div>

                      <button
                        type="button"
                        className="text-emerald-500 hover:text-white p-1"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Squad Preview */}
                  {isExpanded && activeSquad && (
                    <div className="p-3 bg-[#04100c] border-t border-emerald-800/40 animate-in fade-in duration-150">
                      <div className="text-xs font-bold text-emerald-400 mb-2 flex items-center justify-between">
                        <span>تشكيلة اللاعب (خطة {activeSquad.form || '2-2-2'})</span>
                        <span>إجمالي {activeSquad.ids.length} لاعبين</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                        {activeSquad.ids.map((pid) => {
                          const p = players[pid];
                          if (!p) return null;
                          const t = teams[p.teamId];
                          const isCap = pid === activeSquad.cap;

                          return (
                            <div
                              key={pid}
                              className={`p-2 rounded-xl bg-[#14261b] border ${
                                isCap
                                  ? 'border-amber-400 ring-1 ring-amber-400/50'
                                  : 'border-emerald-700/40'
                              } flex flex-col items-center text-center`}
                            >
                              <div className="relative mb-1">
                                <JerseyKit
                                  c1={t?.c1}
                                  c2={t?.c2}
                                  pat={t?.pat}
                                  num={p.num}
                                  kitUrl={t?.kitUrl}
                                  isCaptain={isCap}
                                  size="sm"
                                />
                              </div>
                              <span className="text-xs font-bold text-white truncate max-w-full">
                                {p.name}
                              </span>
                              <span className="text-[10px] text-emerald-300/80 truncate max-w-full">
                                {t?.name || 'فريق'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
