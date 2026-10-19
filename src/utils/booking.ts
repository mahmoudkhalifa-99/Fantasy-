// وضع الحجز: 3 أو 4 فرق، الفايز بيفضل في الملعب، والمهزوم بيطلع وبيدخل الفريق اللي مستني بره.
// كل مباراة في الحجز هي Match عادي (علامة booking) فبتشتغل معاها لوحة التسجيل المباشر والإحصائيات زي أي ماتش.
import type { Match } from '../types';

export interface BookingSnapshot {
  onPitch: [string, string];
  queue: string[];
  streaks: Record<string, number>;
  champId?: string;
}

export interface BookingState extends BookingSnapshot {
  active: boolean;
  teamIds: string[]; // 3 أو 4 فرق
  round: number;
  startedAt: number;
  startAt?: number; // ميعاد أول ماتش في الحجز (ميلي ثانية)، منه بيتحسب ديدلاين التشكيلة
  currentMatchId?: string;
  history: { matchId: string; before: BookingSnapshot }[];
}

export const BOOKING_MIN_TEAMS = 3;
export const BOOKING_MAX_TEAMS = 4;
export const BOOKING_DEADLINE_MINUTES = 15; // التشكيلة بتتقفل قبل أول ماتش في الحجز بربع ساعة

/** موعد قفل تشكيلة الحجز (أو null لو المنظم ماحددش ميعاد أول ماتش). */
export function bookingDeadlineMs(b: { startAt?: number } | null | undefined): number | null {
  return b?.startAt ? b.startAt - BOOKING_DEADLINE_MINUTES * 60000 : null;
}

/** تشكيلة الحجز مقفولة لو الديدلاين عدّى أو أي ماتش حجز بدأ. */
export function isBookingLocked(b: { startAt?: number } | null | undefined, matches: Record<string, Match> | undefined, now = Date.now()): boolean {
  if (!b) return false;
  const dl = bookingDeadlineMs(b);
  if (dl !== null && now >= dl) return true;
  return Object.values(matches ?? {}).some((m) => m.booking && m.status !== 'upcoming');
}

export function createBooking(teamIds: string[], first: string, second: string, round: number, startAt?: number): BookingState | string {
  const ids = Array.from(new Set(teamIds));
  if (ids.length < BOOKING_MIN_TEAMS || ids.length > BOOKING_MAX_TEAMS) return `وضع الحجز من ${BOOKING_MIN_TEAMS} لـ ${BOOKING_MAX_TEAMS} فرق`;
  if (!first || !second || first === second) return 'اختار فريقين مختلفين يبدأوا اللعب';
  if (!ids.includes(first) || !ids.includes(second)) return 'الفريقين اللي هيبدأوا لازم يكونوا من الفرق المختارة';
  return {
    active: true,
    teamIds: ids,
    onPitch: [first, second],
    queue: ids.filter((t) => t !== first && t !== second),
    streaks: Object.fromEntries(ids.map((t) => [t, 0])),
    round,
    startedAt: Date.now(),
    ...(startAt ? { startAt } : {}),
    history: [],
  };
}

export function makeBookingMatch(b: BookingState, id: string): Match {
  return {
    id,
    round: b.round,
    teamAId: b.onPitch[0],
    teamBId: b.onPitch[1],
    scoreA: null,
    scoreB: null,
    date: new Date().toISOString().slice(0, 10),
    pitch: 'الحجز',
    status: 'upcoming',
    scorersA: [],
    scorersB: [],
    booking: true,
    createdAt: Date.now(),
  };
}

const snap = (b: BookingState): BookingSnapshot => ({
  onPitch: [...b.onPitch] as [string, string],
  queue: [...b.queue],
  streaks: { ...b.streaks },
  champId: b.champId,
});

