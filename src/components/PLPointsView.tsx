import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import type { Entry, Player, Position, SquadSelection, Team, TournamentConfig } from '../types';
import { BenchPanel, BoardCard, GreenPitch, InfoCard, PitchRow, ScreenShell, StatusLine } from './FantasyBoard';
import { calculatePlayerRoundPoints, calculateSquadRoundPoints, effectiveCaptain, getAutoSubs, playerPointsBreakdown, POSITIONS_SHORT, POS_ORDER, roundPenalty } from '../utils/fantasyScoring';

interface Props {
  cfg: TournamentConfig;
  players: Record<string, Player>;
  teams: Record<string, Team>;
  entries: Record<string, Entry>;
  allRoundStats: Record<number, { p: Record<string, any> }>;
  currentUserId: string;
  bookingMode?: boolean;
  onBack: () => void;
}

/** شاشة النقاط: نقاط اللاعبين بس (عرض من غير أي تعديل) */
export const PLPointsView: React.FC<Props> = ({ cfg, players, teams, entries, allRoundStats, currentUserId, bookingMode = false, onBack }) => {
  const rounds = useMemo(() => Object.keys(allRoundStats).map(Number).sort((a, b) => a - b), [allRoundStats]);
  const [picked, setPicked] = useState<number | null>(null);
  const round = picked !== null && rounds.includes(picked) ? picked : rounds.includes(cfg.round) ? cfg.round : rounds[rounds.length - 1] ?? cfg.round;
  const idx = rounds.indexOf(round);
  const stats = allRoundStats[round]?.p || {};

  // تشكيلة الجولة، ولو مفيش نستخدم آخر تشكيلة قبلها (نفس منطق الحساب)
  const squadOf = (e?: Entry): SquadSelection | undefined => {
    if (!e) return undefined;
    let sq = e.rounds?.[round];
    for (let i = round - 1; i >= 1 && !sq; i--) sq = e.rounds?.[i];
    return sq;
  };
  const scoreOf = (e: Entry) => {
    const sq = squadOf(e);
    return sq ? calculateSquadRoundPoints(sq.ids, sq.cap, players, stats, sq.bench || [], sq.vice) - roundPenalty(e.rounds, round) : null;
  };

  const mine = entries[currentUserId];
  const mySq = squadOf(mine);
  const myScore = mine ? scoreOf(mine) : null;
  const all = Object.values(entries).map(scoreOf).filter((x): x is number => x !== null);
  const avg = all.length ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : 0;
  const high = all.length ? Math.max(...all) : 0;

  const subs = mySq ? getAutoSubs(mySq.ids, players, stats, mySq.bench || []) : [];
  const subbedOut = new Set(subs.map((s) => s.outId));
  const subbedIn = new Set(subs.map((s) => s.inId));
  const doubledId = mySq ? effectiveCaptain(mySq.cap, mySq.vice, stats) : '';
  const viceTookOver = !!mySq && doubledId !== mySq.cap && doubledId === mySq.vice;
  const [detailId, setDetailId] = useState<string | null>(null);

  const card = (pid: string, bench = false) => {
    const p = players[pid];
    if (!p || !mySq) return null;
    const isCap = mySq.cap === pid;
    const isVice = mySq.vice === pid;
    const played = !!stats[pid]?.pl;
    const raw = calculatePlayerRoundPoints(p, stats[pid]);
    const doubled = pid === doubledId;
    const pts = doubled ? raw * 2 : raw;
    const out = subbedOut.has(pid);
    const inn = subbedIn.has(pid);
    // الدكة اللي ما دخلتش: باهتة. الأساسي اللي اتبدّل: باهت
    const dim = out || (bench && !inn);
    const chip = !played ? '—' : `${inn ? '↑ ' : ''}${pts}${doubled ? ' (x2)' : ''}`;
    return <BoardCard key={pid} player={p} team={teams[p.teamId]} chip={chip} chipTone={played ? 'points' : 'muted'} isCaptain={isCap} isVice={isVice} dim={dim} onClick={() => setDetailId(pid)} />;
  };

  const startersByPos: Record<Position, string[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  (mySq?.ids ?? []).forEach((id) => {
    const p = players[id];
    if (p) startersByPos[p.pos].push(id);
  });

  return (
    <ScreenShell title="Points" onBack={onBack}>
      <StatusLine>
        <span>{bookingMode ? 'نقاط فانتازي الحجز' : `نقاط الجولة ${round}`}</span>
      </StatusLine>

      {!bookingMode && rounds.length > 1 && (
        <div className="flex items-center justify-center gap-4 bg-gray-200 dark:bg-[#15251c] border border-gray-300 dark:border-emerald-800 rounded-full p-1 mx-auto w-fit">
          <button type="button" disabled={idx <= 0} onClick={() => setPicked(rounds[idx - 1])} className="p-1.5 disabled:opacity-30 text-gray-700 dark:text-emerald-200">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-xs font-black text-gray-900 dark:text-white font-mono px-2">الجولة {round}</span>
          <button type="button" disabled={idx >= rounds.length - 1} onClick={() => setPicked(rounds[idx + 1])} className="p-1.5 disabled:opacity-30 text-gray-700 dark:text-emerald-200">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      <InfoCard className="grid grid-cols-3 gap-1 text-center items-center">
        <div>
          <div className="text-base font-black text-gray-900 dark:text-white font-mono">{avg}</div>
          <div className="text-[10px] text-gray-500 dark:text-emerald-400 font-bold leading-tight">المتوسط</div>
        </div>
        <div className="flex flex-col items-center">
          <div className="bg-amber-400 text-amber-950 text-lg font-mono font-black px-4 py-0.5 rounded-full shadow-sm">{myScore ?? '—'}</div>
          <div className="text-[10px] text-gray-500 dark:text-emerald-400 font-bold leading-tight mt-0.5">نقاطك</div>
        </div>
        <div>
          <div className="text-base font-black text-gray-900 dark:text-white font-mono">{high}</div>
          <div className="text-[10px] text-gray-500 dark:text-emerald-400 font-bold leading-tight">الأعلى</div>
        </div>
      </InfoCard>

      {viceTookOver && mySq && (
        <p className="text-[11px] font-bold text-center text-violet-600 dark:text-violet-300">
          الكابتن ({players[mySq.cap]?.name}) ما لعبش، فالـ x2 راحت لنائب الكابتن ({players[doubledId]?.name})
        </p>
      )}

      {mySq ? (
        <>
          <GreenPitch>
            {POS_ORDER.map((pos) => (
              <PitchRow key={pos}>{startersByPos[pos].map((id) => card(id))}</PitchRow>
            ))}
          </GreenPitch>
          {(mySq.bench?.length ?? 0) > 0 && <BenchPanel>{(mySq.bench ?? []).map((id) => card(id, true))}</BenchPanel>}
        </>
      ) : (
        <InfoCard className="text-center text-sm font-bold text-gray-500 dark:text-emerald-400 py-8">مفيش تشكيلة محفوظة ليك للجولة دي</InfoCard>
      )}
      {detailId && mySq && players[detailId] && (() => {
        const p = players[detailId];
        const lines = playerPointsBreakdown(p, stats[detailId]);
        const raw = calculatePlayerRoundPoints(p, stats[detailId]);
        const doubled = detailId === doubledId;
        const sub = subs.find((x) => x.inId === detailId || x.outId === detailId);
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={() => setDetailId(null)}>
            <div className="w-full max-w-md bg-white dark:bg-[#0f1f16] rounded-t-3xl p-4 space-y-3 border-t border-emerald-800" dir="rtl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-black text-gray-900 dark:text-white">{p.name}</div>
                  <div className="text-[11px] text-gray-500 dark:text-emerald-400">{teams[p.teamId]?.name} • {POSITIONS_SHORT[p.pos]} • الجولة {round}</div>
                </div>
                <button type="button" onClick={() => setDetailId(null)} className="text-gray-500 dark:text-emerald-300 text-xl px-2">✕</button>
              </div>
              {lines.length === 0 ? (
                <p className="text-sm font-bold text-gray-600 dark:text-emerald-300 text-center py-4">ما لعبش في الجولة دي، فمفيش نقاط</p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-emerald-900/50">
                  {lines.map((l) => (
                    <div key={l.label} className="flex items-center justify-between py-1.5 text-sm">
                      <span className="font-bold text-gray-800 dark:text-emerald-100">{l.label}{l.count > 1 || l.label === 'قطع كرات' ? ` ×${l.count}` : ''}</span>
                      <span className={`font-mono font-black ${l.pts < 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>{l.pts > 0 ? `+${l.pts}` : l.pts}</span>
                    </div>
                  ))}
                  {doubled && (
                    <div className="flex items-center justify-between py-1.5 text-sm">
                      <span className="font-bold text-amber-600 dark:text-amber-300">{detailId === mySq.cap ? 'الكابتن x2' : 'نائب الكابتن x2'}</span>
                      <span className="font-mono font-black text-amber-600 dark:text-amber-300">+{raw}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 text-base">
                    <span className="font-black text-gray-900 dark:text-white">الإجمالي</span>
                    <span className="font-mono font-black text-gray-900 dark:text-white">{doubled ? raw * 2 : raw}</span>
                  </div>
                </div>
              )}
              {sub && (
                <p className="text-[11px] font-bold text-violet-600 dark:text-violet-300 text-center">
                  {sub.inId === detailId ? `دخل مكان ${players[sub.outId]?.name} (ما لعبش)` : `اتبدّل بـ ${players[sub.inId]?.name} (لأنه ما لعبش)`}
                </p>
              )}
            </div>
          </div>
        );
      })()}
    </ScreenShell>
  );
};
