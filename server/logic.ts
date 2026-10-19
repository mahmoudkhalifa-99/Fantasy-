// منطق السيرفر المشترك (التحقق + الصلاحيات). بيتستخدم في server.ts المحلي وفي api/ على Vercel.
import { createHash, timingSafeEqual } from 'node:crypto';
import { initialTournamentData } from './defaultData.js';
import { deriveAllStats, deriveBookingStats } from '../src/utils/deriveStats.js';
import { isRoundLocked } from '../src/utils/deadline.js';
import { isBookingLocked } from '../src/utils/booking.js';
import { chipUsedRound, effectiveBudget, findBaseSquad, transferInfo } from '../src/utils/transfers.js';

export type Data = Record<string, any>;

/** الحقول اللي المنظم بس يقدر يعدلها */
export const ADMIN_FIELDS = ['cfg', 'teams', 'players', 'matches', 'stats', 'topStories', 'booking', 'bstats'] as const;
const SQUAD_SIZE = 7;
const POS = ['GK', 'DEF', 'MID', 'FWD'] as const;

// ---------- التخزين (Firebase Firestore فقط) ----------
export interface Storage {
  getMain(): Promise<Data | null>;
  setMain(d: Data): Promise<void>;
  getEntries(): Promise<Record<string, Data>>;
  getEntry(uid: string): Promise<Data | null>;
  setEntry(uid: string, e: Data): Promise<void>;
  getOwner(uid: string): Promise<string | null>;
  setOwner(uid: string, hash: string): Promise<void>;
}

// ---------- الصلاحيات ----------
const sha = (s: string) => createHash('sha256').update(s).digest();

export function safeEqual(a: string, b: string) {
  return timingSafeEqual(sha(a), sha(b));
}

// ---------- دخول المنظم ----------
// المنظم الوحيد: khalifa@fantasy.com (ثابت في الكود، مفيش متغير بيضيف منظمين تانيين).
// الدخول بـ Firebase Authentication، والسيرفر بيتأكد من التوكن عند Firebase في كل طلب ويقارن الإيميل.
export const firebaseApiKey = () => process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || 'AIzaSyA2qxh_ogoG5WP2sDsm-HxdHNyNvf1R808';
export const ADMIN_EMAIL = 'khalifa@fantasy.com';
const isAdminEmail = (email: string | null | undefined) => String(email ?? '').trim().toLowerCase() === ADMIN_EMAIL;

export function adminConfigured() {
  return true;
}

const tokenCache = new Map<string, { email: string; uid: string; name: string; until: number }>();

export interface FbUser {
  uid: string;
  email: string;
  name: string;
}

/** بيتأكد من Firebase ID token ويرجّع صاحبه (أو null). */
export async function verifyBearer(idToken: string | null | undefined): Promise<FbUser | null> {
  if (!idToken) return null;
  const h = sha(idToken).toString('hex');
  const hit = tokenCache.get(h);
  if (hit && hit.until > Date.now()) return { uid: hit.uid, email: hit.email, name: hit.name };
  try {
    // لو الـ API Key مقيّد بـ HTTP referrers، بنبعت موقعك كـ Referer عشان طلب السيرفر يعدي
    const site = process.env.FIREBASE_REFERER || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '';
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey())}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(site ? { Referer: /^https?:/.test(site) ? site : `https://${site}/` } : {}) },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const u = json?.users?.[0];
    const uid = String(u?.localId ?? '');
    if (!uid) return null;
    if (u?.disabled) return null;
    const email = String(u?.email ?? '').toLowerCase();
    if (tokenCache.size > 500) tokenCache.clear();
    const name = String(u?.displayName ?? '').trim();
    tokenCache.set(h, { email, uid, name, until: Date.now() + 5 * 60 * 1000 });
    return { uid, email, name };
  } catch {
    return null;
  }
}

export interface AdminCreds {
  bearer?: string | null; // Firebase ID token
  key?: string | null; // مهمل (متوافق مع الاستدعاءات القديمة)
}

export async function resolveAdmin(creds: AdminCreds): Promise<boolean> {
  if (!creds.bearer) return false;
  const u = await verifyBearer(creds.bearer);
  return !!u && isAdminEmail(u.email);
}

