import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, ChevronUp, Crown, Minus, ArrowUp, ArrowDown, Trophy } from 'lucide-react';
import type { Entry, Player, SquadSelection, Team, TournamentConfig } from '../types';
import { computeStandings } from '../utils/standings';
import { calculatePlayerRoundPoints, effectiveCaptain, POSITIONS_SHORT, POS_ORDER } from '../utils/fantasyScoring';

interface Props {
  entries: Record<string, Entry>;
  players: Record<string, Player>;
  teams?: Record<string, Team>;
  cfg: TournamentConfig;
  allRoundStats: Record<number, { p: Record<string, any> }>;
  currentUserId: string;
  onBack?: () => void; // لو موجود بنعرض صفحة كاملة بزر رجوع، وإلا بنعرضه جوه تبويب
}

const COLORS = ['#7c3aed', '#0ea5e9', '#16a34a', '#d97706', '#dc2626', '#0d9488', '#db2777', '#4f46e5'];
const colorOf = (id: string) => COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const initials = (name: string) => (name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('') || '؟').toUpperCase();

export const PLStandingsView: React.FC<Props> = ({ entries, players, teams = {}, cfg, allRoundStats, currentUserId, onBack }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const [lineupRound, setLineupRound] = useState<number | null>(null);
  const { rows, gwRound, rounds } = useMemo(() => computeStandings(entries, players, allRoundStats, cfg), [entries, players, allRoundStats, cfg]);
  const updatedAt = useMemo(
    () => new Date().toLocaleString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
    [entries, allRoundStats]
  );

  const me = rows.find((r) => r.entry.id === currentUserId);
  const leader = rows[0];
  const above = me ? [...rows].reverse().find((r) => r.rank < me.rank) : undefined;

  return (
    <div className="max-w-md mx-auto px-3.5 pt-3 pb-24 space-y-3 animate-in fade-in duration-200">
      {onBack && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-gray-100 dark:bg-emerald-950 border border-gray-200 dark:border-emerald-800 flex items-center justify-center text-gray-800 dark:text-emerald-200 cursor-pointer"
            aria-label="رجوع"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-lg font-black text-gray-900 dark:text-white font-['Lalezar',sans-serif] truncate">ترتيب المشتركين</h2>
            <p className="text-[11px] text-gray-500 dark:text-emerald-400 truncate">{cfg.name}</p>
          </div>
        </div>
      )}

      {/* بطاقة ترتيبك */}
      {me ? (
        <div className="rounded-3xl p-4 text-white bg-gradient-to-br from-[#38003c] via-[#4c1d95] to-[#0e7a4a] shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-white/70 font-bold">ترتيبك بين {rows.length} مشترك</div>
              <div className="text-5xl font-black font-mono leading-none mt-1">#{me.rank}</div>
              <div className="text-sm font-black mt-1 truncate">{me.entry.name}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center shrink-0">
              <div className="rounded-2xl bg-white/15 px-3 py-2">
                <div className="text-2xl font-black font-mono">{me.total}</div>
                <div className="text-[10px] text-white/80 font-bold">المجموع</div>
              </div>
              <div className="rounded-2xl bg-white/15 px-3 py-2">
                <div className="text-2xl font-black font-mono">{me.gw}</div>
                <div className="text-[10px] text-white/80 font-bold">الجولة {gwRound}</div>
              </div>
            </div>
          </div>
          <div className="mt-3 text-[11px] font-bold text-white/90 space-y-0.5">
            {me.rank === 1 ? (
              <div className="text-amber-300">👑 أنت المتصدر!</div>
            ) : (
              <>
                {leader && <div>متأخر عن المتصدر ({leader.entry.name}) بـ {leader.total - me.total} نقطة</div>}
                {above && above.rank !== leader?.rank && <div>الأعلى منك ({above.entry.name}) بفارق {above.total - me.total} نقطة</div>}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-4 bg-amber-50 dark:bg-amber-400/10 border border-amber-300/60 dark:border-amber-400/30 text-center text-xs font-bold text-amber-900 dark:text-amber-200">
          لسه ما سجلتش تشكيلتك. اختار لاعبينك واحفظ التشكيلة عشان تدخل الترتيب.
        </div>
      )}

      {/* الجدول */}
      <div className="rounded-3xl bg-white dark:bg-[#122218] border border-gray-200 dark:border-emerald-900/60 shadow-md overflow-hidden">
        <div className="px-4 pt-3 text-[11px] text-gray-500 dark:text-emerald-400">
          آخر تحديث: <b className="text-gray-800 dark:text-emerald-200">{updatedAt}</b>
        </div>
        <div className="grid grid-cols-[44px_1fr_46px_56px] gap-1 px-3 pt-3 pb-2 text-[11px] font-black text-gray-500 dark:text-emerald-400">
          <span className="text-center">المركز</span>
          <span>الفريق</span>
          <span className="text-center">ج{gwRound}</span>
          <span className="text-center">المجموع</span>
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-emerald-400">
            <Trophy className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="font-bold text-sm">لا يوجد مشاركون حتى الآن</p>
            <p className="text-xs mt-1">سجّل تشكيلتك لتكون أول المتصدرين!</p>
          </div>
        ) : (
          rows.map((r) => {
            const isMe = r.entry.id === currentUserId;
            const open = openId === r.entry.id;
            return (
              <div key={r.entry.id} className={isMe ? 'bg-amber-50 dark:bg-amber-400/10' : ''}>
                <button
                  type="button"
                  onClick={() => { setOpenId(open ? null : r.entry.id); setLineupRound(null); }}
                  className="w-full grid grid-cols-[44px_1fr_46px_56px] gap-1 items-center px-3 py-3 border-t border-gray-100 dark:border-emerald-900/50 text-right cursor-pointer"
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-sm font-black font-mono text-gray-900 dark:text-white flex items-center gap-0.5">
                      {r.rank === 1 && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                      {r.rank}
                    </span>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-white ${
                        r.move > 0 ? 'bg-green-600' : r.move < 0 ? 'bg-red-600' : 'bg-gray-300 dark:bg-emerald-900'
                      }`}
                    >
                      {r.move > 0 ? <ArrowUp className="w-3 h-3" /> : r.move < 0 ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-black"
                      style={{ background: colorOf(r.entry.id) }}
                    >
                      {initials(r.entry.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-gray-900 dark:text-white truncate">
                        {r.entry.name}
                        {isMe && <span className="mr-1 text-[10px] text-amber-600 dark:text-amber-300 font-black">(أنت)</span>}
                      </span>
                      {r.move !== 0 && (
                        <span className={`block text-[10px] font-bold ${r.move > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {r.move > 0 ? `طلع ${r.move}` : `نزل ${-r.move}`}
                        </span>
                      )}
                    </span>
                  </div>

                  <span className="text-center text-sm font-mono text-gray-700 dark:text-emerald-200">{r.gw}</span>
                  <span className="text-center text-base font-black font-mono text-gray-900 dark:text-white flex items-center justify-center gap-0.5">
                    {r.total}
                    {open ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                  </span>
                </button>

                {open && (() => {
                  if (rounds.length === 0) {
                    return <div className="px-4 pb-3"><span className="text-[11px] text-gray-500 dark:text-emerald-400">لسه مفيش جولات اتلعبت</span></div>;
                  }
                  const selR = lineupRound !== null && rounds.includes(lineupRound) ? lineupRound : gwRound;
                  // نفس منطق الحساب: لو الجولة مفيهاش تشكيلة محفوظة بنستخدم آخر تشكيلة قبلها
                  let sq: SquadSelection | undefined = r.entry.rounds?.[selR];
                  for (let i = selR - 1; i >= 1 && !sq; i--) sq = r.entry.rounds?.[i];
                  const stats = allRoundStats[selR]?.p || {};
                  const ids = sq?.ids ?? [];
                  const sorted = [...ids].sort((a, b) => POS_ORDER.indexOf(players[a]?.pos) - POS_ORDER.indexOf(players[b]?.pos));
                  const row = (pid: string, bench = false) => {
                    const pl = players[pid];
                    if (!pl) return null;
                    const isCap = sq?.cap === pid;
                    const isVice = !!sq?.vice && sq.vice === pid && !isCap;
                    const doubled = !!sq && pid === effectiveCaptain(sq.cap, sq.vice, stats);
                    const pts = calculatePlayerRoundPoints(pl, stats[pid]);
                    return (
                      <div key={pid} className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 ${bench ? 'bg-gray-50 dark:bg-emerald-950/60' : 'bg-gray-100 dark:bg-emerald-950'}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-black text-amber-600 dark:text-amber-300 w-7 shrink-0">{POSITIONS_SHORT[pl.pos]}</span>
                          <span className="text-xs font-bold text-gray-900 dark:text-white truncate">{pl.name}</span>
                          {isCap && <span className="bg-amber-400 text-amber-950 text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center shrink-0">C</span>}
                          {isVice && <span className="bg-slate-200 text-slate-900 text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center shrink-0">V</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-gray-500 dark:text-emerald-400 truncate max-w-[70px]">{teams[pl.teamId]?.name ?? ''}</span>
                          <span className="text-xs font-black font-mono text-gray-900 dark:text-white w-8 text-center">{doubled ? pts * 2 : pts}</span>
                        </div>
                      </div>
                    );
                  };
                  return (
                    <div className="px-3 pb-3 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {rounds.map((rd) => (
                          <button
                            key={rd}
                            type="button"
                            onClick={() => setLineupRound(rd)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${rd === selR ? 'bg-amber-400 text-amber-950' : 'bg-gray-100 dark:bg-emerald-950 text-gray-700 dark:text-emerald-200'}`}
                          >
                            ج{rd}: <b className="font-mono">{r.byRound[rd] ?? 0}</b>
                          </button>
                        ))}
                      </div>
                      {!sq || ids.length === 0 ? (
                        <p className="text-[11px] font-bold text-gray-500 dark:text-emerald-400 py-1">
                          {isMe ? 'لسه ما حفظتش تشكيلة للجولة دي.' : 'مفيش تشكيلة ظاهرة للجولة دي لسه. التشكيلات بتظهر للكل أول ما أول ماتش يبدأ.'}
                        </p>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-x-3 text-[11px] text-gray-500 dark:text-emerald-400">
                            {sq.form && <span>الخطة: <b className="text-gray-900 dark:text-white" dir="ltr">{sq.form}</b></span>}
                            {sq.chip && <span>الكارت: <b className="text-gray-900 dark:text-white">{sq.chip === 'wildcard' ? 'Wildcard' : 'Free Hit'}</b></span>}
                            {sq.pen ? <span>الخصم: <b className="text-red-500">-{sq.pen}</b></span> : null}
                          </div>
                          <div className="space-y-1">{sorted.map((pid) => row(pid))}</div>
                          {sq.bench && sq.bench.length > 0 && (
                            <div className="space-y-1">
                              <div className="text-[11px] font-black text-gray-500 dark:text-emerald-400">الدكة</div>
                              {sq.bench.map((pid) => row(pid, true))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })
        )}
      </div>

      <p className="text-center text-[10px] text-gray-400 dark:text-emerald-600">
        النقاط بتتحدّث تلقائي مع كل ماتش • فرق التحويلات الزايدة بيتخصم من نقاط الجولة
      </p>
    </div>
  );
};
