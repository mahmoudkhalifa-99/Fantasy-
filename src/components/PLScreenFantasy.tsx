import React, { useState, useMemo } from 'react';
import {
  TournamentConfig,
  Team,
  Player,
  Entry,
  Position,
  PlayerMatchStats, Match } from '../types';
import { PitchView } from './PitchView';
import { formatDeadline, roundDeadlineMs } from '../utils/deadline';
import { SquadScoreModal } from './SquadScoreModal';
import {
  calculateSquadRoundPoints,
  roundPenalty,
  calculatePlayerRoundPoints,
  calculatePlayerTotalPoints,
  parseFormation,
  SQUAD_SIZE,
  SUPPORTED_FORMATIONS,
} from '../utils/fantasyScoring';
import {
  Shirt,
  ArrowRightLeft,
  ChevronLeft,
  Award,
  Sparkles,
  Trophy,
  TrendingUp,
  Zap,
  Pencil,
  Check,
  X,
} from 'lucide-react';

interface PLScreenFantasyProps {
  cfg: TournamentConfig;
  teams: Record<string, Team>;
  players: Record<string, Player>;
  entries: Record<string, Entry>;
  allRoundStats: Record<number, { p: Record<string, PlayerMatchStats> }>;
  currentUserId: string;
  userName: string;
  matches?: Record<string, Match>;
  squadIds: string[];
  benchIds?: string[];
  onBenchSlotClick?: (pos: Position, replacingId?: string) => void;
  onRemoveBench?: (playerId: string) => void;
  onSwapBench?: (starterId: string, benchId: string) => void;
  onOpenPoints?: () => void;
  onOpenPickTeam?: () => void;
  onFormationChange?: (f: string) => void;
  captainId: string;
  formation: string;
  isDraftDirty: boolean;
  onOpenPickTeamModal: () => void;
  onOpenTransfersModal: () => void;
  onOpenTransfersPage: () => void;
  onOpenStandings?: () => void;
  myStanding?: { rank: number; total: number; participants: number } | null;
  onSaveSquad: () => void;
  onSetCaptain: (id: string) => void;
  onRemovePlayer: (id: string) => void;
  onReplacePlayer?: (id: string) => void;
  onSlotClick: (pos: Position) => void;
  onNavigateToMatches: () => void;
  onRenameTeam?: (name: string) => Promise<boolean> | boolean;
  bookingMode?: boolean;
  bookingLocked?: boolean;
  bookingDeadline?: number | null;
}

