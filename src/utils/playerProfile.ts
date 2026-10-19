import { Entry, Match, Player, PlayerMatchStats, TournamentConfig } from '../types';
import { calculatePlayerRoundPoints } from './fantasyScoring';
import { deriveRoundStats } from './deriveStats';

export interface RoundLine {
  round: number;
  oppTeamId?: string;
  home?: boolean;
  score?: string; // "2-1" من وجهة نظر فريق اللاعب
  played: boolean;
  pts: number;
  stats: PlayerMatchStats;
}

export interface PlayerProfile {
  played: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  motm: number;
  yellow: number;
  red: number;
  ownGoals: number;
  penMissed: number;
  penSaved: number;
  total: number;
  avg: number;
  form: number; // متوسط آخر 3 جولات لعبها
  lines: RoundLine[];
  next: Match[]; // المباريات القادمة (الأقرب أولًا)
  selectedPct: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildPlayerProfile(
  player: Player,
  matches: Record<string, Match>,
  allRoundStats: Record<number, { p: Record<string, PlayerMatchStats> }>,
  entries?: Record<string, Entry>,
  cfg?: TournamentConfig
): PlayerProfile {
  const myMatches = Object.values(matches).filter((m) => m.teamAId === player.teamId || m.teamBId === player.teamId);
  const roundNums = Array.from(
    new Set([...Object.keys(allRoundStats).map(Number), ...myMatches.filter((m) => m.status !== 'upcoming').map((m) => m.round)])
  ).sort((a, b) => a - b);

  const lines: RoundLine[] = roundNums.map((r) => {
    const stats = allRoundStats[r]?.p?.[player.id] || {};
    const m = myMatches.find((x) => x.round === r);
    const home = m ? m.teamAId === player.teamId : undefined;
    let score: string | undefined;
    if (m && m.status !== 'upcoming' && m.scoreA != null && m.scoreB != null)
      score = home ? `${m.scoreA}-${m.scoreB}` : `${m.scoreB}-${m.scoreA}`;
    return {
      round: r,
      oppTeamId: m ? (home ? m.teamBId : m.teamAId) : undefined,
      home,
      score,
      played: !!stats.pl,
      pts: calculatePlayerRoundPoints(player, stats),
      stats,
    };
  });

  const playedLines = lines.filter((l) => l.played);
  const sum = (f: keyof PlayerMatchStats) => playedLines.reduce((a, l) => a + (Number(l.stats[f]) || 0), 0);
  const total = playedLines.reduce((a, l) => a + l.pts, 0);
  const last3 = playedLines.slice(-3);

  const next = myMatches
    .filter((m) => m.status !== 'finished')
    .sort((a, b) => a.round - b.round || String(a.date || '').localeCompare(String(b.date || '')));

  let selectedPct: number | null = null;
  if (entries && cfg) {
    const active = cfg.locked ? cfg.round + 1 : cfg.round;
    let withSquad = 0;
    let picked = 0;
    for (const e of Object.values(entries)) {
      let sq = e.rounds?.[active];
      if (!sq) for (let i = active - 1; i >= 1 && !sq; i--) sq = e.rounds?.[i];
      if (!sq?.ids) continue;
      withSquad++;
      if (sq.ids.includes(player.id)) picked++;
    }
    selectedPct = withSquad ? round1((picked / withSquad) * 100) : 0;
  }

  return {
    played: playedLines.length,
    goals: sum('g'),
    assists: sum('a'),
    cleanSheets: sum('cs'),
    motm: sum('mo'),
    yellow: sum('yc'),
    red: sum('rc'),
    ownGoals: sum('og'),
    penMissed: sum('pm'),
    penSaved: sum('ps'),
    total,
    avg: playedLines.length ? round1(total / playedLines.length) : 0,
    form: last3.length ? round1(last3.reduce((a, l) => a + l.pts, 0) / last3.length) : 0,
    lines,
    next,
    selectedPct,
  };
}

export interface MatchLine {
  match: Match;
  oppTeamId: string;
  home: boolean;
  score?: string; // من وجهة نظر فريق اللاعب
  result?: 'W' | 'D' | 'L';
  played: boolean;
  pts: number; // نقاط اللاعب في الماتش ده بالذات
}

/** آخر مباريات فريق اللاعب (نتيجة + نقاط اللاعب في كل ماتش) والمباريات الجاية. بيتحسب من أحداث كل ماتش لوحده. */
export function playerMatchTimeline(
  player: Player,
  matches: Record<string, Match>,
  allPlayers: Record<string, Player>,
  limit = 3
): { past: MatchLine[]; next: MatchLine[] } {
  const mine = Object.values(matches).filter((m) => m.teamAId === player.teamId || m.teamBId === player.teamId);
  const order = (a: Match, b: Match) =>
    a.round - b.round || (a.createdAt || 0) - (b.createdAt || 0) || `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`);
  const line = (m: Match): MatchLine => {
    const home = m.teamAId === player.teamId;
    const done = m.status !== 'upcoming' && m.scoreA != null && m.scoreB != null;
    const mine = home ? Number(m.scoreA) : Number(m.scoreB);
    const theirs = home ? Number(m.scoreB) : Number(m.scoreA);
    let pts = 0;
    let played = false;
    if (m.status !== 'upcoming') {
      const st = deriveRoundStats(m.round, { [m.id]: m }, { [player.id]: player, ...Object.fromEntries(Object.values(allPlayers).filter((p) => p.teamId === m.teamAId || p.teamId === m.teamBId).map((p) => [p.id, p])) }, {})[player.id];
      played = !!st?.pl;
      pts = calculatePlayerRoundPoints(player, st);
    }
    return {
      match: m,
      oppTeamId: home ? m.teamBId : m.teamAId,
      home,
      score: done ? `${mine}-${theirs}` : undefined,
      result: done ? (mine > theirs ? 'W' : mine < theirs ? 'L' : 'D') : undefined,
      played,
      pts,
    };
  };
  const past = mine.filter((m) => m.status === 'finished').sort(order).slice(-limit).map(line);
  const next = mine.filter((m) => m.status !== 'finished').sort(order).slice(0, limit).map(line);
  return { past, next };
}
