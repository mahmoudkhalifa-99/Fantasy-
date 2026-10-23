import React from 'react';
import {
  Newspaper,
  Shirt,
  Trophy,
} from 'lucide-react';

export type MainTab = 'latest' | 'fantasy' | 'season';

interface PLBottomNavProps {
  currentTab: MainTab;
  onChangeTab: (tab: MainTab) => void;
  userName?: string;
}

export const PLBottomNav: React.FC<PLBottomNavProps> = ({
  currentTab,
  onChangeTab,
}) => {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#04100c]/95 backdrop-blur-md border-t border-gray-200 dark:border-emerald-900/60 shadow-2xl py-1">
      {/* 3 Main Bottom Tabs: Latest (المباريات) | Fantasy (فانتازي) | Season (الترتيب والجدول) */}
      <nav className="flex items-center justify-around px-4 py-1.5 max-w-md mx-auto" dir="rtl">
        {/* Tab 1: Latest (المباريات) */}
        <button
          type="button"
          onClick={() => onChangeTab('latest')}
          className={`flex flex-col items-center justify-center py-1 px-4 rounded-xl text-xs font-bold transition-all flex-1 cursor-pointer ${
            currentTab === 'latest'
              ? 'text-emerald-700 dark:text-emerald-400 font-black scale-105'
              : 'text-gray-500 dark:text-emerald-400/70 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Newspaper className="w-5 h-5 mb-0.5" />
          <span>المباريات</span>
        </button>

        {/* Tab 2: Fantasy (فانتازي) */}
        <button
          type="button"
          onClick={() => onChangeTab('fantasy')}
          className={`flex flex-col items-center justify-center py-1 px-4 rounded-xl text-xs font-bold transition-all flex-1 cursor-pointer ${
            currentTab === 'fantasy'
              ? 'text-emerald-700 dark:text-emerald-400 font-black scale-105'
              : 'text-gray-500 dark:text-emerald-400/70 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Shirt className="w-5 h-5 mb-0.5" />
          <span>فانتازي</span>
        </button>

        {/* Tab 3: Season (الترتيب والجدول) */}
        <button
          type="button"
          onClick={() => onChangeTab('season')}
          className={`flex flex-col items-center justify-center py-1 px-4 rounded-xl text-xs font-bold transition-all flex-1 cursor-pointer ${
            currentTab === 'season'
              ? 'text-emerald-700 dark:text-emerald-400 font-black scale-105'
              : 'text-gray-500 dark:text-emerald-400/70 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Trophy className="w-5 h-5 mb-0.5" />
          <span>الترتيب والجدول</span>
        </button>
      </nav>
    </div>
  );
};
