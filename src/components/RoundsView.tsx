import React, { useState } from 'react';
import { Player, Team, TournamentConfig, Entry } from '../types';
import { PitchView } from './PitchView';
import { JerseyKit } from './JerseyKit';
import {
  calculatePlayerRoundPoints,
  calculateSquadRoundPoints,
  roundPenalty,
  formatStatText,
  POSITIONS_SHORT,
} from '../utils/fantasyScoring';
import { Star, ChevronLeft, ChevronRight, Award, Flame, LayoutGrid, List } from 'lucide-react';

interface RoundsViewProps {
  cfg: TournamentConfig;
  players: Record<string, Player>;
  teams: Record<string, Team>;
  entries: Record<string, Entry>;
  allRoundStats: Record<number, { p: Record<string, any> }>;
  currentUserId: string;
}

export const RoundsView: React.FC<RoundsViewProps> = ({
  cfg,
  players,
  teams,
  entries,
  allRoundStats,
  currentUserId,
}) => {
  const statRounds = Object.keys(allRoundStats)
    .map(Number)
    .sort((a, b) => a - b);

  const defaultRound = statRounds.length > 0 ? statRounds[statRounds.length - 1] : 1;
  const [selectedRound, setSelectedRound] = useState<number>(defaultRound);
  const [displayMode, setDisplayMode] = useState<'pitch' | 'list'>('pitch');

  const roundStatsDoc = allRoundStats[selectedRound]?.p || {};

  // Current user's entry & squad for this round
  const userEntry = entries[currentUserId];
  let userSquad = userEntry?.rounds[selectedRound];
  if (!userSquad && userEntry) {
    for (let i = selectedRound - 1; i >= 1; i--) {
      if (userEntry.rounds[i]) {
        userSquad = userEntry.rounds[i];
        break;
      }
    }
  }

  // Calculate scores across all participants in this round
  const allScores = Object.values(entries).map((e) => {
    let sq = e.rounds[selectedRound];
    if (!sq) {
      for (let i = selectedRound - 1; i >= 1; i--) {
        if (e.rounds[i]) {
          sq = e.rounds[i];
          break;
        }
      }
    }
    return sq ? calculateSquadRoundPoints(sq.ids, sq.cap, players, roundStatsDoc) - roundPenalty(e.rounds, selectedRound) : 0;
  });

  const avgScore = allScores.length
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : 0;
  const highScore = allScores.length ? Math.max(...allScores) : 0;
  const userScore = userSquad
    ? calculateSquadRoundPoints(userSquad.ids, userSquad.cap, players, roundStatsDoc) - roundPenalty(userEntry?.rounds, selectedRound)
    : 0;

  // Star players of this round (sorted by points)
  const starPlayers = Object.keys(roundStatsDoc)
    .map((pid) => {
      const p = players[pid];
      if (!p) return null;
      const pts = calculatePlayerRoundPoints(p, roundStatsDoc[pid]);
      return {
        player: p,
        stats: roundStatsDoc[pid],
        points: pts,
      };
    })
    .filter((x): x is { player: Player; stats: any; points: number } => x !== null && x.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 6);

  return (
    <div className="space-y-4">
      {/* Header and Round Navigation */}
      <div className="bg-[#122218] border border-emerald-600/40 rounded-2xl p-4 shadow-xl flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white font-['Lalezar',sans-serif]">
              نتائج وإحصائيات الجولة {selectedRound}
            </h2>
            <p className="text-xs text-emerald-300">
              تابع أداء تشكيلتك ونجوم الدورة الشعبية في كل جولة
            </p>
          </div>
        </div>

        {/* Round Stepper */}
        <div className="flex items-center gap-2 bg-[#0a140f] px-3 py-1.5 rounded-xl border border-emerald-800/60">
          <button
            type="button"
            disabled={selectedRound <= 1}
            onClick={() => setSelectedRound((r) => Math.max(1, r - 1))}
            className="p-1 text-emerald-400 hover:text-white disabled:opacity-30 disabled:hover:text-emerald-400"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <span className="text-sm font-black text-amber-400 font-mono px-2">
            الجولة {selectedRound}
          </span>
          <button
            type="button"
            disabled={selectedRound >= cfg.round}
            onClick={() => setSelectedRound((r) => Math.min(cfg.round, r + 1))}
            className="p-1 text-emerald-400 hover:text-white disabled:opacity-30 disabled:hover:text-emerald-400"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats Cards (Average, Mine, High) */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#101e15] border border-emerald-800/50 rounded-xl p-3 text-center">
          <div className="text-xl sm:text-3xl font-black text-emerald-300 font-['Lalezar',sans-serif]">
            {avgScore}
          </div>
          <div className="text-[11px] sm:text-xs text-emerald-500 font-bold mt-0.5">
            متوسط الجولة
          </div>
        </div>

        <div className="bg-gradient-to-b from-amber-950/40 to-emerald-950/60 border-2 border-amber-500/50 rounded-xl p-3 text-center shadow-lg">
          <div className="text-xl sm:text-3xl font-black text-amber-400 font-['Lalezar',sans-serif]">
            {userSquad ? userScore : '—'}
          </div>
          <div className="text-[11px] sm:text-xs text-amber-200 font-bold mt-0.5">
            نقاطك في الجولة
          </div>
        </div>

        <div className="bg-[#101e15] border border-emerald-800/50 rounded-xl p-3 text-center">
          <div className="text-xl sm:text-3xl font-black text-emerald-300 font-['Lalezar',sans-serif]">
            {highScore}
          </div>
          <div className="text-[11px] sm:text-xs text-emerald-500 font-bold mt-0.5">
            أعلى سكور
          </div>
        </div>
      </div>

      {/* Stars of the Round */}
      {starPlayers.length > 0 && (
        <div className="bg-[#122218] border border-emerald-700/40 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-amber-400">
            <Flame className="w-5 h-5" />
            <h3 className="font-black text-base font-['Lalezar',sans-serif]">
              نجوم الجولة {selectedRound} (الأعلى نقاطاً)
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {starPlayers.map(({ player, stats, points }) => {
              const team = teams[player.teamId];
              return (
                <div
                  key={player.id}
                  className="bg-[#0b160f] border border-emerald-800/60 rounded-xl p-3 flex flex-col items-center text-center relative overflow-hidden group hover:border-amber-400/60 transition-all"
                >
                  <div className="mb-2">
                    <JerseyKit
                      c1={team?.c1}
                      c2={team?.c2}
                      pat={team?.pat}
                      num={player.num}
                      kitUrl={team?.kitUrl}
                      size="sm"
                    />
                  </div>
                  <span className="font-black text-xs text-white truncate max-w-full">
                    {player.name}
                  </span>
                  <span className="text-[10px] text-emerald-400/80 truncate max-w-full">
                    {team?.name || 'فريق'}
                  </span>

                  <div className="mt-2 pt-2 border-t border-emerald-900/60 w-full flex items-center justify-between text-[11px]">
                    <span className="text-amber-400 font-black">{points} ن</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950 px-1 rounded">
                      {POSITIONS_SHORT[player.pos]}
                    </span>
                  </div>

                  <div className="text-[9px] text-emerald-500 mt-1 truncate max-w-full">
                    {formatStatText(stats)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* User's Squad in this Round */}
      <div className="bg-[#122218] border border-emerald-700/40 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-black text-base text-white font-['Lalezar',sans-serif]">
            تشكيلتك في الجولة {selectedRound}
          </h3>

          <div className="flex items-center gap-1 bg-[#0a140f] p-1 rounded-lg border border-emerald-800/50">
            <button
              type="button"
              onClick={() => setDisplayMode('pitch')}
              className={`p-1.5 rounded text-xs ${
                displayMode === 'pitch'
                  ? 'bg-emerald-600 text-white'
                  : 'text-emerald-400 hover:text-white'
              }`}
              title="عرض الملعب"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('list')}
              className={`p-1.5 rounded text-xs ${
                displayMode === 'list'
                  ? 'bg-emerald-600 text-white'
                  : 'text-emerald-400 hover:text-white'
              }`}
              title="عرض القائمة"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {userSquad ? (
          displayMode === 'pitch' ? (
            <PitchView
              squadIds={userSquad.ids}
              captainId={userSquad.cap}
              formation={userSquad.form || '2-2-2'}
              players={players}
              teams={teams}
              roundStats={roundStatsDoc}
              showPoints={true}
              isReadOnly={true}
            />
          ) : (
            <div className="divide-y divide-emerald-800/30">
              {userSquad.ids.map((pid) => {
                const p = players[pid];
                if (!p) return null;
                const team = teams[p.teamId];
                const isCap = pid === userSquad?.cap;
                const pStats = roundStatsDoc[pid];
                const rawPts = calculatePlayerRoundPoints(p, pStats);
                const finalPts = isCap ? rawPts * 2 : rawPts;

                return (
                  <div
                    key={pid}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <JerseyKit
                        c1={team?.c1}
                        c2={team?.c2}
                        pat={team?.pat}
                        num={p.num}
                        kitUrl={team?.kitUrl}
                        isCaptain={isCap}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white truncate">{p.name}</span>
                          {isCap && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-black bg-amber-400 text-amber-950">
                              الكابتن (x2)
                            </span>
                          )}
                        </div>
                        <div className="text-emerald-400/80 text-[11px] mt-0.5">
                          {team?.name || 'فريق'} • {formatStatText(pStats)}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base font-black text-amber-300 font-mono">
                        {finalPts}
                      </span>
                      <span className="text-[10px] text-emerald-400 mr-1">نقطة</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="p-8 text-center text-emerald-400/80">
            <p className="font-bold">لم تشارك بتشكيلة مسجلة في الجولة {selectedRound}</p>
            <p className="text-xs text-emerald-500 mt-1">ادخل على تبويب "تشكيلتي" لاختيار لاعبيك</p>
          </div>
        )}
      </div>
    </div>
  );
};
