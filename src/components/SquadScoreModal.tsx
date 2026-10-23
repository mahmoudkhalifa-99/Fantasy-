import React, { useState, useMemo } from 'react';
import {
  Player,
  Team,
  TournamentConfig,
  Position,
  PlayerMatchStats,
  Entry,
} from '../types';
import { JerseyKit } from './JerseyKit';
import {
  calculatePlayerRoundPoints,
  calculateSquadRoundPoints,
  roundPenalty,
  POSITIONS_SHORT,
  POS_ORDER,
  parseFormation,
} from '../utils/fantasyScoring';
import {
  X,
  Trophy,
  Flame,
  Award,
  Crown,
  TrendingUp,
  Shield,
  Zap,
  Users,
  Star,
  CheckCircle2,
} from 'lucide-react';

interface SquadScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'highest' | 'average';
  round: number;
  cfg: TournamentConfig;
  teams: Record<string, Team>;
  players: Record<string, Player>;
  entries: Record<string, Entry>;
  allRoundStats: Record<number, { p: Record<string, PlayerMatchStats> }>;
  currentUserId: string;
  currentUserSquadIds: string[];
  currentUserCaptainId: string;
  currentUserBenchIds?: string[];
}

export const SquadScoreModal: React.FC<SquadScoreModalProps> = ({
  isOpen,
  onClose,
  type,
  round,
  cfg,
  teams,
  players,
  entries,
  allRoundStats,
  currentUserId,
  currentUserSquadIds,
  currentUserCaptainId,
  currentUserBenchIds = [],
}) => {
  const [highestMode, setHighestMode] = useState<'manager' | 'dreamteam'>('manager');

  const roundStatsDoc = useMemo(() => {
    return allRoundStats[round]?.p || {};
  }, [allRoundStats, round]);

  // 1. Calculate highest manager entry
  const highestManagerData = useMemo(() => {
    let bestScore = -1;
    let bestEntry: Entry | null = null;
    let bestSquadIds: string[] = [];
    let bestCaptainId = '';
    let bestFormation = '2-2-2';

    // Check all entries
    Object.values(entries).forEach((e) => {
      let sq = e.rounds[round];
      if (!sq) {
        for (let i = round - 1; i >= 1; i--) {
          if (e.rounds[i]) {
            sq = e.rounds[i];
            break;
          }
        }
      }
      if (sq && sq.ids && sq.ids.length > 0) {
        const score = calculateSquadRoundPoints(sq.ids, sq.cap, players, roundStatsDoc, sq.bench || [], sq.vice) - roundPenalty(e.rounds, round);
        if (score > bestScore) {
          bestScore = score;
          bestEntry = e;
          bestSquadIds = sq.ids;
          bestCaptainId = sq.cap;
          bestFormation = sq.form || '2-2-2';
        }
      }
    });

    // Check current user if live score is higher
    if (currentUserSquadIds.length > 0) {
      const liveScore = calculateSquadRoundPoints(
        currentUserSquadIds,
        currentUserCaptainId,
        players,
        roundStatsDoc,
        currentUserBenchIds
      );
      if (liveScore > bestScore) {
        bestScore = liveScore;
        bestEntry = {
          id: currentUserId,
          name: 'فريقك (تشكيلتك الحالية)',
          phone: '',
          joined: Date.now(),
          rounds: {},
        };
        bestSquadIds = currentUserSquadIds;
        bestCaptainId = currentUserCaptainId;
        bestFormation = '2-2-2';
      }
    }

    return {
      score: Math.max(0, bestScore),
      entry: bestEntry,
      squadIds: bestSquadIds,
      captainId: bestCaptainId,
      formation: bestFormation,
    };
  }, [
    entries,
    round,
    players,
    roundStatsDoc,
    currentUserSquadIds,
    currentUserCaptainId,
    currentUserId,
  ]);

  // 2. Calculate Gameweek Dream Team (تشكيلة الأحلام)
  // Best 1 GK, 2 DEF, 2 MID, 2 FWD from actual points scored in this round
  const dreamTeamData = useMemo(() => {
    const scoredPlayers = Object.values(players).map((p) => {
      const stats = roundStatsDoc[p.id];
      const pts = calculatePlayerRoundPoints(p, stats);
      return { player: p, pts, stats };
    });

    const gks = scoredPlayers.filter((x) => x.player.pos === 'GK').sort((a, b) => b.pts - a.pts);
    const defs = scoredPlayers.filter((x) => x.player.pos === 'DEF').sort((a, b) => b.pts - a.pts);
    const mids = scoredPlayers.filter((x) => x.player.pos === 'MID').sort((a, b) => b.pts - a.pts);
    const fwds = scoredPlayers.filter((x) => x.player.pos === 'FWD').sort((a, b) => b.pts - a.pts);

    // Standard 2-2-2 7-a-side formation
    const chosen: { player: Player; pts: number; stats?: PlayerMatchStats }[] = [];
    if (gks[0]) chosen.push(gks[0]);
    defs.slice(0, 2).forEach((d) => chosen.push(d));
    mids.slice(0, 2).forEach((m) => chosen.push(m));
    fwds.slice(0, 2).forEach((f) => chosen.push(f));

    // Determine captain as the one with highest pts
    let topScorerId = '';
    let maxScorerPts = -1;
    chosen.forEach((c) => {
      if (c.pts > maxScorerPts) {
        maxScorerPts = c.pts;
        topScorerId = c.player.id;
      }
    });

    const squadIds = chosen.map((c) => c.player.id);
    const totalPts = chosen.reduce((acc, cur) => {
      return acc + (cur.player.id === topScorerId ? cur.pts * 2 : cur.pts);
    }, 0);

    return {
      score: totalPts,
      squadIds,
      captainId: topScorerId,
      formation: '2-2-2',
      chosen,
    };
  }, [players, roundStatsDoc]);

  // 3. Calculate Average Squad data (تشكيلة متوسط الجولة)
  const averageData = useMemo(() => {
    // Collect all scores from valid entries
    const allManagerScores: number[] = [];
    Object.values(entries).forEach((e) => {
      let sq = e.rounds[round];
      if (!sq) {
        for (let i = round - 1; i >= 1; i--) {
          if (e.rounds[i]) {
            sq = e.rounds[i];
            break;
          }
        }
      }
      if (sq && sq.ids && sq.ids.length > 0) {
        allManagerScores.push(
          calculateSquadRoundPoints(sq.ids, sq.cap, players, roundStatsDoc, sq.bench || [], sq.vice) - roundPenalty(e.rounds, round)
        );
      }
    });

    if (currentUserSquadIds.length > 0) {
      allManagerScores.push(
        calculateSquadRoundPoints(
          currentUserSquadIds,
          currentUserCaptainId,
          players,
          roundStatsDoc,
          currentUserBenchIds
        )
      );
    }

    const avgScore = allManagerScores.length
      ? Math.round(allManagerScores.reduce((a, b) => a + b, 0) / allManagerScores.length)
      : 42;

    // Pick a representative squad that reflects the average:
    // Select players with median/average points in each position
    const scoredPlayers = Object.values(players).map((p) => {
      const stats = roundStatsDoc[p.id];
      const pts = calculatePlayerRoundPoints(p, stats);
      return { player: p, pts, stats };
    });

    const getRepresentative = (pos: Position, count: number) => {
      const list = scoredPlayers.filter((x) => x.player.pos === pos).sort((a, b) => a.pts - b.pts);
      if (list.length === 0) return [];
      if (list.length <= count) return list;
      // pick middle items
      const midIdx = Math.floor(list.length / 2);
      if (count === 1) return [list[midIdx]];
      return list.slice(Math.max(0, midIdx - 1), Math.max(0, midIdx - 1) + count);
    };

    const repGK = getRepresentative('GK', 1);
    const repDEF = getRepresentative('DEF', 2);
    const repMID = getRepresentative('MID', 2);
    const repFWD = getRepresentative('FWD', 2);

    const chosen = [...repGK, ...repDEF, ...repMID, ...repFWD];
    const squadIds = chosen.map((c) => c.player.id);
    const captainId = chosen[chosen.length - 1]?.player.id || '';

    // Calculate position averages
    const calcPosAvg = (pos: Position) => {
      const list = scoredPlayers.filter((x) => x.player.pos === pos);
      if (!list.length) return 0;
      const sum = list.reduce((a, b) => a + b.pts, 0);
      return (sum / list.length).toFixed(1);
    };

    return {
      score: avgScore,
      squadIds,
      captainId,
      formation: '2-2-2',
      chosen,
      posAvg: {
        GK: calcPosAvg('GK'),
        DEF: calcPosAvg('DEF'),
        MID: calcPosAvg('MID'),
        FWD: calcPosAvg('FWD'),
      },
    };
  }, [
    entries,
    round,
    players,
    roundStatsDoc,
    currentUserSquadIds,
    currentUserCaptainId,
  ]);

  if (!isOpen) return null;

  // Decide which active squad to display
  let displayedScore = 0;
  let displayedTitle = '';
  let displayedSubtitle = '';
  let displayedSquadIds: string[] = [];
  let displayedCaptainId = '';
  let displayedFormation = '2-2-2';

  if (type === 'highest') {
    if (highestMode === 'dreamteam' || !highestManagerData.squadIds.length) {
      displayedScore = dreamTeamData.score;
      displayedTitle = `تشكيلة الأحلام (Dream Team) • الجولة ${round}`;
      displayedSubtitle = 'أعلى 7 نجوم حصداً للنقاط في الجولة مع مضاعفة الكابتن';
      displayedSquadIds = dreamTeamData.squadIds;
      displayedCaptainId = dreamTeamData.captainId;
      displayedFormation = dreamTeamData.formation;
    } else {
      displayedScore = highestManagerData.score;
      displayedTitle = `تشكيلة أعلى نقاط • الجولة ${round}`;
      const coachName = highestManagerData.entry?.name || 'مدرب';
      displayedSubtitle = `المتصدر: ${coachName} برصيد ${highestManagerData.score} نقطة`;
      displayedSquadIds = highestManagerData.squadIds;
      displayedCaptainId = highestManagerData.captainId;
      displayedFormation = highestManagerData.formation;
    }
  } else {
    displayedScore = averageData.score;
    displayedTitle = `تشكيلة متوسط النقاط • الجولة ${round}`;
    displayedSubtitle = `المتوسط الحسابي لجميع تشكيلات المدربين المشاركين (${averageData.score} نقطة)`;
    displayedSquadIds = averageData.squadIds;
    displayedCaptainId = averageData.captainId;
    displayedFormation = averageData.formation;
  }

  // Parse formation lines for pitch layout
  const counts = parseFormation(displayedFormation);
  const groupedPos: Record<Position, Player[]> = {
    FWD: [],
    MID: [],
    DEF: [],
    GK: [],
  };

  displayedSquadIds.forEach((pid) => {
    const p = players[pid];
    if (p && groupedPos[p.pos]) {
      groupedPos[p.pos].push(p);
    }
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#122218] border border-emerald-500/50 rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header Bar */}
        <div
          className={`p-4 sm:p-5 flex items-start justify-between border-b ${
            type === 'highest'
              ? 'bg-gradient-to-r from-amber-600/30 via-purple-900/40 to-emerald-950/60 border-amber-500/40'
              : 'bg-gradient-to-r from-cyan-900/40 via-blue-900/40 to-emerald-950/60 border-cyan-500/40'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border ${
                type === 'highest'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
              }`}
            >
              {type === 'highest' ? (
                <Trophy className="w-6 h-6 animate-pulse" />
              ) : (
                <TrendingUp className="w-6 h-6" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white font-['Lalezar',sans-serif]">
                  {displayedTitle}
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-black font-mono shadow ${
                    type === 'highest'
                      ? 'bg-amber-400 text-amber-950'
                      : 'bg-cyan-400 text-cyan-950'
                  }`}
                >
                  {displayedScore} نقطة
                </span>
              </div>
              <p className="text-xs text-white/80 mt-0.5">{displayedSubtitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* If type is highest, allow switching between top manager squad & dream team */}
        {type === 'highest' && highestManagerData.squadIds.length > 0 && (
          <div className="px-4 pt-3 flex items-center gap-2 bg-[#04100c]">
            <button
              type="button"
              onClick={() => setHighestMode('manager')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                highestMode === 'manager'
                  ? 'bg-amber-400 text-amber-950 shadow-md'
                  : 'bg-[#182c20] text-emerald-200 hover:text-white'
              }`}
            >
              <Crown className="w-4 h-4" />
              <span>أعلى مدرب مسجل ({highestManagerData.score}ن)</span>
            </button>

            <button
              type="button"
              onClick={() => setHighestMode('dreamteam')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                highestMode === 'dreamteam'
                  ? 'bg-amber-400 text-amber-950 shadow-md'
                  : 'bg-[#182c20] text-emerald-200 hover:text-white'
              }`}
            >
              <Star className="w-4 h-4" />
              <span>تشكيلة الأحلام المثالية ({dreamTeamData.score}ن)</span>
            </button>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Realistic Pitch View */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-emerald-500/40 bg-[#1e4620]">
            {/* Turf Grass pattern */}
            <div
              className="absolute inset-0 pointer-events-none opacity-90"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  0deg,
                  #1b431e 0px,
                  #1b431e 32px,
                  #173b1a 32px,
                  #173b1a 64px
                )`,
              }}
            />

            {/* Pitch White Markings */}
            <div className="absolute inset-2 border-2 border-white/40 rounded-xl pointer-events-none">
              {/* Halfway line */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-b-2 border-white/40" />
              {/* Center circle */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border-2 border-white/40" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/60" />
              {/* Top penalty area */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-12 border-b-2 border-x-2 border-white/40 rounded-b-md" />
              {/* Bottom penalty area */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-36 h-12 border-t-2 border-x-2 border-white/40 rounded-t-md" />
            </div>

            {/* Pitch Player Rows */}
            <div className="relative z-10 py-5 px-2 flex flex-col justify-between gap-5 min-h-[360px]">
              {/* 1. FWD Row (Top) */}
              <div className="flex items-center justify-around gap-2">
                {groupedPos.FWD.map((p) => renderPlayerPitchCard(p))}
              </div>

              {/* 2. MID Row (Center) */}
              <div className="flex items-center justify-around gap-2">
                {groupedPos.MID.map((p) => renderPlayerPitchCard(p))}
              </div>

              {/* 3. DEF Row */}
              <div className="flex items-center justify-around gap-2">
                {groupedPos.DEF.map((p) => renderPlayerPitchCard(p))}
              </div>

              {/* 4. GK Row (Bottom) */}
              <div className="flex items-center justify-around gap-2">
                {groupedPos.GK.map((p) => renderPlayerPitchCard(p))}
              </div>
            </div>
          </div>

          {/* Position Average Stats Banner if type is average */}
          {type === 'average' && averageData.posAvg && (
            <div className="grid grid-cols-4 gap-2 bg-[#04100c] p-3 rounded-2xl border border-emerald-900/60 text-center">
              <div>
                <span className="block text-[11px] text-emerald-400 font-bold">حراسة المرمى</span>
                <span className="text-base font-black font-mono text-white">
                  {averageData.posAvg.GK} ن
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-emerald-400 font-bold">خط الدفاع</span>
                <span className="text-base font-black font-mono text-white">
                  {averageData.posAvg.DEF} ن
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-emerald-400 font-bold">خط الوسط</span>
                <span className="text-base font-black font-mono text-white">
                  {averageData.posAvg.MID} ن
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-emerald-400 font-bold">خط الهجوم</span>
                <span className="text-base font-black font-mono text-white">
                  {averageData.posAvg.FWD} ن
                </span>
              </div>
            </div>
          )}

          {/* Players Points Breakdown Table */}
          <div className="bg-[#04100c] rounded-2xl p-3 border border-emerald-900/60 space-y-2">
            <h4 className="text-xs font-black text-emerald-300 flex items-center justify-between">
              <span>تفاصيل نقاط اللاعبين في الجولة {round}:</span>
              <span className="text-[11px] text-emerald-400/80 font-normal">
                (C) الكابتن مضاعف النقاط x2
              </span>
            </h4>

            <div className="divide-y divide-emerald-950/80 text-xs">
              {displayedSquadIds.map((pid) => {
                const p = players[pid];
                if (!p) return null;
                const tm = teams[p.teamId];
                const stats = roundStatsDoc[pid];
                const rawPts = calculatePlayerRoundPoints(p, stats);
                const isCap = pid === displayedCaptainId;
                const finalPts = isCap ? rawPts * 2 : rawPts;

                return (
                  <div key={pid} className="py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-7">
                        <JerseyKit
                          c1={tm?.c1}
                          c2={tm?.c2}
                          pat={tm?.pat}
                          num={p.num}
                          size="sm"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-white">
                          <span>{p.name}</span>
                          {isCap && (
                            <span className="bg-amber-400 text-amber-950 text-[10px] font-black px-1 rounded font-mono">
                              C x2
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-emerald-400/80 flex items-center gap-2">
                          <span>{POSITIONS_SHORT[p.pos]}</span>
                          <span>•</span>
                          <span>{tm?.name || 'الفريق'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Event badges */}
                      <div className="flex items-center gap-1 text-[11px]">
                        {stats?.g ? (
                          <span className="text-amber-300 font-mono">⚽x{stats.g}</span>
                        ) : null}
                        {stats?.a ? (
                          <span className="text-cyan-300 font-mono">👟x{stats.a}</span>
                        ) : null}
                        {stats?.cs ? <span className="text-emerald-300">🧤CS</span> : null}
                        {stats?.tk ? <span className="text-indigo-300 font-mono">🛡️x{stats.tk}</span> : null}
                        {stats?.mo ? <span className="text-yellow-400">⭐</span> : null}
                        {stats?.ps ? (
                          <span className="text-purple-300 font-mono">🧤x{stats.ps}</span>
                        ) : null}
                      </div>

                      <div className="w-12 text-left">
                        <span
                          className={`font-black font-mono text-sm ${
                            isCap ? 'text-amber-300' : 'text-white'
                          }`}
                        >
                          {finalPts} ن
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0a140e] border-t border-emerald-900/60 flex items-center justify-between">
          <div className="text-xs text-emerald-300/80">
            <span>مجموع التشكيلة: </span>
            <strong className="text-white font-mono text-sm">{displayedScore} نقطة</strong>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition-colors shadow"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );

  function renderPlayerPitchCard(p: Player) {
    const tm = teams[p.teamId];
    const stats = roundStatsDoc[p.id];
    const rawPts = calculatePlayerRoundPoints(p, stats);
    const isCap = p.id === displayedCaptainId;
    const finalPts = isCap ? rawPts * 2 : rawPts;

    return (
      <div
        key={p.id}
        className="flex flex-col items-center group relative cursor-pointer transition-transform hover:scale-105"
      >
        {/* Shirt & Captain Armband */}
        <div className="relative">
          <div className="w-11 h-13 drop-shadow-md">
            <JerseyKit
              c1={tm?.c1}
              c2={tm?.c2}
              pat={tm?.pat}
              num={p.num}
              size="md"
              isCaptain={isCap}
            />
          </div>

          {isCap && (
            <span className="absolute -top-1 -right-1 bg-amber-400 text-amber-950 font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow border border-white">
              C
            </span>
          )}

          {/* Points Pill Badge */}
          <span
            className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-full font-black text-[10px] font-mono shadow border ${
              isCap
                ? 'bg-amber-400 text-amber-950 border-amber-200'
                : 'bg-emerald-950 text-white border-emerald-500'
            }`}
          >
            {finalPts}ن
          </span>
        </div>

        {/* Player Name Pill */}
        <div className="mt-2 text-center max-w-[76px]">
          <span className="block text-[10px] font-black text-white bg-black/75 px-1.5 py-0.5 rounded shadow truncate">
            {p.name.split(' ')[0]}
          </span>
        </div>
      </div>
    );
  }
};
