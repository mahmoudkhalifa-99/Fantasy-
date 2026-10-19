// دخول المنظم: Firebase Authentication (إيميل + باسورد) عن طريق REST من غير مكتبات.
// لو VITE_FIREBASE_API_KEY مش مضبوط بنرجع لوضع المفتاح القديم (للتجربة المحلية).
// مفتاح Firebase Web API (عام ومش سر). ممكن تغيّره بالمتغير VITE_FIREBASE_API_KEY في Vercel.
const DEFAULT_FB_KEY = 'AIzaSyA2qxh_ogoG5WP2sDsm-HxdHNyNvf1R808';
const FB_KEY: string = ((import.meta as any).env?.VITE_FIREBASE_API_KEY as string) || DEFAULT_FB_KEY;
const SESSION_KEY = 'fantasy_admin_fb';
const LEGACY_KEY = 'fantasy_admin_key';

export const firebaseEnabled = !!FB_KEY;

// إيميلات محجوزة للمنظم: ممنوع التسجيل بيها كمشترك جديد
export const RESERVED_ADMIN_EMAILS = ['khalifa@fantasy.com'];

interface Session {
  idToken: string;
  refreshToken: string;
  exp: number; // ms
  email: string;
  uid?: string;
  name?: string;
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
const saveSession = (s: Session) => localStorage.setItem(SESSION_KEY, JSON.stringify(s));

export function hasAdminSession(): boolean {
  return firebaseEnabled ? !!readSession() : !!localStorage.getItem(LEGACY_KEY);
}

export function adminEmail(): string {
  return readSession()?.email || '';
}

/** هل فيه حساب Firebase مسجّل دخول على الجهاز ده؟ (مشترك أو منظم) */
export function hasFirebaseSession(): boolean {
  return !!readSession();
}

export function currentUid(): string {
  return readSession()?.uid || '';
}

export function adminSignOut() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LEGACY_KEY);
}

/** تسجيل خروج المشترك: بيمسح الجلسة وبيات الجهاز. */
export function userSignOut() {
  adminSignOut();
  localStorage.removeItem('fantasy_dawra_uid');
  localStorage.removeItem('fantasy_dawra_name');
  localStorage.removeItem('fantasy_dawra_phone');
}

/** خروج بدون Firebase: بنمسح الاسم بس (والحساب بيرجع لنفس الجهاز لما يسجّل دخول تاني). */
export function localSignOut() {
  localStorage.removeItem('fantasy_dawra_name');
  localStorage.removeItem('fantasy_dawra_phone');
}

export function isLocalRegistered(): boolean {
  return !!localStorage.getItem('fantasy_dawra_name');
}

function applyUserKeys(uid: string, name?: string) {
  if (uid) localStorage.setItem('fantasy_dawra_uid', uid);
  if (name) localStorage.setItem('fantasy_dawra_name', name);
}

export function saveLegacyKey(key: string) {
  localStorage.setItem(LEGACY_KEY, key);
}

const ERRORS: Record<string, string> = {
  EMAIL_NOT_FOUND: 'الإيميل أو الباسورد غلط',
  INVALID_PASSWORD: 'الإيميل أو الباسورد غلط',
  INVALID_LOGIN_CREDENTIALS: 'الإيميل أو الباسورد غلط',
  INVALID_EMAIL: 'الإيميل مكتوب غلط',
  USER_DISABLED: 'الحساب ده موقوف',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'محاولات كتير، استنى شوية وجرّب تاني',
  EMAIL_EXISTS: 'الإيميل ده متسجل قبل كده، سجّل دخول',
  WEAK_PASSWORD: 'الباسورد ضعيف (6 حروف أو أرقام على الأقل)',
  OPERATION_NOT_ALLOWED: 'تسجيل الدخول بالإيميل مش مفعّل في Firebase',
  MISSING_PASSWORD: 'اكتب الباسورد',
};

const errOf = (json: any) => ERRORS[String(json?.error?.message || '').split(' ')[0]] || 'حصلت مشكلة، جرّب تاني';

