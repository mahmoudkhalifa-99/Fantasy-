import React, { useState } from 'react';
import { UserCheck, X, Phone, User, Trophy } from 'lucide-react';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (name: string, phone: string) => void;
  initialName?: string;
  initialPhone?: string;
}

export const RegistrationModal: React.FC<RegistrationModalProps> = ({
  isOpen,
  onClose,
  onRegister,
  initialName = '',
  initialPhone = '',
}) => {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    const cleanPhone = phone.trim().replace(/[\s-]/g, '');

    if (trimmedName.length < 2) {
      setError('يرجى إدخال اسمك واسم شهرتك في الدورة');
      return;
    }

    if (!/^01[0125]\d{8}$/.test(cleanPhone)) {
      setError('رقم الموبايل يجب أن يتكون من 11 رقماً ويبدأ بـ 01 (مثال: 01012345678)');
      return;
    }

    onRegister(trimmedName, cleanPhone);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#13231a] border border-emerald-600/40 rounded-2xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden text-emerald-100">
        <div className="p-4 border-b border-emerald-800/60 bg-[#0d1812] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="text-base sm:text-lg font-black text-white font-['Lalezar',sans-serif]">
              تسجيل بيانات المدرب في الدورة
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-400 hover:text-white hover:bg-emerald-800/40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs sm:text-sm">
          <p className="text-xs text-emerald-300/90 leading-relaxed">
            الاسم سيظهر لأصحابك في جدول ترتيب الدورة، ورقم الموبايل للتواصل في حال فوزك بجوائز الدورة الشعبية!
          </p>

          {error && (
            <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs font-semibold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-emerald-300 font-bold mb-1">
              اسمك / لقبك الكروي:
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: كابتن أحمد"
                className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-xl py-2 pr-9 pl-3 text-white placeholder-emerald-600 focus:outline-none focus:border-amber-400 text-xs sm:text-sm"
              />
              <User className="w-4 h-4 text-emerald-500 absolute top-2.5 right-3" />
            </div>
          </div>

          <div>
            <label className="block text-emerald-300 font-bold mb-1">
              رقم الموبايل (واتساب):
            </label>
            <div className="relative">
              <input
                type="tel"
                required
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01012345678"
                className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-xl py-2 pr-3 pl-9 text-white placeholder-emerald-600 focus:outline-none focus:border-amber-400 text-xs sm:text-sm text-left font-mono"
              />
              <Phone className="w-4 h-4 text-emerald-500 absolute top-2.5 left-3" />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
            >
              <UserCheck className="w-4 h-4" />
              تأكيد وبدء المنافسة
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
