// تخزين Firebase Firestore عن طريق REST API (من غير مكتبات). السيرفر بس هو اللي بيكلم Firestore بحساب خدمة (Service Account)،
// فقواعد Firestore بتفضل مقفولة تمامًا للمتصفحات، والتحقق (الميزانية/التحويلات/النقاط) بيفضل على السيرفر.
//
// التخطيط:
//   tournament/main   → بيانات الدورة (فرق/لاعبين/مباريات/إحصائيات/إعدادات)
//   entries/{uid}     → تشكيلة كل مشترك
// كل مستند فيه حقل واحد "json" بنص JSON، عشان نتجنب تحويل أنواع Firestore.
import { createSign } from 'node:crypto';
import type { Data, Storage } from './logic.js';

export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

/** بيقرأ FIREBASE_SERVICE_ACCOUNT (JSON أو Base64 للـ JSON). */
export function serviceAccountFromEnv(env: Record<string, string | undefined> = process.env): ServiceAccount | null {
  const raw = env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  const tryParse = (t: string) => {
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  };
  const j = tryParse(raw) ?? tryParse(Buffer.from(raw, 'base64').toString('utf-8'));
  if (!j?.client_email || !j?.private_key) {
    console.error('FIREBASE_SERVICE_ACCOUNT مش صالح: لازم يكون ملف مفتاح حساب الخدمة (JSON) كامل.');
    return null;
  }
  return {
    project_id: env.FIREBASE_PROJECT_ID || j.project_id,
    client_email: j.client_email,
    private_key: String(j.private_key).replace(/\\n/g, '\n'),
  };
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export function signJwt(sa: ServiceAccount, scope: string, now = Math.floor(Date.now() / 1000)): string {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({ iss: sa.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })
  );
  const sig = createSign('RSA-SHA256').update(`${head}.${claims}`).sign(sa.private_key);
  return `${head}.${claims}.${b64url(sig)}`;
}

const CACHE_MS = 3000; // كاش قصير عشان تحديثات الشاشات (كل ~10 ثواني) ما تعملش آلاف قراءات

export function createFirestoreStorage(sa: ServiceAccount, fetchImpl: typeof fetch = fetch): Storage {
  const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
  let token: { value: string; until: number } | null = null;

  async function accessToken(): Promise<string> {
    if (token && token.until > Date.now()) return token.value;
    const res = await fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${signJwt(sa, 'https://www.googleapis.com/auth/datastore')}`,
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || !json.access_token) throw new Error(`Firebase auth failed (${res.status}): ${json.error_description || json.error || ''}`);
    token = { value: json.access_token, until: Date.now() + (Number(json.expires_in) || 3600) * 1000 - 60_000 };
    return token.value;
  }

  async function call(path: string, init: RequestInit = {}): Promise<any | null> {
    const res = await fetchImpl(`${base}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    });
    if (res.status === 404 && (!init.method || init.method === 'GET')) return null;
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Firestore ${res.status}: ${json?.error?.message || ''}`);
    return json;
  }

  const idOf = (id: string) => encodeURIComponent(String(id).replace(/\//g, '_'));
  const decode = (doc: any): any => {
    const s = doc?.fields?.json?.stringValue;
    if (typeof s !== 'string') return null;
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  const encode = (v: unknown) => ({ fields: { json: { stringValue: JSON.stringify(v) } } });
  const getDoc = async (col: string, id: string) => decode(await call(`/${col}/${idOf(id)}`));
  const setDoc = (col: string, id: string, v: unknown) =>
    call(`/${col}/${idOf(id)}?updateMask.fieldPaths=json`, { method: 'PATCH', body: JSON.stringify(encode(v)) });

  let mainCache: { v: Data | null; at: number } | null = null;
  let entriesCache: { v: Record<string, Data>; at: number } | null = null;

  return {
    async getMain() {
      if (mainCache && Date.now() - mainCache.at < CACHE_MS) return mainCache.v;
      const v = await getDoc('tournament', 'main');
      mainCache = { v, at: Date.now() };
      return v;
    },
    async setMain(main) {
      await setDoc('tournament', 'main', main);
      mainCache = { v: main, at: Date.now() };
    },
    async getEntries() {
      if (entriesCache && Date.now() - entriesCache.at < CACHE_MS) return entriesCache.v;
      const out: Record<string, Data> = {};
      let pageToken = '';
      do {
        const r = await call(`/entries?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`);
        for (const d of r?.documents ?? []) {
          const v = decode(d);
          if (v) out[v.id ?? decodeURIComponent(String(d.name).split('/').pop() ?? '')] = v;
        }
        pageToken = r?.nextPageToken ?? '';
      } while (pageToken);
      entriesCache = { v: out, at: Date.now() };
      return out;
    },
    async getEntry(uid) {
      return getDoc('entries', uid);
    },
    async setEntry(uid, e) {
      await setDoc('entries', uid, e);
      if (entriesCache) entriesCache = { v: { ...entriesCache.v, [uid]: e }, at: entriesCache.at };
    },
    async getOwner(uid) {
      const v = await getDoc('owners', uid);
      return typeof v === 'string' ? v : null;
    },
    async setOwner(uid, hash) {
      await setDoc('owners', uid, hash);
    },
  };
}