export type AdminReason = 'not_configured' | 'no_token' | 'firebase_rejected' | 'not_allowed' | 'bad_key';

/** زي resolveAdmin بس بيقول السبب لو مش منظم (عشان رسالة واضحة في صفحة الدخول). */
export async function checkAdmin(creds: AdminCreds): Promise<{ ok: boolean; reason?: AdminReason; email?: string }> {
  if (!creds.bearer) return { ok: false, reason: 'no_token' };
  const u = await verifyBearer(creds.bearer);
  if (!u) return { ok: false, reason: 'firebase_rejected' };
  if (!isAdminEmail(u.email)) return { ok: false, reason: 'not_allowed', email: u.email };
  return { ok: true, email: u.email };
}

export function bearerOf(authorization: string | null | undefined): string | null {
  const m = /^Bearer\s+(.+)$/i.exec(authorization ?? '');
  return m ? m[1].trim() : null;
}

export const ownerHash = (token: string) => 'h:' + sha(token).toString('hex');

// ---------- البيانات ----------
function mainDefaults(saved: Data | null): Data {
  const { entries: _e, ...base } = initialTournamentData;
  const main: Data = { ...base, ...(saved ?? {}) };
  delete main.entries;
  delete main._owners;
  if (!main.matches || Object.keys(main.matches).length === 0) main.matches = base.matches;
  if (!main.topStories) main.topStories = base.topStories; // لو المنظم مسح كل الإعلانات منرجعهاش
  return main;
}

/** أول تشغيل: نحفظ البيانات الافتراضية. */
export async function loadMain(st: Storage): Promise<Data> {
  const saved = await st.getMain();
  const main = mainDefaults(saved);
  if (!saved) {
    await st.setMain(main);
    for (const [uid, e] of Object.entries(initialTournamentData.entries ?? {})) await st.setEntry(uid, e as Data);
  }
  return main;
}

// مشتركين تجريبيين كانوا بيتضافوا تلقائيًا في النسخ القديمة: بنخفيهم من الترتيب والإحصائيات
const DEMO_ENTRY_IDS = new Set(['user_captain_1', 'user_coach_2', 'user_player_3']);

/** اللي بيتبعت للمتصفح: أرقام الموبايل وجهات الاتصال للمنظم بس. */
export function publicView(main: Data, entries: Record<string, Data>, isAdmin: boolean): Data {
  const out: Data = { ...main, entries: {} };
  if (!isAdmin) delete out.contacts;
  for (const [uid, e] of Object.entries(entries)) {
    if (DEMO_ENTRY_IDS.has(uid)) continue;
    if (isAdmin) out.entries[uid] = e;
    else {
      const { phone: _p, email: _m, ...rest } = e;
      out.entries[uid] = rest;
    }
  }
  return out;
}

function validateSquad(sq: any, main: Data, budget: number): string | null {
  const ids = sq?.ids;
  if (!Array.isArray(ids) || ids.length !== SQUAD_SIZE) return `لازم تختار ${SQUAD_SIZE} لاعبين بالظبط`;
  if (new Set(ids).size !== ids.length) return 'لاعب متكرر في التشكيلة';
  const form = String(sq.form ?? '2-2-2').split('-').map(Number);
  if (form.length !== 3 || form.some((n) => !Number.isInteger(n) || n < 0) || form[0] + form[1] + form[2] !== SQUAD_SIZE - 1)
    return 'خطة اللعب غير صحيحة';
  const need: Record<string, number> = { GK: 1, DEF: form[0], MID: form[1], FWD: form[2] };
  const have: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  const perTeam: Record<string, number> = {};
  let cost = 0;
  for (const id of ids) {
    const p = typeof id === 'string' ? main.players?.[id] : null;
    if (!p) return 'لاعب غير موجود';
    have[p.pos] = (have[p.pos] ?? 0) + 1;
    if (p.pos !== 'GK') perTeam[p.teamId] = (perTeam[p.teamId] ?? 0) + 1; // الحراس مستثنيين من حد الفريق
    cost += Number(p.price) || 0;
  }
  if (cost > budget + 0.001) return 'تجاوزت الميزانية';
  if (POS.some((k) => have[k] !== need[k])) return 'التشكيلة لا تطابق خطة اللعب';
  if (Object.values(perTeam).some((n) => n > Number(main.cfg?.maxPerTeam))) return 'تجاوزت الحد الأقصى من نفس الفريق';
  if (!sq.cap || !ids.includes(sq.cap)) return 'حدد الكابتن';
  return null;
}

