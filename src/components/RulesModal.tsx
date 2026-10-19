import React from 'react';
import { X, Trophy, Shield, Flame, AlertTriangle, Crown } from 'lucide-react';
import { SCORING_MATRIX, BENCH_SIZE } from '../utils/fantasyScoring';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  budget: number;
  maxPerTeam: number;
  freeTransfers?: number;
  transferPenalty?: number;
}

export const RulesModal: React.FC<RulesModalProps> = ({
  isOpen,
  onClose,
  budget,
  maxPerTeam,
  freeTransfers = 1,
  transferPenalty = 4,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#13231a] border border-emerald-600/40 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-emerald-100">
        {/* Header */}
        <div className="p-4 border-b border-emerald-800/60 bg-[#0d1812] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="text-base sm:text-lg font-black text-white font-['Lalezar',sans-serif]">
              قواعد ولائحة نقاط فانتازي الدورة الشعبية
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

        {/* Rules Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {/* How to play */}
          <div className="bg-[#0b160f] p-3 rounded-xl border border-emerald-800/50 space-y-1.5">
            <h4 className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
              <Trophy className="w-4 h-4" />
              طريقة اللعب
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-emerald-200 text-xs">
              <li>سجّل حساب (الاسم + الموبايل + الإيميل).</li>
              <li>اختار <b>7 لاعبين</b> (حارس + 6) في حدود الميزانية <b>{budget} مليون</b> وبالخطة اللي تعجبك.</li>
              <li>اختار <b>كابتن</b> من تشكيلتك، وتقدر تختار <b>دكة احتياطي ({BENCH_SIZE} لاعبين: مدافع + وسط + مهاجم)</b>.</li>
              <li>احفظ التشكيلة <b>قبل قفل الجولة</b>. بعد القفل مفيش تعديل لحد الجولة اللي بعدها.</li>
              <li>مع انتهاء المباريات، نقاط لاعبينك بتتحسب تلقائيًا وبتتجمع في ترتيبك العام.</li>
              <li><b>الدكة:</b> لو لاعب أساسي (غير الحارس) مالعبش، الاحتياطي في نفس مركزه بياخد مكانه وبتتحسب نقاطه لو لعب.</li>
            </ol>
          </div>

          {/* Captain badge */}
          <div className="bg-[#0b160f] p-3 rounded-xl border border-emerald-800/50 space-y-2">
            <h4 className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
              <Crown className="w-4 h-4" />
              الكابتن وشارته
            </h4>
            <div className="flex items-center gap-3">
              <span className="bg-amber-400 text-amber-950 text-xs font-black rounded-full w-6 h-6 flex items-center justify-center border-2 border-emerald-950 shadow-md shrink-0">C</span>
              <p className="text-emerald-200 text-xs">دايرة <b>صفراء</b> عليها حرف <b>C</b> بتظهر على القميص (فوق يمينه) للاعب الكابتن.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full flex items-center justify-center bg-amber-400 text-amber-950 ring-2 ring-amber-300 shrink-0"><Crown className="w-3.5 h-3.5" /></span>
              <p className="text-emerald-200 text-xs">زرار <b>التاج</b> فوق يسار اللاعب: دوس عليه تخلّيه كابتن (الأصفر معناه إنه الكابتن الحالي).</p>
            </div>
            <p className="text-emerald-200 text-xs">نقاط الكابتن بتتضاعف <b>(x2)</b> في الجولة، ومثال: لاعب جاب 9 نقاط ككابتن بيحسبلك <b>18</b>.</p>
          </div>

          {/* Main Principles */}
          <div className="bg-[#0b160f] p-3 rounded-xl border border-emerald-800/50 space-y-1.5">
            <h4 className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
              <Shield className="w-4 h-4" />
              أهم شروط تكوين التشكيلة
            </h4>
            <ul className="list-disc list-inside space-y-1 text-emerald-200 text-xs">
              <li>عدد لاعبي التشكيلة: <b>7 لاعبين</b> (1 حارس مرمى + 6 لاعبين ميدان).</li>
              <li>الخطط المتاحة: <b>2-2-2</b> أو <b>3-2-1</b> أو <b>2-3-1</b> أو <b>3-1-2</b> أو <b>2-1-3</b>.</li>
              <li>الميزانية الإجمالية: <b>{budget} مليون نقطة</b> بحد أقصى.</li>
              <li>الحد الأقصى لكل فريق حقيقي في الدورة: <b>{maxPerTeam} لاعبين</b> (الحراس مستثنيين من الحد).</li>
              <li>الكابتن (C): <b>تتضاعف نقاطه مرتين (x2)</b> خلال الجولة.</li>
            </ul>
          </div>

          {/* Transfers */}
          <div className="bg-[#0b160f] p-3 rounded-xl border border-emerald-800/50 space-y-1.5">
            <h4 className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
              <Shield className="w-4 h-4" />
              التحويلات والكروت
            </h4>
            <ul className="list-disc list-inside space-y-1 text-emerald-200 text-xs">
              <li>لك <b>{freeTransfers} تحويل مجاني</b> كل جولة (تغيير لاعب بلاعب). أول تشكيلة ليك من غير حدود.</li>
              <li>كل تحويل زيادة بيتخصم منه <b>{transferPenalty} نقاط</b> من نقاط الجولة.</li>
              <li><b>وايلد كارد</b>: تحويلات من غير خصم في جولة واحدة، مرة واحدة في الدورة.</li>
              <li><b>فري هيت</b>: تغيّر براحتك لجولة واحدة وتشكيلتك القديمة بترجع بعدها، مرة واحدة في الدورة.</li>
            </ul>
          </div>

          {/* Points Table */}
          <div>
            <h4 className="font-bold text-white mb-2 text-xs flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-400" />
              جدول احتساب النقاط
            </h4>

            <div className="rounded-xl overflow-hidden border border-emerald-800/60 divide-y divide-emerald-800/40 text-xs">
              <div className="grid grid-cols-2 p-2 bg-[#0a150e] font-bold text-emerald-300">
                <span>الحدث الكروي</span>
                <span className="text-left font-mono">النقاط الممنوحة</span>
              </div>

              <div className="grid grid-cols-2 p-2 bg-[#122218]">
                <span>المشاركة في اللقاء</span>
                <span className="text-left font-mono font-bold text-emerald-400">+{SCORING_MATRIX.app}</span>
              </div>

              <div className="grid grid-cols-2 p-2 bg-[#101e15]">
                <span>هدف (حارس مرمى / مدافع)</span>
                <span className="text-left font-mono font-bold text-amber-300">+{SCORING_MATRIX.goal.DEF}</span>
              </div>

              <div className="grid grid-cols-2 p-2 bg-[#122218]">
                <span>هدف (لاعب وسط)</span>
                <span className="text-left font-mono font-bold text-amber-300">+{SCORING_MATRIX.goal.MID}</span>
              </div>

              <div className="grid grid-cols-2 p-2 bg-[#101e15]">
                <span>هدف (مهاجم)</span>
                <span className="text-left font-mono font-bold text-amber-300">+{SCORING_MATRIX.goal.FWD}</span>
              </div>

              <div className="grid grid-cols-2 p-2 bg-[#122218]">
                <span>صناعة هدف (أسيست)</span>
                <span className="text-left font-mono font-bold text-emerald-400">+{SCORING_MATRIX.assist}</span>
              </div>

              <div className="grid grid-cols-2 p-2 bg-[#101e15]">
                <span>شباك نظيفة (حارس ومدافع) - بتتحسب تلقائي</span>
                <span className="text-left font-mono font-bold text-emerald-400">+{SCORING_MATRIX.cs.DEF}</span>
              </div>

              <div className="grid grid-cols-2 p-2 bg-[#122218]">
                <span>شباك نظيفة (خط وسط)</span>
                <span className="text-left font-mono font-bold text-emerald-400">+{SCORING_MATRIX.cs.MID}</span>
              </div>

              <div className="grid grid-cols-2 p-2 bg-[#101e15]">
                <span>قطع الكرات (مدافع): كل {SCORING_MATRIX.tk.per} قطع</span>
                <span className="text-left font-mono font-bold text-emerald-400">+{SCORING_MATRIX.tk.pts}</span>
              </div>

              <div className="grid grid-cols-2 p-2 bg-[#122218]">
                <span>تصدي لركلة جزاء (حارس مرمى)</span>
                <span className="text-left font-mono font-bold text-amber-400">+{SCORING_MATRIX.ps}</span>
              </div>

              <div className="grid grid-cols-2 p-2 bg-[#101e15]">
                <span>جائزة رجل المباراة</span>
                <span className="text-left font-mono font-bold text-amber-400">+{SCORING_MATRIX.mo}</span>
              </div>

              <div className="grid grid-cols-2 p-2 bg-[#101e15] text-yellow-300">
                <span>إنذار أصفر</span>
                <span className="text-left font-mono font-bold">{SCORING_MATRIX.yc}</span>
              </div>

              <div className="grid grid-cols-2 p-2 bg-[#122218] text-red-300">
                <span>طرد بالبطاقة الحمراء</span>
                <span className="text-left font-mono font-bold">{SCORING_MATRIX.rc}</span>
              </div>

              <div className="grid grid-cols-2 p-2 bg-[#101e15] text-red-300">
                <span>تسجيل هدف عكسي في مرماه</span>
                <span className="text-left font-mono font-bold">{SCORING_MATRIX.og}</span>
              </div>

              <div className="grid grid-cols-2 p-2 bg-[#122218] text-red-300">
                <span>إهدار ركلة جزاء</span>
                <span className="text-left font-mono font-bold">{SCORING_MATRIX.pm}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0d1812] border-t border-emerald-800/60 text-center">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md"
          >
            فهمت القواعد · العودة للعبة
          </button>
        </div>
      </div>
    </div>
  );
};
