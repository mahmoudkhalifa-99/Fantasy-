import React, { useState } from 'react';
import { Lock } from 'lucide-react';

interface AdminLoginProps {
  onSuccess: (key: string) => void;
}

/** شاشة دخول المنظم: المفتاح بيتحقق منه السيرفر (متغير ADMIN_KEY). */
export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess }) => {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/tournament/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) onSuccess(key.trim());
      else setError(json.error || 'المفتاح غير صحيح');
    } catch {
      setError('تعذر الاتصال بالسيرفر');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="bg-[#122218] border border-emerald-700/50 rounded-3xl p-5 space-y-4 text-center shadow-xl"
    >
      <div className="mx-auto w-12 h-12 rounded-full bg-emerald-950 border border-amber-400/50 flex items-center justify-center text-amber-400">
        <Lock className="w-5 h-5" />
      </div>
      <div>
        <h2 className="text-lg font-black text-white">دخول المنظم</h2>
        <p className="text-xs text-emerald-300/80 mt-1">اكتب مفتاح المنظم لإدارة الدورة.</p>
      </div>
      <input
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        autoComplete="current-password"
        placeholder="مفتاح المنظم"
        className="w-full px-4 py-3 rounded-xl bg-emerald-950 border border-emerald-700/60 text-white text-sm text-center outline-none focus:border-amber-400"
      />
      {error && <p className="text-xs font-bold text-rose-400">{error}</p>}
      <button
        type="submit"
        disabled={busy || !key.trim()}
        className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-emerald-950 font-black text-sm transition-colors cursor-pointer"
      >
        {busy ? 'جاري التحقق...' : 'دخول'}
      </button>
    </form>
  );
};
