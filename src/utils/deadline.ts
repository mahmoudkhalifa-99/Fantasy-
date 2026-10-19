// الديدلاين التلقائي: التشكيلة بتتقفل قبل أول ماتش في الجولة بـ 30 دقيقة (قابلة للتعديل من cfg.deadlineMinutes).
// مواعيد المباريات بتتكتب بتوقيت مصر (Africa/Cairo) بغض النظر عن توقيت السيرفر.
import type { Match, TournamentConfig } from '../types';

export const TZ = 'Africa/Cairo';
export const DEFAULT_DEADLINE_MINUTES = 30;

/** فرق التوقيت (بالدقايق) بين UTC وتوقيت مصر في لحظة معينة. */
function tzOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
  return Math.round((asUtc - utcMs) / 60000);
}

/** "2026-10-18" + "18:00" (توقيت مصر) → وقت بالميلي ثانية. */
export function matchStartMs(date?: string, time?: string): number | null {
  const toLatin = (s: string) => s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
  const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(toLatin(String(date ?? '')).trim());
  const raw = toLatin(String(time ?? '')).trim();
  const t = /^(\d{1,2})[:.](\d{2})/.exec(raw);
  if (!d || !t) return null;
  let h = +t[1];
  if (/م|pm/i.test(raw) && h < 12) h += 12; // 08:30 م = 20:30
  if (/ص|am/i.test(raw) && h === 12) h = 0;
  const guess = Date.UTC(+d[1], +d[2] - 1, +d[3], h, +t[2]);
  let ms = guess - tzOffsetMinutes(guess) * 60000;
  ms = guess - tzOffsetMinutes(ms) * 60000; // تصحيح عند حدود التوقيت الصيفي
  return ms;
}

/** موعد قفل جولة = أول ماتش ليه ميعاد في الجولة - الدقايق المحددة. */
export function roundDeadlineMs(matches: Record<string, Match> | undefined, round: number, cfg?: Partial<TournamentConfig>): number | null {
  const mins = Number(cfg?.deadlineMinutes ?? DEFAULT_DEADLINE_MINUTES);
  let first: number | null = null;
  for (const m of Object.values(matches ?? {})) {
    if (m.round !== round || m.booking) continue;
    const s = matchStartMs(m.date, m.time);
    if (s !== null && (first === null || s < first)) first = s;
  }
  return first === null ? null : first - (Number.isFinite(mins) ? mins : DEFAULT_DEADLINE_MINUTES) * 60000;
}

/** هل الجولة الحالية مقفولة؟ (قفل يدوي من المنظم، أو الديدلاين التلقائي عدّى، أو أي ماتش فيها بدأ). */
export function isRoundLocked(cfg: TournamentConfig, matches: Record<string, Match> | undefined, now = Date.now()): boolean {
  if (cfg.locked) return true;
  if (cfg.autoLock === false) return false;
  const dl = roundDeadlineMs(matches, cfg.round, cfg);
  if (dl !== null && now >= dl) return true;
  return Object.values(matches ?? {}).some((m) => m.round === cfg.round && !m.booking && m.status !== 'upcoming');
}

/** نص الموعد للعرض (بتوقيت مصر). */
export function formatDeadline(ms: number): string {
  return new Date(ms).toLocaleString('ar-EG', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
}
