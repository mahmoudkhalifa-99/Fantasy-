import React, { useEffect, useState } from 'react';
import { Match, MatchEventType, Player, PlayerMatchStats, Team } from '../types';
import {
  LiveState,
  RoundPlayerStats,
  adjustScore,
  applyEvent,
  finishMatch,
  minuteOf,
  reopenMatch,
  setTeamPlayedMatch,
  startMatch,
  togglePlayedMatch,
  undoLast,
} from '../utils/liveMatch';

type Mutator = (s: LiveState) => LiveState;

interface Props {
  matches: Record<string, Match>;
  teams: Record<string, Team>;
  players: Record<string, Player>;
  allRoundStats: Record<number, { p: Record<string, PlayerMatchStats> }>;
  bookingStats?: { p: Record<string, PlayerMatchStats> };
  onLiveUpdate: (matchId: string, fn: Mutator) => void;
}

const ACTIONS: { type: MatchEventType; label: string; icon: string; cls: string }[] = [
  { type: 'goal', label: 'هدف', icon: '⚽', cls: 'bg-emerald-600' },
  { type: 'assist', label: 'صناعة', icon: '👟', cls: 'bg-sky-600' },
  { type: 'yc', label: 'أصفر', icon: '🟨', cls: 'bg-yellow-500 text-black' },
  { type: 'rc', label: 'أحمر', icon: '🟥', cls: 'bg-red-600' },
  { type: 'og', label: 'عكسي', icon: '🥅', cls: 'bg-orange-600' },
  { type: 'pm', label: 'جزاء ضايع', icon: '❌', cls: 'bg-rose-700' },
  { type: 'ps', label: 'تصدي جزاء', icon: '🧤', cls: 'bg-teal-600' },
];
const ICON: Record<string, string> = Object.fromEntries(ACTIONS.map((a) => [a.type, a.icon]));
const LABEL: Record<string, string> = Object.fromEntries(ACTIONS.map((a) => [a.type, a.label]));

