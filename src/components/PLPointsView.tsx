import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import type { Entry, Player, Team, TournamentConfig, SquadSelection } from '../types';
import { PitchView } from './PitchView';
import { calculateSquadRoundPoints, getAutoSubs, roundPenalty } from '../utils/fantasyScoring';

interface Props {
  cfg: TournamentConfig;
  players: Record<string, Player>;
  teams: Record<string, Team>;
  entries: Record<string, Entry>;
  allRoundStats: Record<number, { p: Record<string, any> }>;
  currentUserId: string;
  bookingMode?: boolean;
  onBack: () => void;
  onOpenStandings?: () => void;
}

/** شاشة النقاط: عرض بس (من غير تعديل). نقاط كل لاعب في الجولة، الكابتن x2، والتبديلات التلقائية. */
export const PLPointsView: React.FC<Props> = ({ cfg, players, teams, entries, allRoundStats, currentUserId, bookingMode = false, onBack, onOpenStandings }) => {
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
    return sq ? calculateSquadRoundPoints(sq.ids, sq.cap, players, stats, sq.bench || []) - roundPenalty(e.rounds, round) : null;
  };

  const mine = entries[currentUserId];
  const mySq = squadOf(mine);
  const myScore = mine ? scoreOf(mine) : null;
  const all = Object.values(entries).map(scoreOf).filter((x): x is number => x !== null);
  const avg = all.length ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : 0;
  const high = all.length ? Math.max(...all) : 0;
  const pen = mine ? roundPenalty(mine.rounds, round) : 0;
  const subs = mySq ? getAutoSubs(mySq.ids, players, stats, mySq.bench || []) : [];

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
          <h2 className="text-lg font-black text-gray-900 dark:text-white font-['Lalezar',sans-serif] truncate">النقاط</h2>
          <p className="text-[11px] text-gray-500 dark:text-emerald-400 truncate">{bookingMode ? 'فانتازي الحجز' : `نقاط تشكيلتك في الجولة ${round}`}</p>
        </div>
      </div>

      {!bookingMode && rounds.length > 1 && (
        <div className="flex items-center justify-center gap-3 bg-gray-100 dark:bg-emerald-950 rounded-xl p-1.5">
          <button type="button" disabled={idx <= 0} onClick={() => setPicked(rounds[idx - 1])} className="p-1.5 disabled:opacity-30 text-gray-700 dark:text-emerald-200 cursor-pointer">
            <ChevronRight className="w-5 h-5" />
          </button>
          <span className="text-sm font-black text-gray-900 dark:text-amber-300 font-mono">الجولة {round}</span>
          <button type="button" disabled={idx >= rounds.length - 1} onClick={() => setPicked(rounds[idx + 1])} className="p-1.5 disabled:opacity-30 text-gray-700 dark:text-emerald-200 cursor-pointer">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-3 rounded-2xl bg-gray-100 dark:bg-emerald-950 border border-gray-200 dark:border-emerald-800">
          <div className="text-2xl font-black font-mono text-gray-900 dark:text-white">{avg}</div>
          <div className="text-[11px] font-bold text-gray-500 dark:text-emerald-400">المتوسط</div>
        </div>
        <div className="p-3 rounded-2xl bg-amber-400 text-amber-950 border-2 border-amber-500 shadow">
          <div className="text-3xl font-black font-mono leading-none">{myScore ?? '—'}</div>
          <div className="text-[11px] font-extrabold mt-1">نقاطك</div>
        </div>
        <div className="p-3 rounded-2xl bg-gray-100 dark:bg-emerald-950 border border-gray-200 dark:border-emerald-800">
          <div className="text-2xl font-black font-mono text-gray-900 dark:text-white">{high}</div>
          <div className="text-[11px] font-bold text-gray-500 dark:text-emerald-400">الأعلى</div>
        </div>
      </div>

      {pen > 0 && <p className="text-[11px] font-bold text-red-500 text-center">تم خصم {pen} نقطة تحويلات زيادة من نقاط الجولة</p>}

      {subs.length > 0 && (
        <div className="p-3 rounded-2xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 space-y-1">
          <div className="text-xs font-black text-violet-700 dark:text-violet-300">🔄 تبديلات تلقائية في الجولة</div>
          {subs.map((s) => (
            <div key={s.inId} className="text-[11px] text-gray-700 dark:text-emerald-200">
              دخل <b>{players[s.inId]?.name}</b> مكان <b>{players[s.outId]?.name}</b> (ما لعبش)
            </div>
          ))}
        </div>
      )}

      {mySq ? (
        <PitchView
          squadIds={mySq.ids}
          benchIds={mySq.bench || []}
          captainId={mySq.cap}
          formation={mySq.form || '2-2-2'}
          players={players}
          teams={teams}
          roundStats={stats}
          showPoints={true}
          isReadOnly={true}
        />
      ) : (
        <div className="p-8 text-center rounded-2xl bg-gray-100 dark:bg-emerald-950 text-gray-500 dark:text-emerald-400 text-sm font-bold">
          مفيش تشكيلة محفوظة ليك للجولة دي
        </div>
      )}

      {onOpenStandings && (
        <button
          type="button"
          onClick={onOpenStandings}
          className="w-full py-3 px-4 bg-amber-400 hover:bg-amber-300 text-amber-950 rounded-2xl font-black text-sm cursor-pointer"
        >
          🏆 ترتيب المشتركين
        </button>
      )}
    </div>
  );
};
