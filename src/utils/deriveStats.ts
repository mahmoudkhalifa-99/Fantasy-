// حساب إحصائيات اللاعبين تلقائيًا من المباريات (مصدر الحقيقة = المباريات):
// أهداف/صناعات/كروت/جزاءات من أحداث المباراة، رجل المباراة، الكلين شيت، والمشاركة.
// بتشتغل على السيرفر (عند حفظ المباريات) وعلى الجهاز (للتسجيل المباشر).
import type { Match, Player, PlayerMatchStats } from '../types';

type RoundStats = Record<string, PlayerMatchStats>;
type AllStats = Record<number, { p: RoundStats } & Record<string, any>>;

const norm = (s?: string) => String(s ?? '').replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
const sameName = (a: string, b: string) => !!a && !!b && (a === b || (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))));

function findPlayer(list: Player[], rawName: string): Player | undefined {
  const n = norm(rawName);
  return list.find((p) => norm(p.name) === n) || list.find((p) => sameName(norm(p.name), n));
}

export function deriveRoundStats(
  round: number,
  matches: Record<string, Match>,
  players: Record<string, Player>,
  existing: RoundStats = {}
): RoundStats {
  const roundMatches = Object.values(matches).filter((m) => m.round === round);
  if (!roundMatches.length) return existing;

  const all = Object.values(players);
  const byTeam = (tid: string) => all.filter((p) => p.teamId === tid);
  const out: RoundStats = { ...existing };

  // تصفير الإحصائيات المحسوبة للاعبي الفرق اللي عندها ماتش في الجولة دي
  for (const m of roundMatches)
    for (const tid of [m.teamAId, m.teamBId])
      for (const p of byTeam(tid)) out[p.id] = { ...(existing[p.id] || {}), pl: 0, g: 0, a: 0, yc: 0, rc: 0, og: 0, pm: 0, ps: 0, cs: 0, mo: 0 };

  const add = (id: string | undefined, f: keyof PlayerMatchStats, n = 1) => {
    if (!id || !out[id]) return;
    out[id] = { ...out[id], [f]: (Number(out[id][f]) || 0) + n, pl: 1 };
  };

  for (const m of roundMatches) {
    if (m.status === 'upcoming') continue;

    if (m.events?.length) {
      for (const e of m.events) {
        const p = players[e.playerId];
        if (!p || !out[p.id]) continue;
        if (e.type === 'goal') add(p.id, 'g');
        else if (e.type === 'og') add(p.id, 'og');
        else if (e.type === 'assist') add(p.id, 'a');
        else if (e.type === 'yc') {
          if ((out[p.id].yc || 0) < 2) add(p.id, 'yc');
        } else if (e.type === 'rc') {
          if ((out[p.id].rc || 0) < 1) add(p.id, 'rc');
        } else if (e.type === 'pm') add(p.id, 'pm');
        else if (e.type === 'ps' && p.pos === 'GK') add(p.id, 'ps');
      }
    } else {
      // مباريات اتسجلت بقائمة هدافين مكتوبة (من غير أحداث)
      const parse = (list: string[] | undefined, credited: string, other: string) => {
        for (const raw of list ?? []) {
          // علامة الهدف العكسي لازم تكون بين أقواس: (ع.م) أو (عكسي)
          const OG = /\(\s*(ع\.?\s?م\.?|هدف عكسي|عكسي)\s*\)/;
          const isOg = OG.test(raw);
          const cnt = /\((\d+)\)/.exec(raw);
          const n = cnt ? Math.max(1, parseInt(cnt[1], 10)) : 1;
          const name = raw.replace(OG, '');
          let p = findPlayer(byTeam(isOg ? other : credited), name);
          if (!p) {
            // الاسم مش في الفريق المتوقع: نقبله لو بيطابق لاعب واحد بس في الدورة كلها
            const hits = all.filter((x) => sameName(norm(x.name), norm(name)));
            if (hits.length === 1) p = hits[0];
          }
          if (p) add(p.id, isOg ? 'og' : 'g', n);
        }
      };
      parse(m.scorersA, m.teamAId, m.teamBId);
      parse(m.scorersB, m.teamBId, m.teamAId);
    }

    // رجل المباراة
    if (m.motmId) add(m.motmId, 'mo');
    else if (m.motm) {
      const p = findPlayer([...byTeam(m.teamAId), ...byTeam(m.teamBId)], m.motm);
      if (p) add(p.id, 'mo');
    }

    // المشاركة: القائمة المحددة، ولو الماتش خلص ومفيش قائمة نعتبر كل لاعبين الفريق لعبوا
    const sides: [string, string[] | undefined][] = [
      [m.teamAId, m.playedA],
      [m.teamBId, m.playedB],
    ];
    for (const [tid, list] of sides) {
      if (list?.length) {
        for (const id of list) if (out[id]) out[id] = { ...out[id], pl: 1 };
      } else if (m.status === 'finished') {
        for (const p of byTeam(tid)) out[p.id] = { ...out[p.id], pl: 1 };
      }
    }

    // الكلين شيت: لو الماتش خلص ومحدش دخل على فريقه
    if (m.status === 'finished' && typeof m.scoreA === 'number' && typeof m.scoreB === 'number') {
      const cleanFor: [string, number][] = [
        [m.teamAId, m.scoreB],
        [m.teamBId, m.scoreA],
      ];
      for (const [tid, conceded] of cleanFor)
        if (conceded === 0) for (const p of byTeam(tid)) if (out[p.id]?.pl) out[p.id] = { ...out[p.id], cs: 1 };
    }
  }
  return out;
}

/** بيحسب كل الجولات اللي فيها مباريات. */
export function deriveAllStats(matches: Record<string, Match> | undefined, players: Record<string, Player> | undefined, stats: AllStats | undefined): AllStats {
  const next: AllStats = { ...(stats || {}) };
  if (!matches || !players) return next;
  const rounds = new Set(Object.values(matches).map((m) => m.round));
  for (const r of rounds) next[r] = { ...(next[r] || {}), p: deriveRoundStats(r, matches, players, next[r]?.p || {}) } as any;
  return next;
}
