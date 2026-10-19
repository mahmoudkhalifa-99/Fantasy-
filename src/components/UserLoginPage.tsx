import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Phone, User, LogIn, UserPlus } from 'lucide-react';
import { RESERVED_ADMIN_EMAILS, firebaseEnabled, firebaseResetPassword, firebaseSignIn, firebaseSignUp } from '../utils/adminAuth';

/** شاشة دخول المشتركين (Firebase): دخول أو حساب جديد. بتظهر أول ما حد يفتح الموقع من غير ما يكون مسجّل دخول. */
export const UserLoginPage: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const done = () => {
    // نرجع للصفحة الرئيسية عشان التطبيق يحمّل بيانات الحساب
    // المنظم بيتحوّل مباشرة للوحة التحكم
    const isAdmin = RESERVED_ADMIN_EMAILS.includes(email.trim().toLowerCase());
    window.location.replace(isAdmin && mode === 'login' ? '/admin' : '/');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setInfo('');
    if (!firebaseEnabled) {
      // دخول بالاسم ورقم الموبايل (من غير Firebase)
      const cleanPhone = phone.trim().replace(/[\s-]/g, '');
      if (name.trim().length < 2) return setError('اكتب اسمك أو لقبك الكروي');
      if (!/^01[0125]\d{8}$/.test(cleanPhone)) return setError('رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01');
      localStorage.setItem('fantasy_dawra_name', name.trim());
      localStorage.setItem('fantasy_dawra_phone', cleanPhone);
      return done();
    }
    const em = email.trim();
    if (!em || !password) {
      setError('اكتب الإيميل والباسورد');
      return;
    }
    if (mode === 'signup') {
      const cleanPhone = phone.trim().replace(/[\s-]/g, '');
      if (name.trim().length < 2) return setError('اكتب اسمك أو لقبك الكروي');
      if (!/^01[0125]\d{8}$/.test(cleanPhone)) return setError('رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01');
      if (password.length < 6) return setError('الباسورد لازم يكون 6 حروف أو أرقام على الأقل');
      if (RESERVED_ADMIN_EMAILS.includes(em.toLowerCase())) return setError('الإيميل ده محجوز للمنظم، استخدم إيميل تاني');
      setBusy(true);
      const r = await firebaseSignUp(em, password, name.trim());
      if (!r.ok) {
        setBusy(false);
        return setError(r.error);
      }
      localStorage.setItem('fantasy_dawra_name', name.trim());
      localStorage.setItem('fantasy_dawra_phone', cleanPhone);
      return done();
    }
    setBusy(true);
    const r = await firebaseSignIn(em, password);
    if (!r.ok) {
      setBusy(false);
      return setError(r.error);
    }
    done();
  };

  const reset = async () => {
    setError('');
    setInfo('');
    if (!email.trim()) return setError('اكتب الإيميل الأول وبعدين دوس "نسيت الباسورد"');
    const r = await firebaseResetPassword(email.trim());
    if (r.ok) setInfo('بعتنا لك إيميل لتغيير الباسورد، افتح الإيميل (وشوف الـ Spam).');
    else setError(r.error);
  };

  const input =
    'w-full px-4 py-3 rounded-xl bg-emerald-950 border border-emerald-700/60 text-white text-sm outline-none focus:border-amber-400';
  const tab = (active: boolean) =>
    `flex-1 py-2.5 rounded-xl text-sm font-black transition-colors cursor-pointer ${
      active ? 'bg-amber-400 text-emerald-950' : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
    }`;

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col items-center justify-center px-5 py-8 bg-[radial-gradient(ellipse_at_50%_15%,#0e4a2e,#04100c_70%)] text-white font-['Cairo',sans-serif]"
    >
      <img src="/crest.png" alt="Tahway League" className="w-36 max-w-[50vw] drop-shadow-[0_0_14px_rgba(239,187,81,0.35)] mb-4" />
      <h1 className="text-2xl font-black font-['Lalezar',sans-serif] mb-1">فانتازي الدورة</h1>
      <p className="text-xs text-emerald-300/80 mb-5">سجّل دخولك عشان تكوّن تشكيلتك وتنافس أصحابك</p>

      <form onSubmit={submit} className="w-full max-w-sm bg-[#122218]/95 border border-emerald-700/50 rounded-3xl p-5 space-y-3 shadow-2xl">
        {firebaseEnabled && <div className="flex gap-2">
          <button type="button" className={tab(mode === 'login')} onClick={() => { setMode('login'); setError(''); setInfo(''); }}>
            <LogIn className="w-4 h-4 inline ml-1" />
            دخول
          </button>
          <button type="button" className={tab(mode === 'signup')} onClick={() => { setMode('signup'); setError(''); setInfo(''); }}>
            <UserPlus className="w-4 h-4 inline ml-1" />
            حساب جديد
          </button>
        </div>}

        {(!firebaseEnabled || mode === 'signup') && (
          <>
            <div className="relative">
              <User className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك / لقبك الكروي" className={`${input} pr-9`} />
            </div>
            <div className="relative">
              <Phone className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                dir="ltr"
                placeholder="رقم الموبايل 01xxxxxxxxx"
                className={`${input} pr-9 text-right`}
              />
            </div>
          </>
        )}

        {firebaseEnabled && (
          <>
        <div className="relative">
          <Mail className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            placeholder="الإيميل"
            className={`${input} pr-9 text-right`}
          />
        </div>

        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="الباسورد"
            className={`${input} pl-11 text-right`}
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

          </>
        )}

        {error && <p className="text-xs font-bold text-rose-400 text-center">{error}</p>}
        {info && <p className="text-xs font-bold text-emerald-300 text-center">{info}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-emerald-950 font-black text-sm transition-colors cursor-pointer"
        >
          {busy ? 'لحظة...' : !firebaseEnabled || mode === 'login' ? 'دخول' : 'إنشاء الحساب'}
        </button>

        {firebaseEnabled && mode === 'login' && (
          <button type="button" onClick={reset} className="w-full text-center text-xs font-bold text-emerald-300 hover:text-white cursor-pointer">
            نسيت الباسورد؟
          </button>
        )}
      </form>
    </div>
  );
};