/** تحديث تشكيلة مشترك: بنقبل جولة التعديل الحالية بس، والجولات اللي بدأت بتفضل زي ما هي. السيرفر هو اللي بيحسب التحويلات والخصم والكروت. */
export function mergeEntry(existing: Data | null, incoming: any, main: Data, email?: string | null, fallbackName?: string | null): { entry?: Data; error?: string } {
  const name = String(incoming?.name || existing?.name || fallbackName || (email ? email.split('@')[0] : '') || '').trim().slice(0, 60);
  if (!name) return { error: 'الاسم مطلوب' };
  const cfg = main.cfg ?? {};
  const locked = isRoundLocked(cfg as any, main.matches);
  const editRound = locked ? cfg.round + 1 : cfg.round;
  const rounds: Record<string, any> = { ...(existing?.rounds ?? {}) };
  const sq = incoming?.rounds?.[editRound];
  if (sq) {
    // الميزانية: لو أسعار تشكيلته الحالية زادت، متتحسبش عليه مخالفة (زي الفانتازي)
    const budget = effectiveBudget(Number(cfg.budget), findBaseSquad(rounds, editRound), main.players ?? {});
    const err = validateSquad(sq, main, budget);
    if (err) return { error: err };

    const chip = sq.chip === 'wildcard' || sq.chip === 'freehit' ? sq.chip : undefined;
    if (chip) {
      const used = chipUsedRound(rounds, chip, editRound);
      if (used !== null) return { error: `استخدمت كارت ${chip === 'wildcard' ? 'Wildcard' : 'Free Hit'} قبل كده في الجولة ${used}` };
    }
    const base = findBaseSquad(rounds, editRound);
    const t = transferInfo(sq.ids, base, chip, cfg);

    // امسح النسخة التلقائية بتاعة Free Hit القديمة (لو كانت موجودة) وارجع احسبها
    const nextKey = String(editRound + 1);
    if (rounds[nextKey]?.auto) delete rounds[nextKey];

    rounds[editRound] = {
      ids: sq.ids,
      cap: sq.cap,
      form: String(sq.form ?? '2-2-2'),
      ...(chip ? { chip } : {}),
      tc: t.made,
      pen: t.cost,
    };

    // Free Hit: التشكيلة بترجع تلقائيًا للي قبلها في الجولة اللي بعدها
    if (chip === 'freehit' && base && !rounds[nextKey]) {
      const prev = findPrevSquad(rounds, editRound);
      if (prev) rounds[nextKey] = { ids: prev.ids, cap: prev.cap, form: prev.form ?? '2-2-2', tc: 0, pen: 0, auto: true };
    }
  }

  // تشكيلة وضع الحجز: منفصلة تمامًا عن تشكيلات الجولات (مفيش تحويلات ولا كروت ولا قفل)
  let bk = existing?.bk;
  if (incoming?.bk) {
    if (cfg.mode !== 'booking' || !main.booking?.active) return { error: 'وضع الحجز مش شغال دلوقتي' };
    if (isBookingLocked(main.booking, main.matches)) return { error: 'تشكيلة الحجز اتقفلت (قبل أول ماتش بربع ساعة)' };
    const err = validateSquad(incoming.bk, main, Number(cfg.budget));
    if (err) return { error: err };
    bk = { ids: incoming.bk.ids, cap: incoming.bk.cap, form: String(incoming.bk.form ?? '2-2-2') };
  }
  const phone = incoming?.phone !== undefined ? String(incoming.phone).replace(/[^\d+]/g, '').slice(0, 15) : existing?.phone;
  const joined = existing?.joined ?? (Number(incoming?.joined) || Date.now());
  const mail = email || existing?.email;
  return { entry: { id: existing?.id ?? incoming.id, name, ...(phone ? { phone } : {}), ...(mail ? { email: mail } : {}), joined, rounds, ...(bk ? { bk } : {}) } };
}

