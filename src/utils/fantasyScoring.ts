import { Position, Player, PlayerMatchStats, TournamentConfig } from '../types';

export const POSITIONS_MAP: Record<Position, string> = {
  GK: 'حارس مرمى',
  DEF: 'مدافع',
  MID: 'خط وسط',
  FWD: 'مهاجم',
};

export const POSITIONS_SHORT: Record<Position, string> = {
  GK: 'حارس',
  DEF: 'دفاع',
  MID: 'وسط',
  FWD: 'هجوم',
};

export const POS_ORDER: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

export const SCORING_MATRIX = {
  app: 1, // played in match
  goal: {
    GK: 6,
    DEF: 6,
    MID: 5,
    FWD: 4,
  },
  assist: 3,
  cs: {
    GK: 4,
    DEF: 4,
    MID: 1,
    FWD: 0,
  },
  ps: 5, // penalty saved (GK)
  tk: { per: 2, pts: 1 }, // قطع الكرات (للمدافع بس): كل 2 قطع = +1 نقطة
  mo: 3, // man of the match
  yc: -1, // yellow card
  rc: -3, // red card
  og: -2, // own goal
  pm: -2, // penalty missed
};

export const SQUAD_SIZE = 7;

/** الدكة الاحتياطي: 3 لاعبين بالظبط (مدافع + وسط + مهاجم)، اختيارية. */
export const BENCH_POSITIONS: Position[] = ['DEF', 'MID', 'FWD'];
export const BENCH_SIZE = BENCH_POSITIONS.length;

export const SUPPORTED_FORMATIONS = ['2-2-2', '3-2-1', '2-3-1', '3-1-2', '2-1-3'];

export function parseFormation(f: string = '2-2-2'): Record<Position, number> {
  const parts = f.split('-').map(Number);
  return {
    GK: 1,
    DEF: parts[0] || 2,
    MID: parts[1] || 2,
    FWD: parts[2] || 2,
  };
}

export function calculatePlayerRoundPoints(
  player: Player | undefined,
  stats: PlayerMatchStats | undefined
): number {
  if (!player || !stats || !stats.pl) return 0;

  let total = SCORING_MATRIX.app;

  if (stats.g) total += stats.g * SCORING_MATRIX.goal[player.pos];
  if (stats.a) total += stats.a * SCORING_MATRIX.assist;
  if (stats.cs && player.pos !== 'FWD') total += SCORING_MATRIX.cs[player.pos]; // الكلين شيت للحارس والمدافع والوسط بس
  if (stats.ps && player.pos === 'GK') total += stats.ps * SCORING_MATRIX.ps;
  if (stats.tk && player.pos === 'DEF') total += Math.floor(stats.tk / SCORING_MATRIX.tk.per) * SCORING_MATRIX.tk.pts;
  if (stats.mo) total += SCORING_MATRIX.mo;
  if (stats.yc) total += stats.yc * SCORING_MATRIX.yc;
  if (stats.rc) total += stats.rc * SCORING_MATRIX.rc;
  if (stats.og) total += stats.og * SCORING_MATRIX.og;
  if (stats.pm) total += stats.pm * SCORING_MATRIX.pm;

  return total;
}

export function calculatePlayerTotalPoints(
  playerId: string,
  players: Record<string, Player>,
  allRoundStats: Record<number, { p: Record<string, PlayerMatchStats> }>
): number {
  const player = players[playerId];
  if (!player) return 0;

  let total = 0;
  for (const roundNum of Object.keys(allRoundStats)) {
    const roundDoc = allRoundStats[Number(roundNum)];
    if (roundDoc && roundDoc.p && roundDoc.p[playerId]) {
      total += calculatePlayerRoundPoints(player, roundDoc.p[playerId]);
    }
  }
  return total;
}

export function calculateSquadRoundPoints(
  squadIds: string[],
  captainId: string,
  players: Record<string, Player>,
  roundStats: Record<string, PlayerMatchStats> = {},
  benchIds: string[] = []
): number {
  let total = 0;
  for (const pid of squadIds) {
    const player = players[pid];
    const stats = roundStats[pid];
    const pts = calculatePlayerRoundPoints(player, stats);
    total += pid === captainId ? pts * 2 : pts;
  }
  // تبديل تلقائي: لو لاعب أساسي (غير الحارس) مالعبش، الاحتياطي في نفس مركزه ياخد مكانه لو لعب
  const usedStarters = new Set<string>();
  for (const bid of benchIds) {
    const b = players[bid];
    if (!b || b.pos === 'GK' || !roundStats[bid]?.pl) continue;
    const slot = squadIds.find((sid) => !usedStarters.has(sid) && players[sid]?.pos === b.pos && !roundStats[sid]?.pl);
    if (!slot) continue;
    usedStarters.add(slot);
    total += calculatePlayerRoundPoints(b, roundStats[bid]);
  }
  return total;
}