export const PLScreenFantasy: React.FC<PLScreenFantasyProps> = ({
  cfg,
  teams,
  players,
  entries,
  allRoundStats,
  currentUserId,
  userName,
  matches = {},
  squadIds,
  benchIds = [],
  onBenchSlotClick,
  onRemoveBench,
  onSwapBench,
  onOpenPoints,
  onOpenPickTeam,
  onFormationChange,
  captainId,
  formation,
  isDraftDirty,
  onOpenPickTeamModal,
  onOpenTransfersModal,
  onOpenTransfersPage,
  onOpenStandings,
  myStanding,
  onSaveSquad,
  onSetCaptain,
  onRemovePlayer,
  onReplacePlayer,
  onSlotClick,
  onNavigateToMatches,
  onRenameTeam,
  bookingMode = false,
  bookingLocked = false,
  bookingDeadline = null,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const saveName = async () => {
    if (!onRenameTeam || savingName) return;
    setSavingName(true);
    const ok = await onRenameTeam(nameDraft);
    setSavingName(false);
    if (ok) setEditingName(false);
  };
  const [squadModalType, setSquadModalType] = useState<'highest' | 'average' | null>(null);

  // Compute live match stats for current active gameweek
  const roundStatsDoc = useMemo(() => {
    return allRoundStats[cfg.round]?.p || {};
  }, [allRoundStats, cfg.round]);

  // نقاط كل لاعب في التشكيلة: الجولة الحالية + الإجمالي (عشان المشترك يعرف مين الكويس عنده)
  const ptsMap = useMemo(() => {
    const out: Record<string, { round: number; total: number }> = {};
    for (const id of squadIds) {
      const p = players[id];
      if (!p) continue;
      out[id] = {
        round: calculatePlayerRoundPoints(p, roundStatsDoc[id]),
        total: calculatePlayerTotalPoints(id, players, allRoundStats),
      };
    }
    return out;
  }, [squadIds, players, roundStatsDoc, allRoundStats]);

  // Dynamic automatic calculation of user live points based on current squad & captain
  const userScore = useMemo(() => {
    if (!squadIds.length) return 0;
    return calculateSquadRoundPoints(squadIds, captainId, players, roundStatsDoc, benchIds) - roundPenalty(entries[currentUserId]?.rounds, cfg.round);
  }, [squadIds, benchIds, captainId, players, roundStatsDoc, entries, currentUserId, cfg.round]);

  // Dynamic automatic calculation of all entries scores + user live score
  const { avgScore, highScore } = useMemo(() => {
    const scores: number[] = [];

    // Calculate score for each registered coach entry
    Object.values(entries).forEach((e) => {
      // If this entry is the current user and user has live edits, use live squad
      if (e.id === currentUserId && squadIds.length > 0) {
        scores.push(calculateSquadRoundPoints(squadIds, captainId, players, roundStatsDoc, benchIds) - roundPenalty(e.rounds, cfg.round));
        return;
      }

      let sq = e.rounds[cfg.round];
      if (!sq) {
        for (let i = cfg.round - 1; i >= 1; i--) {
          if (e.rounds[i]) {
            sq = e.rounds[i];
            break;
          }
        }
      }
      if (sq && sq.ids && sq.ids.length > 0) {
        scores.push(calculateSquadRoundPoints(sq.ids, sq.cap, players, roundStatsDoc, sq.bench || []) - roundPenalty(e.rounds, cfg.round));
      }
    });

    // If current user is not in entries yet, add user's live score
    if (!entries[currentUserId] && squadIds.length > 0) {
      scores.push(userScore);
    }

    // الأعلى والمتوسط من تشكيلات المشتركين الفعلية بس (صفر لو لسه مفيش)
    const calculatedAvg = scores.length ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : 0;
    const calculatedHigh = scores.length ? Math.max(...scores) : 0;

    return {
      avgScore: calculatedAvg,
      highScore: calculatedHigh,
    };
  }, [entries, currentUserId, squadIds, captainId, players, roundStatsDoc, cfg.round, userScore]);

  // موعد قفل التشكيلة = أول ماتش في الجولة اللي بتتعدّل (من الجدول الفعلي)
  const editRound = cfg.locked ? cfg.round + 1 : cfg.round;
  const dlMs = roundDeadlineMs(matches, editRound, cfg);
  const deadlineText = bookingMode
    ? bookingLocked
      ? '🔒 تشكيلة الحجز اتقفلت (قبل أول ماتش بربع ساعة)'
      : bookingDeadline
      ? `الديدلاين: ${formatDeadline(bookingDeadline)}`
      : 'التعديل مفتوح لحد ما أول ماتش في الحجز يبدأ'
    : cfg.locked
    ? `الجولة ${cfg.round} اتقفلت، تعديلك دلوقتي للجولة ${editRound}${dlMs ? ` (يقفل ${formatDeadline(dlMs)})` : ''}`
    : dlMs
    ? `الديدلاين: ${formatDeadline(dlMs)}`
    : 'التعديل مفتوح لحد ما أول ماتش في الجولة يبدأ';

  // Dynamic budget calculation
  const totalCost = [...squadIds, ...benchIds].reduce(
    (sum, pid) => sum + (Number(players[pid]?.price) || 0),
    0
  );
  const remainingBudget = Math.max(0, cfg.budget - totalCost);

  return (
    <div className="space-y-4 pb-4 animate-in fade-in duration-200" dir="rtl">
      {/* Cyan / Blue / Purple Gradient Fantasy Card */}
      <div className="relative rounded-3xl p-5 sm:p-6 overflow-hidden shadow-2xl text-white bg-gradient-to-br from-[#00d2ff] via-[#0066ff] to-[#7928ca]">
        {/* Abstract wavy lines texture */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 10% 20%, rgba(255,255,255,0.4) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(0,255,180,0.4) 0%, transparent 40%)',
          }}
        />

        <div className="relative z-10 space-y-4">
          {/* User Club Badge Row */}
          <div className="flex items-center justify-between pb-3 border-b border-white/20">
            <div className="flex items-center gap-3">
              {/* Badge Circle */}
              <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/40 flex items-center justify-center font-black text-amber-300 shadow-md text-base font-mono">
                {userName ? userName.slice(0, 2).toUpperCase() : 'KH'}
              </div>

              <div className="min-w-0">
                {editingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveName();
                        if (e.key === 'Escape') setEditingName(false);
                      }}
                      maxLength={40}
                      autoFocus
                      placeholder="اسم فريقك"
                      className="w-40 sm:w-52 bg-black/40 border border-white/40 rounded-lg px-2 py-1 text-sm text-white placeholder-white/50 focus:outline-none focus:border-amber-300"
                    />
                    <button type="button" onClick={saveName} disabled={savingName} className="p-1.5 rounded-lg bg-emerald-500 text-white disabled:opacity-50" title="حفظ">
                      <Check className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => setEditingName(false)} className="p-1.5 rounded-lg bg-black/40 text-white" title="إلغاء">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <h3 className="font-black text-base sm:text-lg text-white font-['Lalezar',sans-serif] leading-tight flex items-center gap-1.5">
                    <span className="truncate">{userName || 'فريق الكابتن'}</span>
                    {onRenameTeam && (
                      <button
                        type="button"
                        onClick={() => {
                          setNameDraft(userName || '');
                          setEditingName(true);
                        }}
                        className="p-1 rounded-md text-white/80 hover:text-amber-300 hover:bg-black/20"
                        title="تعديل اسم الفريق"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </h3>
                )}
                <span className="text-xs text-white/90 flex items-center gap-1.5 font-medium">
                  <span>🇪🇬</span>
                  <span>كابتن الدورة</span>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenPickTeam ?? onOpenPickTeamModal}
              className="text-white/80 hover:text-white p-1 transition-colors"
              title="تعديل التشكيلة"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          {/* Gameweek Points Summary (Average | Points | Highest) */}
          <div className="text-center pt-1">
            <span className="text-xs font-bold text-white/90 tracking-wide uppercase">
              {bookingMode ? 'فانتازي الحجز • Booking' : `Gameweek ${cfg.round} • الجولة ${cfg.round}`}
            </span>

            {/* Interactive 3-box Grid: Click Highest to show dream team / top squad, Average for average squad */}
            <div className="grid grid-cols-3 items-stretch gap-2 mt-2">
              {/* 1. المتوسط (Average) - Clickable to open Average Lineup */}
              <button
                type="button"
                onClick={() => setSquadModalType('average')}
                className="group p-2 rounded-2xl bg-black/20 hover:bg-black/35 border border-white/15 hover:border-cyan-300 transition-all text-center flex flex-col items-center justify-center cursor-pointer shadow-md active:scale-95"
                title="اضغط لعرض تشكيلة متوسط الجولة"
              >
                <span className="block text-2xl sm:text-3xl font-black font-mono group-hover:scale-105 transition-transform">
                  {avgScore}
                </span>
                <span className="text-[11px] text-white/90 font-bold flex items-center justify-center gap-1 mt-0.5">
                  <span>المتوسط</span>
                  <span className="text-cyan-300 text-xs font-mono group-hover:translate-x-[-2px] transition-transform">←</span>
                </span>
                <span className="text-[9px] text-white/60 font-mono">تشكيلة المتوسط</span>
              </button>

              {/* 2. النقاط (User Live Points) - Clickable to toggle pitch */}
              <button
                type="button"
                onClick={onOpenPoints}
                className="group p-2 rounded-2xl bg-black/30 hover:bg-black/40 border-2 border-amber-300/60 hover:border-amber-300 transition-all text-center flex flex-col items-center justify-center cursor-pointer shadow-lg active:scale-95"
                title="اضغط لعرض نقاط تشكيلتك"
              >
                <span className="block text-4xl sm:text-5xl font-black font-mono text-white leading-none drop-shadow-md group-hover:scale-105 transition-transform">
                  {userScore}
                </span>
                <span className="text-xs text-amber-300 font-extrabold flex items-center justify-center gap-0.5 mt-1">
                  <span>نقاطك</span>
                  <span className="text-xs">⚡</span>
                </span>
                <span className="text-[9px] text-amber-200/80 font-mono">
                  شوف نقاط لاعبينك
                </span>
              </button>

              {/* 3. الأعلى (Highest) - Clickable to open Highest Points Lineup */}
              <button
                type="button"
                onClick={() => setSquadModalType('highest')}
                className="group p-2 rounded-2xl bg-black/20 hover:bg-black/35 border border-white/15 hover:border-amber-300 transition-all text-center flex flex-col items-center justify-center cursor-pointer shadow-md active:scale-95"
                title="اضغط لعرض تشكيلة أعلى نقاط في الجولة"
              >
                <span className="block text-2xl sm:text-3xl font-black font-mono text-amber-200 group-hover:scale-105 transition-transform">
                  {highScore}
                </span>
                <span className="text-[11px] text-white/90 font-bold flex items-center justify-center gap-1 mt-0.5">
                  <span>الأعلى</span>
                  <span className="text-amber-300 text-xs font-mono group-hover:translate-x-[-2px] transition-transform">←</span>
                </span>
                <span className="text-[9px] text-amber-300/80 font-mono">أعلى مدرب</span>
              </button>
            </div>
          </div>

          {/* Deadline Alert Banner */}
          <div className="pt-2">
            <div className="w-16 h-0.5 bg-white/40 mx-auto mb-3" />
            <div className="text-center text-xs space-y-0.5">
              {!bookingMode && <div className="font-bold text-white/90">الجولة القادمة • Gameweek {cfg.round + 1}</div>}
              <div className="text-xs sm:text-sm font-black text-amber-200">
                {deadlineText}
              </div>
            </div>
          </div>

          {/* Large Action Pill Buttons (Pick Team & Transfers) */}
          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={onOpenPoints}
              className="w-full py-3.5 px-4 bg-[#102a45]/90 hover:bg-[#102a45] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-98 border border-white/20 cursor-pointer"
            >
              <span>📊 النقاط (Points)</span>
            </button>

            <button
              type="button"
              onClick={onOpenPickTeam ?? onOpenPickTeamModal}
              className="w-full py-3.5 px-4 bg-[#102a45]/90 hover:bg-[#102a45] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-98 border border-white/20 cursor-pointer"
            >
              <Shirt className="w-5 h-5 text-cyan-300" />
              <span>👕 اختيار التشكيلة (Pick Team)</span>
            </button>

            <button
              type="button"
              onClick={onOpenTransfersPage}
              className="w-full py-3.5 px-4 bg-[#102a45]/90 hover:bg-[#102a45] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-98 border border-white/20 cursor-pointer"
            >
              <ArrowRightLeft className="w-5 h-5 text-emerald-300" />
              <span>⇄ سوق الانتقالات (Transfers)</span>
            </button>

            {onOpenStandings && (
              <button
                type="button"
                onClick={onOpenStandings}
                className="w-full py-3.5 px-4 bg-amber-400 hover:bg-amber-300 text-amber-950 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-98 cursor-pointer"
              >
                <span>🏆 ترتيب المشتركين</span>
                {myStanding && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-950/15 text-xs font-mono">
                    #{myStanding.rank} من {myStanding.participants} • {myStanding.total} نقطة
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Highest / Average Squad Lineup Modal */}
      {squadModalType && (
        <SquadScoreModal
          isOpen={true}
          onClose={() => setSquadModalType(null)}
          type={squadModalType}
          round={cfg.round}
          cfg={cfg}
          teams={teams}
          players={players}
          entries={entries}
          allRoundStats={allRoundStats}
          currentUserId={currentUserId}
          currentUserSquadIds={squadIds}
          currentUserCaptainId={captainId}
          currentUserBenchIds={benchIds}
        />
      )}
    </div>
  );
};