function findPrevSquad(rounds: Record<string, any>, editRound: number): any | null {
  for (let r = editRound - 1; r >= 1; r--) {
    const sq = rounds[r];
    if (sq && sq.ids?.length && sq.chip !== 'freehit') return sq;
  }
  return null;
}

// ---------- معالجة الطلبات (مشتركة) ----------
export interface Ctx {
  isAdmin: boolean;
  token: string | null;
  uid?: string | null; // صاحب حساب Firebase (لو مسجّل دخول)
  email?: string | null;
  name?: string | null;
}
export type Result = { status: number; json: any };

export async function handleGet(st: Storage, ctx: Ctx): Promise<Result> {
  const main = await loadMain(st);
  return { status: 200, json: publicView(main, await st.getEntries(), ctx.isAdmin) };
}

export async function handlePost(st: Storage, body: any, ctx: Ctx): Promise<Result> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { status: 400, json: { error: 'Invalid payload' } };
  let main = await loadMain(st);

  // مسح كل البيانات التجريبية (فرق/لاعبين/مباريات/إحصائيات/تشكيلات المشتركين). للمنظم بس.
  if (body.wipe === true) {
    if (!ctx.isAdmin) return { status: 403, json: { error: 'admin_required' } };
    const stories: Record<string, any> = {};
    for (const [k, v] of Object.entries((main.topStories ?? {}) as Record<string, any>)) if (v?.actionType !== 'live' && v?.actionType !== 'modal') stories[k] = v;
    main = { ...main, teams: {}, players: {}, matches: {}, stats: {}, bstats: { p: {} }, contacts: {}, booking: { active: false }, topStories: stories, cfg: { ...(main.cfg ?? {}), round: 1, locked: false } };
    await st.setMain(main);
    // التشكيلات القديمة كانت على لاعبين تجريبيين: بنفضّيها ونسيب الحسابات (الاسم والموبايل) زي ما هي
    for (const [uid, e] of Object.entries(await st.getEntries())) { const { bk: _bk, ...rest } = e as Data; await st.setEntry(uid, { ...rest, rounds: {} }); }
    return { status: 200, json: { success: true, data: publicView(main, await st.getEntries(), ctx.isAdmin) } };
  }

  const adminUpdate: Data = {};
  for (const k of ADMIN_FIELDS) if (body[k] !== undefined) adminUpdate[k] = body[k];
  if (Object.keys(adminUpdate).length > 0) {
    if (!ctx.isAdmin) return { status: 403, json: { error: 'admin_required' } };
    if (Object.values(adminUpdate).some((v) => !v || typeof v !== 'object')) return { status: 400, json: { error: 'Invalid payload' } };
    main = { ...main, ...adminUpdate };
    // إحصائيات اللاعبين بتتحسب تلقائيًا من المباريات كل ما المباريات تتحفظ
    if (adminUpdate.matches) {
      main.stats = deriveAllStats(main.matches, main.players, main.stats);
      // إحصائيات وضع الحجز منفصلة عن إحصائيات الجولات
      main.bstats = { p: deriveBookingStats(main.matches, main.players) };
    }
    await st.setMain(main);
  }

  if (body.entry !== undefined) {
    const id = String(body.entry?.id ?? '');
    if (!id || id.length > 80) return { status: 400, json: { error: 'Invalid entry' } };
    // التشكيلة بتتحفظ باسم حساب المشترك نفسه بس (Firebase Authentication)
    if (!ctx.uid) return { status: 401, json: { error: 'login_required' } };
    if (id !== ctx.uid) return { status: 403, json: { error: 'not_owner' } };
    const { entry, error } = mergeEntry(await st.getEntry(id), body.entry, main, ctx.email, ctx.name);
    if (!entry) return { status: 400, json: { error } };
    await st.setEntry(id, entry);
  }

  return { status: 200, json: { success: true, data: publicView(main, await st.getEntries(), ctx.isAdmin) } };
}