export const LiveMatchConsole: React.FC<Props> = ({ matches, teams, players, allRoundStats, bookingStats, onLiveUpdate }) => {
  const list = Object.values(matches).sort((a, b) => {
    const o = { live: 0, upcoming: 1, finished: 2 } as const;
    return o[a.status] - o[b.status] || a.round - b.round;
  });
  const [selId, setSelId] = useState<string>(() => list.find((m) => m.status === 'live')?.id || list.find((m) => m.status === 'upcoming')?.id || list[0]?.id || '');
  const [action, setAction] = useState<MatchEventType>('goal');
  const [assistFor, setAssistFor] = useState<{ teamId: string; scorerId: string } | null>(null);
  const [showAttendance, setShowAttendance] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [motmId, setMotmId] = useState('');
  const [stayId, setStayId] = useState('');
  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 20000);
    return () => clearInterval(t);
  }, []);

  // لو المباريات اتحمّلت بعد فتح الشاشة (أو المباراة المختارة اتمسحت) اختار أنسب مباراة تلقائيًا
  useEffect(() => {
    if (!selId || !matches[selId]) {
      const next = list.find((m) => m.status === 'live')?.id || list.find((m) => m.status === 'upcoming')?.id || list[0]?.id || '';
      if (next !== selId) setSelId(next);
    } else if (matches[selId].booking && matches[selId].status === 'finished') {
      // الحجز: بعد ما المباراة تخلص نروح للمباراة الجاية تلقائيًا
      const nxt = list.find((m) => m.booking && m.status !== 'finished');
      if (nxt) setSelId(nxt.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches]);

  const match = matches[selId];

  const MatchPicker = (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {list.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => {
            setSelId(m.id);
            setFinishing(false);
            setAssistFor(null);
          }}
          className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold border ${
            selId === m.id ? 'bg-amber-400 text-amber-950 border-amber-300' : 'bg-[#0a140f] text-emerald-200 border-emerald-800/60'
          }`}
        >
          {m.status === 'live' && <span className="text-red-500 animate-pulse">● </span>}
          {teams[m.teamAId]?.name} × {teams[m.teamBId]?.name}
          <span className="opacity-70"> · ج{m.round}</span>
        </button>
      ))}
    </div>
  );

  if (!match) {
    return (
      <div className="bg-[#122218] border border-emerald-700/40 rounded-2xl p-6 text-center text-emerald-300 text-sm">
        مفيش مباريات متضافة لسه. ضيف مباراة من تبويب "جدول المباريات" الأول.
      </div>
    );
  }

  const tA = teams[match.teamAId];
  const tB = teams[match.teamBId];
  const stats: RoundPlayerStats = (match.booking ? bookingStats?.p : allRoundStats[match.round]?.p) || {};
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const run = (fn: Mutator) => onLiveUpdate(match.id, fn);
  const teamPlayers = (teamId: string) => Object.values(players).filter((p) => p.teamId === teamId);
  const minute = isLive ? minuteOf(match, Date.now()) : 0;
  const events = [...(match.events ?? [])].reverse();

  const onPlayerTap = (p: Player) => {
    if (!isLive) return;
    run((s) => applyEvent(s, players, action, p.id));
    if (action === 'goal') setAssistFor({ teamId: p.teamId, scorerId: p.id });
    else setAssistFor(null);
  };

  const badges = (id: string) => {
    const s = stats[id] || {};
    return [s.g ? `⚽${s.g}` : '', s.a ? `👟${s.a}` : '', s.yc ? '🟨'.repeat(s.yc) : '', s.rc ? '🟥' : '', s.og ? `🥅${s.og}` : '']
      .filter(Boolean)
      .join(' ');
  };

  const PlayerCol = ({ team }: { team?: Team }) => (
    <div className="flex-1 min-w-0 space-y-1.5">
      <div className="text-center text-xs font-black text-amber-300 truncate">{team?.name}</div>
      {team &&
        teamPlayers(team.id).map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={!isLive}
            onClick={() => onPlayerTap(p)}
            className={`w-full text-right px-2 py-2.5 rounded-xl border text-xs active:scale-95 transition disabled:opacity-40 ${
              stats[p.id]?.pl ? 'bg-emerald-900/40 border-emerald-600/60' : 'bg-[#0a140f] border-emerald-800/50'
            }`}
          >
            <div className="font-bold text-white truncate">
              {p.num ? <span className="text-emerald-400 font-mono">{p.num} </span> : null}
              {p.name}
            </div>
            <div className="text-[10px] text-emerald-400 min-h-[14px]">{badges(p.id)}</div>
          </button>
        ))}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="bg-[#122218] border border-emerald-700/40 rounded-2xl p-3 shadow-xl space-y-3">
        {MatchPicker}

        {/* Scoreboard */}
        <div className="bg-[#0a140f] border border-emerald-800/60 rounded-2xl p-4">
          <div className="flex items-center justify-between text-[11px] mb-2">
            <span className="text-emerald-400 font-bold">ج{match.round}</span>
            {isLive && <span className="text-red-500 font-black animate-pulse">● مباشر {minute ? `· د ${minute}` : ''}</span>}
            {match.status === 'upcoming' && <span className="text-amber-300 font-bold">لسه ما بدأتش</span>}
            {isFinished && <span className="text-emerald-300 font-bold">انتهت ✓</span>}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 text-center">
              <div className="text-sm font-black text-white truncate">{tA?.name}</div>
              {isLive && (
                <div className="flex justify-center gap-2 mt-1">
                  <button type="button" onClick={() => run((s) => ({ ...s, match: adjustScore(s.match, 'A', -1) }))} className="w-7 h-7 rounded-lg bg-emerald-950 text-emerald-300 text-lg leading-none">−</button>
                  <button type="button" onClick={() => run((s) => ({ ...s, match: adjustScore(s.match, 'A', 1) }))} className="w-7 h-7 rounded-lg bg-emerald-950 text-emerald-300 text-lg leading-none">+</button>
                </div>
              )}
            </div>
            <div className="text-5xl font-black text-white font-mono tabular-nums" dir="ltr">
              {match.scoreA ?? 0} - {match.scoreB ?? 0}
            </div>
            <div className="flex-1 text-center">
              <div className="text-sm font-black text-white truncate">{tB?.name}</div>
              {isLive && (
                <div className="flex justify-center gap-2 mt-1">
                  <button type="button" onClick={() => run((s) => ({ ...s, match: adjustScore(s.match, 'B', -1) }))} className="w-7 h-7 rounded-lg bg-emerald-950 text-emerald-300 text-lg leading-none">−</button>
                  <button type="button" onClick={() => run((s) => ({ ...s, match: adjustScore(s.match, 'B', 1) }))} className="w-7 h-7 rounded-lg bg-emerald-950 text-emerald-300 text-lg leading-none">+</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Start / finish controls */}
        {match.status === 'upcoming' && (
          <button type="button" onClick={() => run((s) => ({ ...s, match: startMatch(s.match) }))} className="w-full py-3 rounded-xl bg-red-600 text-white font-black text-base">
            ▶ ابدأ المباراة (بث مباشر)
          </button>
        )}
        {isFinished && (
          <button type="button" onClick={() => run((s) => ({ ...s, match: reopenMatch(s.match) }))} className="w-full py-2.5 rounded-xl bg-amber-500/20 text-amber-300 font-bold text-sm">
            ↩ إعادة فتح المباراة للتعديل
          </button>
        )}
      </div>

      {isLive && (
        <>
          {/* Action selector */}
          <div className="bg-[#122218] border border-emerald-700/40 rounded-2xl p-3 shadow-xl space-y-2">
            <div className="text-[11px] text-emerald-300 font-bold">1) اختار الحدث، 2) دوس على اللاعب</div>
            <div className="grid grid-cols-4 gap-1.5">
              {ACTIONS.map((a) => (
                <button
                  key={a.type}
                  type="button"
                  onClick={() => setAction(a.type)}
                  className={`py-2 rounded-xl text-[11px] font-black border-2 transition ${a.cls} ${
                    action === a.type ? 'border-white scale-105 shadow-lg' : 'border-transparent opacity-60'
                  } ${a.type === 'yc' ? 'text-black' : 'text-white'}`}
                >
                  <div className="text-lg leading-none">{a.icon}</div>
                  {a.label}
                </button>
              ))}
            </div>

            {assistFor && (
              <div className="bg-sky-950/60 border border-sky-700/50 rounded-xl p-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-sky-200">⚽ اتسجل! مين صنع الهدف؟</span>
                  <button type="button" onClick={() => setAssistFor(null)} className="text-[11px] text-sky-300 underline">بدون صانع</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {teamPlayers(assistFor.teamId)
                    .filter((p) => p.id !== assistFor.scorerId)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          run((s) => applyEvent(s, players, 'assist', p.id));
                          setAssistFor(null);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-sky-700 text-white text-xs font-bold"
                      >
                        {p.name}
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 items-start">
              <PlayerCol team={tA} />
              <div className="w-px self-stretch bg-emerald-800/50" />
              <PlayerCol team={tB} />
            </div>
          </div>

          {/* Event log */}
          <div className="bg-[#122218] border border-emerald-700/40 rounded-2xl p-3 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-white">سجل الأحداث</span>
              <button
                type="button"
                disabled={!events.length}
                onClick={() => {
                  setAssistFor(null);
                  run((s) => undoLast(s, players));
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-bold disabled:opacity-30"
              >
                ↶ تراجع عن آخر حدث
              </button>
            </div>
            {events.length === 0 ? (
              <div className="text-[11px] text-emerald-500 text-center py-2">لسه مفيش أحداث</div>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {events.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 text-xs text-emerald-100 bg-[#0a140f] rounded-lg px-2 py-1.5">
                    <span className="font-mono text-emerald-500 w-8">{minuteOf(match, e.ts)}'</span>
                    <span>{ICON[e.type]}</span>
                    <span className="font-bold">{players[e.playerId]?.name}</span>
                    <span className="text-emerald-500">{LABEL[e.type]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attendance */}
          <div className="bg-[#122218] border border-emerald-700/40 rounded-2xl p-3 shadow-xl">
            <button type="button" onClick={() => setShowAttendance((v) => !v)} className="w-full flex justify-between text-xs font-black text-white">
              <span>👥 مين لعب؟ (لو ما حددتش، كل الفريق بيتحسب لما الماتش يخلص)</span>
              <span>{showAttendance ? '▲' : '▼'}</span>
            </button>
            {showAttendance && (
              <div className="mt-3 space-y-3">
                {[tA, tB].map(
                  (t) =>
                    t && (
                      <div key={t.id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-amber-300">{t.name}</span>
                          <span className="flex gap-2 text-[11px]">
                            <button type="button" onClick={() => run((s) => ({ ...s, match: setTeamPlayedMatch(s.match, players, t.id, true) }))} className="text-emerald-300 underline">الكل</button>
                            <button type="button" onClick={() => run((s) => ({ ...s, match: setTeamPlayedMatch(s.match, players, t.id, false) }))} className="text-red-300 underline">مسح</button>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {teamPlayers(t.id).map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => run((s) => ({ ...s, match: togglePlayedMatch(s.match, p) }))}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${
                                stats[p.id]?.pl ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-[#0a140f] text-emerald-400 border-emerald-800/60'
                              }`}
                            >
                              {stats[p.id]?.pl ? '✓ ' : ''}
                              {p.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                )}
              </div>
            )}
          </div>

          {/* Finish */}
          {!finishing ? (
            <button type="button" onClick={() => { setMotmId(match.motmId || ''); setStayId(match.stayerId || ''); setFinishing(true); }} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-black text-base">
              ⏹ إنهاء المباراة
            </button>
          ) : (
            <div className="bg-[#122218] border border-amber-500/50 rounded-2xl p-3 shadow-xl space-y-2">
              <div className="text-xs font-black text-amber-300">رجل المباراة (اختياري)</div>
              <select value={motmId} onChange={(e) => setMotmId(e.target.value)} className="w-full bg-[#0a140f] border border-emerald-800/60 rounded-lg p-2 text-sm text-white">
                <option value="">— من غير —</option>
                {[tA, tB].map((t) =>
                  t ? (
                    <optgroup key={t.id} label={t.name}>
                      {teamPlayers(t.id).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </optgroup>
                  ) : null
                )}
              </select>
              {match.booking && Number(match.scoreA) === Number(match.scoreB) && (
                <div className="space-y-1">
                  <div className="text-xs font-black text-amber-300">تعادل: مين يكمّل في الملعب؟</div>
                  <div className="flex gap-2">
                    {[match.teamAId, match.teamBId].map((tid) => (
                      <button
                        key={tid}
                        type="button"
                        onClick={() => setStayId(tid)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold border ${stayId === tid ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-[#0a140f] text-emerald-300 border-emerald-800/60'}`}
                      >
                        {teams[tid]?.name || ''}
                      </button>
                    ))}
                  </div>
                  <div className="text-[10px] text-emerald-500">لو ماختارتش: الفريق الأقدم في الملعب هو اللي بيخرج.</div>
                </div>
              )}
              <div className="text-[11px] text-emerald-400">هيتحسب الكلين شيت تلقائيًا للي شاركوا في الفريق اللي ما اتهزش.</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    run((s) => {
                      const fin = finishMatch(s, players, motmId || undefined);
                      return match.booking && stayId ? { ...fin, match: { ...fin.match, stayerId: stayId } } : fin;
                    });
                    setFinishing(false);
                    setAssistFor(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-sm"
                >
                  تأكيد الإنهاء
                </button>
                <button type="button" onClick={() => setFinishing(false)} className="px-4 py-2.5 rounded-xl bg-[#0a140f] text-emerald-300 font-bold text-sm">إلغاء</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
