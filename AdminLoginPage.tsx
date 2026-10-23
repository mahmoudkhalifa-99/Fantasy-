import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { firebaseEnabled, firebaseSignIn, getAdminHeaders, adminSignOut, saveLegacyKey, adminReasonMessage } from '../utils/adminAuth';

interface Props {
  onSuccess: () => void;
  notice?: string; // سبب إن الحساب المسجّل دخول مش منظم
  onSignOut?: () => void;
}

/** صفحة تسجيل دخول المنظم (على الرابط /admin). بتشتغل بـ Firebase Authentication (إيميل + باسورد). */
export const AdminLoginPage: React.FC<Props> = ({ onSuccess, notice, onSignOut }) => {
  const [email, setEmail] = useState('');
  const [secret, setSecret] = useState(''); // الباسورد (أو المفتاح في وضع التجربة)
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const canSubmit = firebaseEnabled ? !!email.trim() && !!secret : !!secret.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError('');
    try {
      let body: any = {};
      if (firebaseEnabled) {
        const r = await firebaseSignIn(email.trim(), secret);
        if (!r.ok) {
          setError(r.error);
          return;
        }
      } else {
        saveLegacyKey(secret.trim());
        body = { key: secret.trim() };
      }
      // السيرفر بيتأكد إن الحساب ده مسموح له يدخل كمنظم
      const headers = await getAdminHeaders();
      const res = await fetch('/api/tournament/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
      const json: any = await res.json().catch(() => ({}));
      if (res.ok && json.ok) onSuccess();
      else {
        adminSignOut();
        setError(adminReasonMessage(json));
      }
    } catch {
      adminSignOut();
      setError('تعذر الاتصال بالسيرفر، جرّب تاني');
    } finally {
      setBusy(false);
    }
  };

  const input =
    'w-full px-4 py-3 rounded-xl bg-emerald-950 border border-emerald-700/60 text-white text-sm outline-none focus:border-amber-400';

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col items-center justify-center px-5 py-10 bg-[radial-gradient(ellipse_at_50%_20%,#0e4a2e,#04100c_70%)] text-white font-['Cairo',sans-serif]"
    >
      <img src="/crest.png" alt="Tahway League" className="w-40 max-w-[55vw] drop-shadow-[0_0_14px_rgba(239,187,81,0.35)] mb-6" />

      <form onSubmit={submit} className="w-full max-w-sm bg-[#122218]/95 border border-emerald-700/50 rounded-3xl p-6 space-y-4 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-950 border border-amber-400/50 flex items-center justify-center text-amber-400">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black font-['Lalezar',sans-serif]">تسجيل دخول المنظم</h1>
          <p className="text-xs text-emerald-300/80">
            {firebaseEnabled ? 'ادخل بالإيميل والباسورد بتوعك عشان تدير الدورة وتسجل المباريات.' : 'اكتب مفتاح المنظم (وضع التجربة المحلية).'}
          </p>
        </div>

        {firebaseEnabled && (
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoFocus
            placeholder="الإيميل"
            className={`${input} text-center`}
          />
        )}

        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            dir="ltr"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="current-password"
            autoFocus={!firebaseEnabled}
            placeholder={firebaseEnabled ? 'الباسورد' : 'مفتاح المنظم'}
            className={`${input} pl-11 text-center`}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 hover:text-white"
            aria-label={show ? 'إخفاء' : 'إظهار'}
          >
            {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        {notice && !error && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-400/40 p-3 text-xs font-bold text-amber-200 text-center space-y-2">
            <p>{notice}</p>
            {onSignOut && (
              <button type="button" onClick={onSignOut} className="underline text-amber-300 cursor-pointer">
                تسجيل خروج وتجربة حساب تاني
              </button>
            )}
          </div>
        )}
        {error && <p className="text-xs font-bold text-rose-400 text-center">{error}</p>}

        <button
          type="submit"
          disabled={busy || !canSubmit}
          className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-emerald-950 font-black text-sm transition-colors cursor-pointer"
        >
          {busy ? 'جاري التحقق...' : 'دخول'}
        </button>
      </form>

      <a href="/" className="mt-5 text-xs font-bold text-emerald-300 hover:text-white flex items-center gap-1">
        <ArrowRight className="w-3.5 h-3.5" />
        الرجوع للموقع
      </a>
    </div>
  );
};
