// إنشاء حساب المنظم في Firebase Authentication (مرة واحدة).
// الاستخدام:
//   FIREBASE_SERVICE_ACCOUNT="$(cat serviceAccount.json)" ADMIN_PASSWORD="باسورد المنظم" node scripts/create-admin.mjs
// لو الحساب موجود بيتحدّث الباسورد بس.
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const EMAIL = 'khalifa@fantasy.com';
const password = process.env.ADMIN_PASSWORD;
const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
if (!raw || !password) {
  console.error('لازم تحدد FIREBASE_SERVICE_ACCOUNT (محتوى JSON أو مسار الملف) وADMIN_PASSWORD.');
  process.exit(1);
}
if (password.length < 6) {
  console.error('الباسورد لازم يكون 6 حروف أو أرقام على الأقل.');
  process.exit(1);
}
let sa;
try {
  sa = JSON.parse(raw.startsWith('{') ? raw : readFileSync(raw, 'utf-8'));
} catch {
  console.error('FIREBASE_SERVICE_ACCOUNT مش صالح.');
  process.exit(1);
}

const b64 = (v) => Buffer.from(v).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const head = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
const claims = b64(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/identitytoolkit', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
const sig = createSign('RSA-SHA256').update(`${head}.${claims}`).sign(String(sa.private_key).replace(/\\n/g, '\n'));

const tokRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${head}.${claims}.${b64(sig)}`,
});
const tok = await tokRes.json();
if (!tokRes.ok) {
  console.error('فشل الدخول بحساب الخدمة:', tok.error_description || tok.error);
  process.exit(1);
}
const auth = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' };
const base = `https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}/accounts`;

const lookup = await (await fetch(`${base}:lookup`, { method: 'POST', headers: auth, body: JSON.stringify({ email: [EMAIL] }) })).json();
const existing = lookup.users?.[0];

const res = existing
  ? await fetch(`${base}:update`, { method: 'POST', headers: auth, body: JSON.stringify({ localId: existing.localId, password, displayName: 'المنظم' }) })
  : await fetch(base, { method: 'POST', headers: auth, body: JSON.stringify({ email: EMAIL, password, displayName: 'المنظم', emailVerified: true }) });
const out = await res.json();
if (!res.ok) {
  console.error('فشل:', out.error?.message || JSON.stringify(out));
  process.exit(1);
}
console.log(existing ? `تم تحديث باسورد ${EMAIL}` : `تم إنشاء حساب المنظم ${EMAIL}`);