export async function firebaseSignIn(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FB_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: errOf(json) };
    saveSession({
      idToken: json.idToken,
      refreshToken: json.refreshToken,
      exp: Date.now() + Number(json.expiresIn || 3600) * 1000,
      email: json.email || email,
      uid: json.localId,
      name: json.displayName || undefined,
    });
    applyUserKeys(json.localId, json.displayName);
    return { ok: true };
  } catch {
    return { ok: false, error: 'تعذر الاتصال بالإنترنت' };
  }
}

/** إنشاء حساب مشترك جديد (إيميل + باسورد) واسم يظهر في الترتيب. */
export async function firebaseSignUp(email: string, password: string, name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FB_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: errOf(json) };
    // حفظ الاسم في الحساب (لو فشل مش مشكلة، الاسم بيتحفظ مع التشكيلة)
    fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${FB_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: json.idToken, displayName: name, returnSecureToken: false }),
    }).catch(() => {});
    saveSession({
      idToken: json.idToken,
      refreshToken: json.refreshToken,
      exp: Date.now() + Number(json.expiresIn || 3600) * 1000,
      email: json.email || email,
      uid: json.localId,
      name,
    });
    applyUserKeys(json.localId, name);
    return { ok: true };
  } catch {
    return { ok: false, error: 'تعذر الاتصال بالإنترنت' };
  }
}

/** بعت إيميل لتغيير الباسورد. */
export async function firebaseResetPassword(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FB_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
    });
    const json: any = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: errOf(json) };
  } catch {
    return { ok: false, error: 'تعذر الاتصال بالإنترنت' };
  }
}

let refreshing: Promise<Session | null> | null = null;

async function refresh(s: Session): Promise<Session | null> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FB_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(s.refreshToken)}`,
        });
        const json: any = await res.json().catch(() => ({}));
        if (!res.ok || !json.id_token) {
          // لو الرفرش توكن اتلغى بنخرّج المنظم، ولو مجرد مشكلة نت بنسيب الجلسة زي ما هي
          if (res.status === 400 || res.status === 401) adminSignOut();
          return res.status === 400 || res.status === 401 ? null : s;
        }
        const next: Session = {
          idToken: json.id_token,
          refreshToken: json.refresh_token || s.refreshToken,
          exp: Date.now() + Number(json.expires_in || 3600) * 1000,
          email: s.email,
          uid: s.uid,
          name: s.name,
        };
        saveSession(next);
        return next;
      } catch {
        return s;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

/** هيدرز دخول المنظم للطلبات (بتجدد التوكن لوحدها قبل ما ينتهي). */
export async function getAdminHeaders(): Promise<Record<string, string>> {
  if (!firebaseEnabled) {
    const k = localStorage.getItem(LEGACY_KEY);
    return k ? { 'x-admin-key': k } : {};
  }
  let s = readSession();
  if (!s) return {};
  if (s.exp - Date.now() < 2 * 60 * 1000) s = await refresh(s);
  return s ? { Authorization: `Bearer ${s.idToken}` } : {};
}

/** رسالة عربي واضحة لسبب رفض دخول المنظم (من رد /api/tournament/auth). */
export function adminReasonMessage(json: any): string {
  switch (json?.reason) {
    case 'not_configured':
      return 'لوحة المنظم مش متظبطة.';
    case 'no_token':
      return 'مفيش جلسة دخول، سجّل دخول بالإيميل والباسورد.';
    case 'firebase_rejected':
      return 'Firebase رفض التوكن. سجّل خروج وادخل تاني، ولو لسه تأكد إن الـ API Key صح وغير مقيّد بـ HTTP referrers.';
    case 'not_allowed':
      return `الإيميل ${json.email || ''} مش المنظم. المنظم الوحيد هو khalifa@fantasy.com.`;
    case 'bad_key':
      return 'المفتاح غير صحيح';
    default:
      return 'الحساب ده مش مسموح له يدخل كمنظم';
  }
}
