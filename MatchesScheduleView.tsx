import React, { useState, useMemo } from 'react';
import { Match, Team, TournamentConfig } from '../types';
import { JerseyKit } from './JerseyKit';
import {
  Calendar,
  Clock,
  MapPin,
  Trophy,
  Flame,
  Star,
  Search,
  Filter,
  CheckCircle,
  Radio,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface MatchesScheduleViewProps {
  matches: Record<string, Match>;
  teams: Record<string, Team>;
  cfg: TournamentConfig;
  onGoToAdmin?: () => void;
}

export const MatchesScheduleView: React.FC<MatchesScheduleViewProps> = ({
  matches,
  teams,
  cfg,
  onGoToAdmin,
}) => {
  const [selectedRound, setSelectedRound] = useState<number | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'upcoming' | 'live' | 'finished'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  // Extract all available round numbers
  const roundNumbers = useMemo(() => {
    const set = new Set<number>();
    Object.values(matches).forEach((m) => set.add(m.round));
    // also include current tournament round
    set.add(cfg.round);
    return Array.from(set).sort((a, b) => a - b);
  }, [matches, cfg.round]);

  // Filter matches
  const filteredMatches = useMemo(() => {
    return Object.values(matches)
      .filter((m) => {
        if (selectedRound !== 'ALL' && m.round !== selectedRound) return false;
        if (selectedStatus !== 'ALL' && m.status !== selectedStatus) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const teamAName = (teams[m.teamAId]?.name || '').toLowerCase();
          const teamBName = (teams[m.teamBId]?.name || '').toLowerCase();
          const pitch = (m.pitch || '').toLowerCase();
          if (!teamAName.includes(q) && !teamBName.includes(q) && !pitch.includes(q)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        // Live first, then upcoming, then finished; then by round and time
        const statusOrder = { live: 0, upcoming: 1, finished: 2 };
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }
        return a.round - b.round;
      });
  }, [matches, teams, selectedRound, selectedStatus, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Masthead Banner for Matches Schedule */}
      <div className="bg-gradient-to-r from-[#123624] via-[#16442d] to-[#0c2619] border border-emerald-600/40 rounded-2xl p-4 sm:p-5 shadow-xl flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-400 text-amber-950 flex items-center justify-center font-black shadow-lg shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-black text-white font-['Lalezar',sans-serif]">
              جدول مباريات {cfg.name}
            </h2>
            <p className="text-xs text-emerald-300">
              مواعيد المواجهات الشعبية، النتائج الحية، الملاعب ومسجلي الأهداف
            </p>
          </div>
        </div>

        {/* Quick status summary pills */}
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-black/40 text-emerald-200 border border-emerald-700/50">
            إجمالي اللقاءات: {Object.keys(matches).length}
          </span>
          {onGoToAdmin && (
            <button
              type="button"
              onClick={onGoToAdmin}
              className="px-3 py-1.5 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              + إضافة / تعديل مباراة
            </button>
          )}
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-[#101e15] border border-emerald-800/40 rounded-xl p-3 space-y-2.5 text-xs">
        {/* Round Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-emerald-400 font-bold shrink-0 ml-1">الجولة:</span>
          <button
            type="button"
            onClick={() => setSelectedRound('ALL')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 ${
              selectedRound === 'ALL'
                ? 'bg-amber-400 text-amber-950 shadow-sm'
                : 'bg-[#0a140f] text-emerald-300 hover:text-white border border-emerald-800/60'
            }`}
          >
            كل الجولات
          </button>
          {roundNumbers.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setSelectedRound(r)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 ${
                selectedRound === r
                  ? 'bg-amber-400 text-amber-950 shadow-sm'
                  : 'bg-[#0a140f] text-emerald-300 hover:text-white border border-emerald-800/60'
              }`}
            >
              الجولة {r}
            </button>
          ))}
        </div>

        {/* Status Filter & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <div className="sm:col-span-7 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="text-emerald-400 font-bold shrink-0 ml-1">الحالة:</span>
            <button
              type="button"
              onClick={() => setSelectedStatus('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 ${
                selectedStatus === 'ALL'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#070e09] text-emerald-400 border border-emerald-800/50'
              }`}
            >
              الكل ({Object.keys(matches).length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('live')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 flex items-center gap-1 ${
                selectedStatus === 'live'
                  ? 'bg-red-600 text-white'
                  : 'bg-[#070e09] text-red-400 border border-emerald-800/50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-400 animate-ping inline-block" />
              مباشر الآن
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('upcoming')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 ${
                selectedStatus === 'upcoming'
                  ? 'bg-amber-500 text-amber-950 font-black'
                  : 'bg-[#070e09] text-amber-300 border border-emerald-800/50'
              }`}
            >
              القادمة
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('finished')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 ${
                selectedStatus === 'finished'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-[#070e09] text-emerald-300 border border-emerald-800/50'
              }`}
            >
              المنتهية
            </button>
          </div>

          <div className="sm:col-span-5 relative">
            <input
              type="text"
              placeholder="ابحث بالفريق أو الملعب..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#070e09] border border-emerald-700/60 rounded-lg py-1.5 pr-8 pl-3 text-white placeholder-emerald-600 focus:outline-none focus:border-amber-400 text-xs"
            />
            <Search className="w-3.5 h-3.5 text-emerald-500 absolute top-2.5 right-2.5" />
          </div>
        </div>
      </div>

      {/* Matches List */}
      <div className="space-y-3">
        {filteredMatches.length === 0 ? (
          <div className="bg-[#122218] border border-emerald-800/50 rounded-2xl p-12 text-center text-emerald-400/80">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-40" />
            <p className="font-bold text-base">لا توجد مباريات مسجلة لهذا الاختيار</p>
            <p className="text-xs text-emerald-500 mt-1">
              اختر جولة أخرى أو قم بإضافة مباريات جديدة من لوحة المنظم
            </p>
          </div>
        ) : (
          filteredMatches.map((match) => {
            const teamA = teams[match.teamAId];
            const teamB = teams[match.teamBId];
            const isExpanded = expandedMatchId === match.id;
            const isFinished = match.status === 'finished';
            const isLive = match.status === 'live';

            return (
              <div
                key={match.id}
                className={`bg-[#122218] border rounded-2xl overflow-hidden shadow-lg transition-all ${
                  isLive
                    ? 'border-red-500/80 shadow-red-950/40 ring-1 ring-red-500/40'
                    : isFinished
                    ? 'border-emerald-700/50'
                    : 'border-emerald-800/60'
                }`}
              >
                {/* Match Top Meta Header */}
                <div className="px-4 py-2 bg-[#0a150e] border-b border-emerald-900/60 flex items-center justify-between text-xs text-emerald-400/90 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-amber-300">الجولة {match.round}</span>
                    <span>•</span>
                    {match.date && (
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3 text-emerald-500" />
                        {match.date}
                      </span>
                    )}
                    {match.time && (
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-emerald-500" />
                        {match.time}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {match.pitch && (
                      <span className="flex items-center gap-1 text-emerald-300 text-[11px]">
                        <MapPin className="w-3 h-3 text-emerald-500" />
                        {match.pitch}
                      </span>
                    )}

                    {/* Status Badge */}
                    {isLive ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white font-black text-[10px] flex items-center gap-1 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        مباشر الآن
                      </span>
                    ) : isFinished ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-800 text-emerald-200 font-bold text-[10px]">
                        انتهت
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold text-[10px]">
                        قادمة
                      </span>
                    )}
                  </div>
                </div>

                {/* Scoreboard Presentation */}
                <div className="p-4 sm:p-5 flex items-center justify-between gap-3 sm:gap-6">
                  {/* Team A */}
                  <div className="flex-1 flex items-center gap-3 justify-end text-right min-w-0">
                    <div className="min-w-0">
                      <h4 className="font-black text-sm sm:text-base text-white truncate">
                        {teamA?.name || 'فريق أ'}
                      </h4>
                      <span className="text-[10px] text-emerald-400 font-semibold block">
                        صاحب الأرض
                      </span>
                    </div>
                    <div className="shrink-0">
                      <JerseyKit
                        c1={teamA?.c1}
                        c2={teamA?.c2}
                        pat={teamA?.pat}
                        num={10}
                        kitUrl={teamA?.kitUrl}
                        size="md"
                      />
                    </div>
                  </div>

                  {/* Score or VS Badge in Middle */}
                  <div className="shrink-0 flex flex-col items-center justify-center px-3 sm:px-6">
                    {isFinished || isLive ? (
                      <div className="flex items-center gap-2 bg-[#09140d] px-4 py-2 rounded-2xl border border-emerald-700/60 shadow-inner">
                        <span className="text-2xl sm:text-3xl font-black text-white font-['Lalezar',sans-serif]">
                          {match.scoreA ?? 0}
                        </span>
                        <span className="text-emerald-500 font-bold text-lg">-</span>
                        <span className="text-2xl sm:text-3xl font-black text-white font-['Lalezar',sans-serif]">
                          {match.scoreB ?? 0}
                        </span>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-[#09140d] border border-emerald-800 flex items-center justify-center font-black text-amber-400 text-sm shadow-inner">
                        VS
                      </div>
                    )}
                    <span className="text-[10px] text-emerald-400 mt-1 font-mono">
                      {isLive ? 'الشوط الثاني' : match.time || 'موعد اللقاء'}
                    </span>
                  </div>

                  {/* Team B */}
                  <div className="flex-1 flex items-center gap-3 justify-start text-left min-w-0">
                    <div className="shrink-0">
                      <JerseyKit
                        c1={teamB?.c1}
                        c2={teamB?.c2}
                        pat={teamB?.pat}
                        num={7}
                        kitUrl={teamB?.kitUrl}
                        size="md"
                      />
                    </div>
                    <div className="min-w-0 text-right sm:text-left">
                      <h4 className="font-black text-sm sm:text-base text-white truncate">
                        {teamB?.name || 'فريق ب'}
                      </h4>
                      <span className="text-[10px] text-emerald-400 font-semibold block">
                        الضيف
                      </span>
                    </div>
                  </div>
                </div>

                {/* Scorers & Details Collapsible Preview */}
                {(match.scorersA?.length || match.scorersB?.length || match.motm || match.notes) && (
                  <div className="border-t border-emerald-800/40 bg-[#04100c]">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedMatchId(isExpanded ? null : match.id)
                      }
                      className="w-full px-4 py-2 flex items-center justify-between text-xs font-bold text-emerald-400 hover:text-emerald-200 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                        {isExpanded ? 'إخفاء تفاصيل وأهداف اللقاء' : 'عرض مسجلي الأهداف ورجل المباراة'}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 space-y-2.5 text-xs text-emerald-200 animate-in fade-in duration-150">
                        {/* Scorers columns */}
                        <div className="grid grid-cols-2 gap-3 bg-[#08120b] p-3 rounded-xl border border-emerald-900/60">
                          <div>
                            <span className="font-bold text-emerald-400 block mb-1">
                              ⚽ أهداف {teamA?.name}:
                            </span>
                            {match.scorersA && match.scorersA.length > 0 ? (
                              <ul className="list-disc list-inside space-y-0.5 text-white">
                                {match.scorersA.map((s, idx) => (
                                  <li key={idx}>{s}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-emerald-600 text-[11px]">لا يوجد</span>
                            )}
                          </div>

                          <div className="text-right">
                            <span className="font-bold text-emerald-400 block mb-1">
                              ⚽ أهداف {teamB?.name}:
                            </span>
                            {match.scorersB && match.scorersB.length > 0 ? (
                              <ul className="list-disc list-inside space-y-0.5 text-white">
                                {match.scorersB.map((s, idx) => (
                                  <li key={idx}>{s}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-emerald-600 text-[11px]">لا يوجد</span>
                            )}
                          </div>
                        </div>

                        {/* Man of the match */}
                        {match.motm && (
                          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-1.5 text-amber-300">
                            <Star className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>
                              <b>رجل المباراة:</b> {match.motm}
                            </span>
                          </div>
                        )}

                        {/* Notes */}
                        {match.notes && (
                          <div className="text-[11px] text-emerald-400/90 italic bg-[#0a160f] p-2 rounded-lg border border-emerald-800/40">
                            {match.notes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
