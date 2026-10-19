// منطق التسجيل المباشر للمباراة: كل دالة بترجّع نسخة جديدة من المباراة وإحصائيات الجولة (من غير تعديل الأصل).
import { Match, MatchEvent, MatchEventType, Player, PlayerMatchStats } from '../types';

export type RoundPlayerStats = Record<string, PlayerMatchStats>;
export interface LiveState {
  match: Match;
  stats: RoundPlayerStats;
}

const num = (v: number | null | undefined) => (typeof v === 'number' && !isNaN(v) ? v : 0);

function bump(stats: RoundPlayerStats, id: string, field: keyof PlayerMatchStats, delta: number, max?: number): RoundPlayerStats {
  const cur = { ...(stats[id] || {}) } as PlayerMatchStats;
  let v = Math.max(0, num(cur[field]) + delta);
  if (max !== undefined) v = Math.min(max, v);
  (cur as any)[field] = v;
  if (delta > 0) cur.pl = 1;
  return { ...stats, [id]: cur };
}

const sideOf = (match: Match, player: Player): 'A' | 'B' | null =>
  player.teamId === match.teamAId ? 'A' : player.teamId === match.teamBId ? 'B' : null;

export function minuteOf(match: Match, ts: number): number {
  if (!match.startedAt) return 0;
  return Math.max(1, Math.floor((ts - match.startedAt) / 60000) + 1);
}

export function startMatch(match: Match): Match {
  return {
    ...match,
    status: 'live',
    scoreA: num(match.scoreA),
    scoreB: num(match.scoreB),
    startedAt: match.startedAt ?? Date.now(),
    scorersA: match.scorersA ?? [],
    scorersB: match.scorersB ?? [],
    events: match.events ?? [],
  };
}

export function applyEvent(
  { match, stats }: LiveState,
  players: Record<string, Player>,
  type: MatchEventType,
  playerId: string
): LiveState {
  const player = players[playerId];
  if (!player) return { match, stats };
  const side = sideOf(match, player);
  if (!side) return { match, stats };

  let m: Match = { ...match, scoreA: num(match.scoreA), scoreB: num(match.scoreB) };
  let s = stats;
  let ev: MatchEvent = { id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, type, playerId, ts: Date.now() };

  if (type === 'goal') {
    s = bump(s, playerId, 'g', 1);
    m = side === 'A'
      ? { ...m, scoreA: num(m.scoreA) + 1, scorersA: [...(m.scorersA ?? []), player.name] }
      : { ...m, scoreB: num(m.scoreB) + 1, scorersB: [...(m.scorersB ?? []), player.name] };
    ev.side = side;
  } else if (type === 'og') {
    s = bump(s, playerId, 'og', 1);
    const credit = side === 'A' ? 'B' : 'A';
    const label = `${player.name} (ع.م)`;
    m = credit === 'A'
      ? { ...m, scoreA: num(m.scoreA) + 1, scorersA: [...(m.scorersA ?? []), label] }
      : { ...m, scoreB: num(m.scoreB) + 1, scorersB: [...(m.scorersB ?? []), label] };
    ev.side = credit;
  } else if (type === 'assist') s = bump(s, playerId, 'a', 1);
  else if (type === 'yc') {
    if (num(s[playerId]?.yc) >= 2) return { match, stats };
    s = bump(s, playerId, 'yc', 1, 2);
  } else if (type === 'rc') {
    if (num(s[playerId]?.rc) >= 1) return { match, stats };
    s = bump(s, playerId, 'rc', 1, 1);
  } else if (type === 'pm') s = bump(s, playerId, 'pm', 1);
  else if (type === 'ps') {
    if (player.pos !== 'GK') return { match, stats };
    s = bump(s, playerId, 'ps', 1);
  } else if (type === 'tk') {
    if (player.pos !== 'DEF') return { match, stats };
    s = bump(s, playerId, 'tk', 1);
  }

  m.events = [...(match.events ?? []), ev];
  return { match: m, stats: s };
}

const removeLast = (list: string[] | undefined, name: string) => {
  const arr = [...(list ?? [])];
  const i = arr.lastIndexOf(name);
  if (i >= 0) arr.splice(i, 1);
  return arr;
};