/** مين فاز ومين خرج في المباراة دي (التعادل: اللي يختاره المنظم يكمّل، وإلا الفريق الأقدم في الملعب يخرج). */
export function outcomeOf(b: BookingState, m: Match): { stayId: string; leaveId: string; draw: boolean } {
  const a = Number(m.scoreA) || 0;
  const c = Number(m.scoreB) || 0;
  if (a !== c) return a > c ? { stayId: m.teamAId, leaveId: m.teamBId, draw: false } : { stayId: m.teamBId, leaveId: m.teamAId, draw: false };
  if (m.stayerId === m.teamAId) return { stayId: m.teamAId, leaveId: m.teamBId, draw: true };
  if (m.stayerId === m.teamBId) return { stayId: m.teamBId, leaveId: m.teamAId, draw: true };
  const leave = b.champId === m.teamAId || b.champId === m.teamBId ? b.champId! : m.teamBId;
  return { stayId: leave === m.teamAId ? m.teamBId : m.teamAId, leaveId: leave, draw: true };
}

/** بعد ما مباراة تخلص: الفايز يفضل، المهزوم يروح آخر الطابور، والأول في الطابور يدخل. */
export function advanceBooking(b: BookingState, finished: Match, nextId: string): { booking: BookingState; match: Match } {
  const before = snap(b);
  const { stayId, leaveId, draw } = outcomeOf(b, finished);
  const [entering, ...rest] = b.queue;
  const streaks = { ...b.streaks, [leaveId]: 0, [stayId]: draw ? b.streaks[stayId] || 0 : (b.streaks[stayId] || 0) + 1 };
  const next: BookingState = {
    ...b,
    onPitch: [stayId, entering],
    queue: [...rest, leaveId],
    streaks,
    champId: stayId,
    currentMatchId: nextId,
    history: [...b.history, { matchId: finished.id, before }],
  };
  return { booking: next, match: makeBookingMatch(next, nextId) };
}

/** التراجع عن إنهاء مباراة (لو المباراة اللي بعدها لسه ماتبدأتش). */
export function undoBooking(b: BookingState, matches: Record<string, Match>, matchId: string): { booking: BookingState; matches: Record<string, Match> } | null {
  const last = b.history[b.history.length - 1];
  if (!last || last.matchId !== matchId) return null;
  const nxt = b.currentMatchId ? matches[b.currentMatchId] : undefined;
  if (nxt && (nxt.status !== 'upcoming' || (nxt.events?.length ?? 0) > 0)) return null;
  const rest = { ...matches };
  if (b.currentMatchId) delete rest[b.currentMatchId];
  return {
    booking: { ...b, ...last.before, currentMatchId: matchId, history: b.history.slice(0, -1) },
    matches: rest,
  };
}

export interface BookingRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  streak: number;
  bestStreak: number;
}

/** إجماليات كل فريق من مباريات الحجز المنتهية. */
export function bookingTotals(matches: Record<string, Match>, b: BookingState | null | undefined): BookingRow[] {
  const ids = new Set<string>(b?.teamIds ?? []);
  const list = Object.values(matches)
    .filter((m) => m.booking && m.status === 'finished' && typeof m.scoreA === 'number' && typeof m.scoreB === 'number')
    .sort((x, y) => (x.createdAt || 0) - (y.createdAt || 0));
  list.forEach((m) => {
    ids.add(m.teamAId);
    ids.add(m.teamBId);
  });
  const rows: Record<string, BookingRow> = {};
  const run: Record<string, number> = {};
  ids.forEach((t) => {
    rows[t] = { teamId: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0, streak: 0, bestStreak: 0 };
    run[t] = 0;
  });
  for (const m of list) {
    const a = rows[m.teamAId];
    const c = rows[m.teamBId];
    const sa = m.scoreA as number;
    const sb = m.scoreB as number;
    a.played++; c.played++;
    a.gf += sa; a.ga += sb; c.gf += sb; c.ga += sa;
    if (sa > sb) { a.won++; a.pts += 3; c.lost++; run[m.teamAId]++; run[m.teamBId] = 0; }
    else if (sb > sa) { c.won++; c.pts += 3; a.lost++; run[m.teamBId]++; run[m.teamAId] = 0; }
    else { a.drawn++; c.drawn++; a.pts++; c.pts++; }
    rows[m.teamAId].bestStreak = Math.max(rows[m.teamAId].bestStreak, run[m.teamAId]);
    rows[m.teamBId].bestStreak = Math.max(rows[m.teamBId].bestStreak, run[m.teamBId]);
  }
  return Object.values(rows)
    .map((r) => ({ ...r, gd: r.gf - r.ga, streak: b?.streaks?.[r.teamId] ?? 0 }))
    .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf);
}
