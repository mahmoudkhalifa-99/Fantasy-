// ترتيب المشتركين (الفانتازي): نقاط كل جولة + المجموع + المركز + حركة الترتيب عن الجولة اللي فاتت.
import type { Entry, Player, TournamentConfig } from '../types';
import { calculateSquadRoundPoints, roundPenalty } from './fantasyScoring';

export interface StandingRow {
  entry: Entry;
  total: number;
  byRound: Record<number, number>;
  gw: number; // نقاط الجولة الحالية
  rank: number;
  prevRank: number | null;
  move: number; // موجب = طلع، سالب = نزل، 0 = زي ما هو
}

export interface StandingsResult {
  rows: StandingRow[];
  gwRound: number;
  rounds: number[];
}

const byNameThenId = (a: Entry, b: Entry) => (a.name || '').localeCompare(b.name || '', 'ar') || a.id.localeCompare(b.id);

/** ترتيب تنافسي: نفس النقاط = نفس المركز (1،2،2،4). */
function rankOf(items: { id: string; score: number; entry: Entry }[]): Record<string, number> {
  const sorted = [...items].sort((a, b) => b.score - a.score || byNameThenId(a.entry, b.entry));
  const out: Record<string, number> = {};
  sorted.forEach((it, i) => {
    out[it.id] = i > 0 && sorted[i - 1].score === it.score ? out[sorted[i - 1].id] : i + 1;
  });
  return out;
}

export function computeStandings(
  entries: Record<string, Entry>,
  players: Record<string, Player>,
  allRoundStats: Record<number, { p: Record<string, any> }>,
  cfg: TournamentConfig
): StandingsResult {
  const rounds = Object.keys(allRoundStats)
    .map(Number)
    .sort((a, b) => a - b);
  const gwRound = rounds.includes(cfg.round) ? cfg.round : rounds[rounds.length - 1] ?? cfg.round;
  const latest = rounds[rounds.length - 1];

  const base = Object.values(entries).map((entry) => {
    const byRound: Record<number, number> = {};
    for (const r of rounds) {
      let sq = entry.rounds?.[r];
      if (!sq) for (let i = r - 1; i >= 1 && !sq; i--) sq = entry.rounds?.[i];
      byRound[r] = sq ? calculateSquadRoundPoints(sq.ids, sq.cap, players, allRoundStats[r]?.p || {}, sq.bench || []) - roundPenalty(entry.rounds, r) : 0;
    }
    const total = rounds.reduce((a, r) => a + byRound[r], 0);
    return { entry, byRound, total };
  });

  const nowRank = rankOf(base.map((b) => ({ id: b.entry.id, score: b.total, entry: b.entry })));
  const hasPrev = rounds.length > 1;
  const prevRank = hasPrev
    ? rankOf(base.map((b) => ({ id: b.entry.id, score: b.total - (b.byRound[latest] || 0), entry: b.entry })))
    : null;

  const rows: StandingRow[] = base
    .map((b) => ({
      entry: b.entry,
      total: b.total,
      byRound: b.byRound,
      gw: b.byRound[gwRound] || 0,
      rank: nowRank[b.entry.id],
      prevRank: prevRank ? prevRank[b.entry.id] : null,
      move: prevRank ? prevRank[b.entry.id] - nowRank[b.entry.id] : 0,
    }))
    .sort((a, b) => a.rank - b.rank || byNameThenId(a.entry, b.entry));

  return { rows, gwRound, rounds };
}