/** تحقق الدكة: لاعب واحد بالكتير من كل مركز (دفاع/وسط/هجوم)، من غير تكرار مع الأساسي. */
export function benchErrors(benchIds: string[], squadIds: string[], players: Record<string, Player>): string[] {
  const errors: string[] = [];
  if (benchIds.length > BENCH_SIZE) errors.push(`الدكة ${BENCH_SIZE} لاعبين بس`);
  const seen = new Set<string>();
  for (const id of benchIds) {
    const p = players[id];
    if (!p) continue;
    if (squadIds.includes(id) || seen.has(id)) {
      errors.push('لاعب مكرر بين الأساسي والاحتياطي');
      break;
    }
    seen.add(id);
  }
  const counts: Record<string, number> = {};
  for (const id of benchIds) {
    const p = players[id];
    if (!p) continue;
    if (!BENCH_POSITIONS.includes(p.pos)) {
      errors.push('الدكة: مدافع ووسط ومهاجم بس (من غير حارس)');
      break;
    }
    counts[p.pos] = (counts[p.pos] || 0) + 1;
  }
  if (Object.values(counts).some((n) => n > 1)) errors.push('الدكة: لاعب واحد بس من كل مركز');
  return errors;
}

export function validateSquad(
  squadIds: string[],
  captainId: string,
  players: Record<string, Player>,
  cfg: TournamentConfig,
  formation: string = '2-2-2',
  benchIds: string[] = []
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const reqForm = parseFormation(formation);
  const counts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  const teamCounts: Record<string, number> = {};
  let totalCost = 0;

  for (const pid of squadIds) {
    const p = players[pid];
    if (!p) continue;
    counts[p.pos] = (counts[p.pos] || 0) + 1;
    if (p.pos !== 'GK') teamCounts[p.teamId] = (teamCounts[p.teamId] || 0) + 1; // الحراس مستثنيين من الحد الأقصى للفريق
    totalCost += Number(p.price) || 0;
  }

  // الدكة بتتحسب في الميزانية وفي حد الفريق الواحد (الحراس مستثنيين)
  for (const bid of benchIds) {
    const bp = players[bid];
    if (!bp) continue;
    if (bp.pos !== 'GK') teamCounts[bp.teamId] = (teamCounts[bp.teamId] || 0) + 1;
    totalCost += Number(bp.price) || 0;
  }
  errors.push(...benchErrors(benchIds, squadIds, players));

  if (squadIds.length !== SQUAD_SIZE) {
    errors.push(`يجب اختيار ${SQUAD_SIZE} لاعبين بالتمام (اخترت ${squadIds.length})`);
  }

  if (totalCost > cfg.budget + 0.001) {
    errors.push(`تجاوزت الميزانية المحددة (${totalCost.toFixed(1)} / ${cfg.budget} م)`);
  }

  for (const pos of POS_ORDER) {
    if (counts[pos] !== reqForm[pos]) {
      errors.push(`مطلوب ${reqForm[pos]} ${POSITIONS_SHORT[pos]} حسب خطة ${formation}`);
    }
  }

  for (const [teamId, cnt] of Object.entries(teamCounts)) {
    if (cnt > cfg.maxPerTeam) {
      errors.push(`الحد الأقصى هو ${cfg.maxPerTeam} لاعبين من الفريق الواحد (الحراس مستثنيين)`);
      break;
    }
  }

  if (!captainId || !squadIds.includes(captainId)) {
    errors.push('يجب تحديد كابتن التشكيلة (C) لمضاعفة النقاط');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function formatStatText(stats?: PlayerMatchStats): string {
  if (!stats || !stats.pl) return 'لم يشارك';
  const parts: string[] = [];
  if (stats.g) parts.push(`⚽ ${stats.g} أهداف`);
  if (stats.a) parts.push(`👟 ${stats.a} صناعة`);
  if (stats.cs) parts.push('🧤 شباك نظيفة');
  if (stats.ps) parts.push(`🛡️ ${stats.ps} تصدي ركلة`);
  if (stats.mo) parts.push('⭐ رجل المباراة');
  if (stats.yc) parts.push(`🟨 ${stats.yc} إنذار`);
  if (stats.rc) parts.push('🟥 طرد');
  if (stats.og) parts.push(`⚠️ ${stats.og} هدف ذاتي`);
  if (stats.pm) parts.push(`❌ ${stats.pm} ركلة ضائعة`);
  return parts.length > 0 ? parts.join(' • ') : 'شارك في اللقاء';
}

/** النقاط المخصومة بسبب التحويلات الزايدة في الجولة دي (الجولة نفسها بس، مش الاحتياطي). */
export function roundPenalty(rounds: Record<number, any> | undefined, round: number): number {
  return Number(rounds?.[round]?.pen) || 0;
}
