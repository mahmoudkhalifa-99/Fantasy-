import React, { useState } from 'react';
import { Match, Team, TournamentConfig, TopStoryAd } from '../types';
import { JerseyKit } from './JerseyKit';
import {
  Calendar,
  Clock,
  MapPin,
  ChevronLeft,
  Trophy,
  Flame,
  Award,
  Sparkles,
  Phone,
  MessageCircle,
  X,
  ExternalLink,
} from 'lucide-react';

interface PLScreenLatestProps {
  matches: Record<string, Match>;
  teams: Record<string, Team>;
  cfg: TournamentConfig;
  topStories?: Record<string, TopStoryAd>;
  onOpenAdBooking?: () => void;
  onNavigateToFantasy: () => void;
  onNavigateToSeason: () => void;
  onSelectMatch?: (match: Match) => void;
}

export const PLScreenLatest: React.FC<PLScreenLatestProps> = ({
  matches,
  teams,
  cfg,
  topStories = {},
  onOpenAdBooking,
  onNavigateToFantasy,
  onNavigateToSeason,
  onSelectMatch,
}) => {
  const [selectedAdModal, setSelectedAdModal] = useState<TopStoryAd | null>(null);

  // Group matches for today
  const matchList = Object.values(matches);
  const liveMatch = matchList.find((m) => m.status === 'live');
  const upcomingMatches = matchList.filter((m) => m.status !== 'finished');
  const finishedMatches = matchList.filter((m) => m.status === 'finished');

  // Stories list (filtered by active)
  const storiesList = Object.values(topStories).filter((s) => s.active !== false);

  const handleStoryClick = (story: TopStoryAd) => {
    switch (story.actionType) {
      case 'live':
        onNavigateToSeason();
        break;
      case 'season':
        onNavigateToSeason();
        break;
      case 'fantasy':
        onNavigateToFantasy();
        break;
      case 'modal':
        setSelectedAdModal(story);
        break;
      case 'link':
        if (story.linkUrl) {
          window.open(story.linkUrl, '_blank');
        } else if (story.whatsapp) {
          window.open(`https://wa.me/${story.whatsapp}`, '_blank');
        }
        break;
      default:
        setSelectedAdModal(story);
        break;
    }
  };

  return (
    <div className="space-y-4 pb-4 animate-in fade-in duration-200" dir="rtl">
      {/* Top Circular Stories / Ads Widget (الاعلانات والقصص العلوية القابلة للتحكم بالكامل) */}
      <div className="flex items-center gap-3.5 overflow-x-auto pb-1 pt-1 px-1 scrollbar-none">
        {storiesList.map((story) => (
          <div
            key={story.id}
            onClick={() => handleStoryClick(story)}
            className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group select-none"
          >
            {/* Outer Circular Gradient Ring */}
            <div
              className={`relative w-16 h-16 rounded-full p-[2.5px] bg-gradient-to-tr ${
                story.colorGradient || 'from-amber-400 via-rose-500 to-indigo-600'
              } shadow-md transition-transform group-hover:scale-105 active:scale-95`}
            >
              <div
                className={`w-full h-full rounded-full ${
                  story.innerBg || 'bg-[#182a20] dark:bg-[#122218]'
                } flex flex-col items-center justify-center text-center p-1 border-2 border-white`}
              >
                {story.subtitle && (
                  <span className="text-[8px] font-black text-amber-300 tracking-tighter uppercase leading-none truncate max-w-[50px]">
                    {story.subtitle}
                  </span>
                )}

                <div className="text-xs font-black text-white font-mono my-0.5 truncate max-w-[48px]">
                  {story.iconText || '✦'}
                </div>

                {story.tag && (
                  <span className="absolute -bottom-1 bg-amber-400 text-amber-950 text-[8.5px] font-black px-1.5 py-0.2 rounded-full uppercase shadow font-mono">
                    {story.tag}
                  </span>
                )}
              </div>
            </div>

            <span className="text-[11px] font-black text-gray-800 dark:text-gray-200 text-center truncate max-w-[68px]">
              {story.title}
            </span>
          </div>
        ))}
        {onOpenAdBooking && (
          <div onClick={onOpenAdBooking} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer select-none">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-amber-400/70 flex items-center justify-center text-2xl">📢</div>
            <span className="text-[11px] font-black text-gray-800 dark:text-gray-200">أعلن معانا</span>
          </div>
        )}
      </div>

      {/* Matches List (White Card with Fixture Rows as in Screenshot 1) */}
      <div className="bg-white dark:bg-[#15251c] border border-gray-200 dark:border-emerald-900/60 rounded-3xl shadow-xl overflow-hidden divide-y divide-gray-100 dark:divide-emerald-900/40">
        <div className="p-4 bg-gray-50/80 dark:bg-[#101e16] flex items-center justify-between border-b border-gray-100 dark:border-emerald-900/40">
          <span className="text-xs font-black text-gray-800 dark:text-gray-100 font-['Lalezar',sans-serif]">
            مباريات الجولة {cfg.round}
          </span>
          <button
            type="button"
            onClick={onNavigateToSeason}
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>عرض كل الجداول</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Matches Rows */}
        {matchList.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-xs">
            لا توجد مباريات مسجلة حالياً
          </div>
        ) : (
          matchList.slice(0, 5).map((match) => {
            const teamA = teams[match.teamAId];
            const teamB = teams[match.teamBId];
            const isFinished = match.status === 'finished';
            const isLive = match.status === 'live';

            return (
              <div
                key={match.id}
                onClick={() => onSelectMatch && onSelectMatch(match)}
                className="p-3.5 hover:bg-gray-50 dark:hover:bg-emerald-950/20 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  {/* Team A */}
                  <div className="flex-1 flex items-center gap-2 justify-start min-w-0">
                    <div className="w-7 h-8 shrink-0">
                      <JerseyKit
                        c1={teamA?.c1}
                        c2={teamA?.c2}
                        pat={teamA?.pat}
                        size="sm"
                      />
                    </div>
                    <span className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white truncate">
                      {teamA?.name || 'الفريق أ'}
                    </span>
                  </div>

                  {/* Score / Time Center */}
                  <div className="px-3 shrink-0 text-center">
                    {isFinished ? (
                      <div className="flex items-center gap-1 font-mono font-black text-sm bg-gray-100 dark:bg-emerald-950 px-2.5 py-1 rounded-xl text-gray-900 dark:text-white shadow-inner">
                        <span>{match.scoreA}</span>
                        <span>-</span>
                        <span>{match.scoreB}</span>
                      </div>
                    ) : isLive ? (
                      <div className="flex flex-col items-center">
                        <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse uppercase">
                          مباشر
                        </span>
                        <div className="font-mono font-black text-xs text-red-500 mt-0.5">
                          {match.scoreA ?? 0} - {match.scoreB ?? 0}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] font-bold text-gray-500 dark:text-emerald-400/80 bg-gray-50 dark:bg-emerald-950/60 px-2 py-1 rounded-lg">
                        {match.time || '08:00 م'}
                      </div>
                    )}
                  </div>

                  {/* Team B */}
                  <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
                    <span className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white truncate text-left">
                      {teamB?.name || 'الفريق ب'}
                    </span>
                    <div className="w-7 h-8 shrink-0">
                      <JerseyKit
                        c1={teamB?.c1}
                        c2={teamB?.c2}
                        pat={teamB?.pat}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Pitch Location Subline */}
                <div className="mt-1 text-[10px] text-gray-500 dark:text-emerald-400/70 flex items-center justify-between">
                  <span>{match.pitch || 'الملعب الرئيسي'}</span>
                  <span>الجولة {match.round}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Top Story Ad Details Modal */}
      {selectedAdModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedAdModal(null)}
          dir="rtl"
        >
          <div
            className="bg-[#122218] border border-amber-500/50 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className={`p-5 text-white bg-gradient-to-r ${
                selectedAdModal.colorGradient || 'from-amber-600 to-orange-600'
              } border-b border-white/20 relative`}
            >
              <button
                type="button"
                onClick={() => setSelectedAdModal(null)}
                className="absolute top-3 left-3 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-1">
                <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  {selectedAdModal.tag || 'إعلان راعي'}
                </span>
                <span className="text-[10px] text-white/80 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>دورة الساحة الشعبية</span>
                </span>
              </div>

              <h3 className="text-xl font-black font-['Lalezar',sans-serif]">
                {selectedAdModal.title}
              </h3>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3 text-emerald-100">
              <p className="text-xs sm:text-sm text-white/90 leading-relaxed font-medium bg-emerald-950/60 p-3 rounded-2xl border border-emerald-800/60">
                {selectedAdModal.detailsText ||
                  selectedAdModal.subtitle ||
                  'عرض خاص وراعي رسمي لبطولة الدورة الشعبية!'}
              </p>

              {/* Action buttons */}
              <div className="space-y-2 pt-1">
                {selectedAdModal.whatsapp && (
                  <a
                    href={`https://wa.me/${selectedAdModal.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>تواصل عبر واتساب</span>
                  </a>
                )}

                {selectedAdModal.phone && (
                  <a
                    href={`tel:${selectedAdModal.phone}`}
                    className="w-full py-2.5 px-4 bg-white hover:bg-gray-100 text-gray-950 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95"
                  >
                    <Phone className="w-4 h-4 text-emerald-700" />
                    <span>اتصال هاتفي ({selectedAdModal.phone})</span>
                  </a>
                )}
              </div>
            </div>

            <div className="p-3 bg-[#0a140e] border-t border-emerald-900/60 text-center">
              <button
                type="button"
                onClick={() => setSelectedAdModal(null)}
                className="text-xs text-emerald-400 hover:underline font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