export function undoLast(
  { match, stats }: LiveState,
  players: Record<string, Player>
): LiveState {
  const events = [...(match.events ?? [])];
  const ev = events.pop();
  if (!ev) return { match, stats };
  const player = players[ev.playerId];
  const name = player?.name ?? '';
  let m: Match = { ...match, events };
  let s = stats;

  if (ev.type === 'goal') {
    s = bump(s, ev.playerId, 'g', -1);
    if (ev.side === 'A') m = { ...m, scoreA: Math.max(0, num(m.scoreA) - 1), scorersA: removeLast(m.scorersA, name) };
    else m = { ...m, scoreB: Math.max(0, num(m.scoreB) - 1), scorersB: removeLast(m.scorersB, name) };
  } else if (ev.type === 'og') {
    s = bump(s, ev.playerId, 'og', -1);
    const label = `${name} (ع.م)`;
    if (ev.side === 'A') m = { ...m, scoreA: Math.max(0, num(m.scoreA) - 1), scorersA: removeLast(m.scorersA, label) };
    else m = { ...m, scoreB: Math.max(0, num(m.scoreB) - 1), scorersB: removeLast(m.scorersB, label) };
  } else if (ev.type === 'assist') s = bump(s, ev.playerId, 'a', -1);
  else if (ev.type === 'yc') s = bump(s, ev.playerId, 'yc', -1);
  else if (ev.type === 'rc') s = bump(s, ev.playerId, 'rc', -1);
  else if (ev.type === 'pm') s = bump(s, ev.playerId, 'pm', -1);
  else if (ev.type === 'ps') s = bump(s, ev.playerId, 'ps', -1);
  else if (ev.type === 'tk') s = bump(s, ev.playerId, 'tk', -1);

  return { match: m, stats: s };
}

/** تصحيح يدوي للنتيجة (من غير تسجيل هداف). */
export function adjustScore(match: Match, side: 'A' | 'B', delta: number): Match {
  const key = side === 'A' ? 'scoreA' : 'scoreB';
  return { ...match, [key]: Math.max(0, num(match[key]) + delta) };
}

export function togglePlayedMatch(match: Match, player: Player): Match {
  const key = player.teamId === match.teamAId ? 'playedA' : player.teamId === match.teamBId ? 'playedB' : null;
  if (!key) return match;
  const cur = match[key] ?? [];
  return { ...match, [key]: cur.includes(player.id) ? cur.filter((id) => id !== player.id) : [...cur, player.id] };
}

export function setTeamPlayedMatch(match: Match, players: Record<string, Player>, teamId: string, played: boolean): Match {
  const key = teamId === match.teamAId ? 'playedA' : teamId === match.teamBId ? 'playedB' : null;
  if (!key) return match;
  const ids = Object.values(players).filter((p) => p.teamId === teamId).map((p) => p.id);
  return { ...match, [key]: played ? ids : [] };
}

/** إنهاء المباراة: الكلين شيت لكل لاعب شارك في الفريق اللي ما اتدخلش عليه هدف + رجل المباراة. */
export function finishMatch(
  { match, stats }: LiveState,
  players: Record<string, Player>,
  motmId?: string
): LiveState {
  let s = { ...stats };
  const a = num(match.scoreA);
  const b = num(match.scoreB);
  for (const p of Object.values(players)) {
    const side = sideOf(match, p);
    if (!side || !s[p.id]?.pl) continue;
    const conceded = side === 'A' ? b : a;
    s[p.id] = { ...s[p.id], cs: conceded === 0 ? 1 : 0 };
  }
  if (match.motmId && match.motmId !== motmId && s[match.motmId]) s[match.motmId] = { ...s[match.motmId], mo: 0 };
  let motmName = match.motm;
  if (motmId && players[motmId]) {
    s[motmId] = { ...(s[motmId] || {}), pl: 1, mo: 1 };
    motmName = players[motmId].name;
  }
  return { match: { ...match, status: 'finished', motmId: motmId ?? match.motmId, motm: motmName }, stats: s };
}

export function reopenMatch(match: Match): Match {
  return { ...match, status: 'live' };
}
