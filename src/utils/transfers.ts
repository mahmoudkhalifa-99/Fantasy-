// قواعد التحويلات (مشتركة بين الواجهة والسيرفر): تحويل مجاني واحد كل جولة، وكل تحويل زيادة بيتخصم منه نقاط.
// الكروت: Wildcard (مرة واحدة في الدورة) و Free Hit (مرة واحدة، والتشكيلة بترجع للي قبلها في الجولة اللي بعدها).
export const DEFAULT_FREE_TRANSFERS = 1;
export const DEFAULT_TRANSFER_PENALTY = 4;

export type ChipName = 'wildcard' | 'freehit';
type RoundsLike = Record<string | number, { ids: string[]; chip?: string; auto?: boolean } | undefined>;

export function transferRules(cfg: { freeTransfers?: number; transferPenalty?: number } | undefined) {
  const free = Number.isFinite(Number(cfg?.freeTransfers)) && cfg?.freeTransfers !== undefined ? Math.max(0, Number(cfg.freeTransfers)) : DEFAULT_FREE_TRANSFERS;
  const penalty =
    Number.isFinite(Number(cfg?.transferPenalty)) && cfg?.transferPenalty !== undefined ? Math.max(0, Number(cfg.transferPenalty)) : DEFAULT_TRANSFER_PENALTY;
  return { free, penalty };
}

/** تشكيلة الأساس اللي بنقارن بيها التحويلات: آخر جولة قبل جولة التعديل (من غير جولات Free Hit). */
export function findBaseSquad(rounds: RoundsLike | undefined, editRound: number): string[] | null {
  if (!rounds) return null;
  for (let r = editRound - 1; r >= 1; r--) {
    const sq = rounds[r];
    if (sq && sq.ids?.length && sq.chip !== 'freehit') return sq.ids;
  }
  return null;
}

/** الجولة اللي اتلعب فيها الكارت (غير جولة التعديل الحالية) أو null. */
export function chipUsedRound(rounds: RoundsLike | undefined, chip: ChipName, exceptRound: number): number | null {
  if (!rounds) return null;
  for (const [k, sq] of Object.entries(rounds)) {
    if (Number(k) !== exceptRound && sq && sq.chip === chip) return Number(k);
  }
  return null;
}

export function transferInfo(
  ids: string[],
  base: string[] | null,
  chip: ChipName | null | undefined,
  cfg: { freeTransfers?: number; transferPenalty?: number } | undefined
) {
  const { free, penalty } = transferRules(cfg);
  const made = base ? ids.filter((id) => !base.includes(id)).length : 0;
  if (!base || chip) return { made, free, penalty, freeLeft: Infinity, extra: 0, cost: 0, unlimited: true };
  const extra = Math.max(0, made - free);
  return { made, free, penalty, freeLeft: Math.max(0, free - made), extra, cost: extra * penalty, unlimited: false };
}

/**
 * الميزانية الفعلية للمشترك: زي الفانتازي، لو أسعار لاعبين تشكيلته زادت بعد الاختيار،
 * التشكيلة الحالية تفضل سليمة، والميزانية بتبقى الأكبر بين ميزانية الدورة وتكلفة تشكيلته الحالية بأسعار النهارده.
 */
export function effectiveBudget(
  budget: number,
  baseIds: string[] | null,
  players: Record<string, { price: number } | undefined>
): number {
  if (!baseIds || !baseIds.length) return budget;
  const cost = baseIds.reduce((sum, id) => sum + (Number(players[id]?.price) || 0), 0);
  return Math.max(Number(budget) || 0, cost);
}
