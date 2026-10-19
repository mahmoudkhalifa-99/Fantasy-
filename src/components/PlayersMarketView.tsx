import React, { useState, useMemo } from 'react';
import { Player, Team, Position } from '../types';
import { JerseyKit } from './JerseyKit';
import { POSITIONS_SHORT, POS_ORDER, calculatePlayerTotalPoints } from '../utils/fantasyScoring';
import { Search, Shirt } from 'lucide-react';

interface PlayersMarketViewProps {
  players: Record<string, Player>;
  teams: Record<string, Team>;
  allRoundStats: Record<number, { p: Record<string, any> }>;
}

export const PlayersMarketView: React.FC<PlayersMarketViewProps> = ({
  players,
  teams,
  allRoundStats,
}) => {
  const [selectedPos, setSelectedPos] = useState<Position | 'ALL'>('ALL');
  const [selectedTeam, setSelectedTeam] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'points_desc' | 'price_desc' | 'price_asc'>('points_desc');

  const playerList = useMemo(() => {
    return Object.values(players)
      .map((p) => {
        const totPts = calculatePlayerTotalPoints(p.id, players, allRoundStats);
        return {
          ...p,
          totalPoints: totPts,
        };
      })
      .filter((p) => {
        if (selectedPos !== 'ALL' && p.pos !== selectedPos) return false;
        if (selectedTeam !== 'ALL' && p.teamId !== selectedTeam) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const pName = p.name.toLowerCase();
          const tName = (teams[p.teamId]?.name || '').toLowerCase();
          if (!pName.includes(q) && !tName.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'points_desc') return b.totalPoints - a.totalPoints;
        if (sortBy === 'price_desc') return b.price - a.price;
        if (sortBy === 'price_asc') return a.price - b.price;
        return 0;
      });
  }, [players, teams, selectedPos, selectedTeam, searchQuery, sortBy, allRoundStats]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#122218] border border-emerald-600/40 rounded-2xl p-4 shadow-xl flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-amber-950 flex items-center justify-center font-bold">
            <Shirt className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white font-['Lalezar',sans-serif]">
              سوق ونجوم الدورة ({playerList.length} لاعب)
            </h2>
            <p className="text-xs text-emerald-300">
              استكشف أسعار وإحصائيات جميع لاعبي الفرق الشعبية المشاركة
            </p>
          </div>
        </div>

        {/* Position Filter Tabs */}
        <div className="flex items-center gap-1 bg-[#0a140f] p-1 rounded-xl border border-emerald-800/60 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedPos('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              selectedPos === 'ALL'
                ? 'bg-amber-400 text-amber-950 shadow-sm'
                : 'text-emerald-300 hover:text-white'
            }`}
          >
            الكل
          </button>
          {POS_ORDER.map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setSelectedPos(pos)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                selectedPos === pos
                  ? 'bg-amber-400 text-amber-950 shadow-sm'
                  : 'text-emerald-300 hover:text-white'
              }`}
            >
              {POSITIONS_SHORT[pos]}
            </button>
          ))}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-[#101e15] border border-emerald-800/40 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
        <div className="sm:col-span-6 relative">
          <input
            type="text"
            placeholder="ابحث بالاسم أو الفريق..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#070e09] border border-emerald-700/60 rounded-lg py-2 pr-8 pl-3 text-white placeholder-emerald-600 focus:outline-none focus:border-amber-400"
          />
          <Search className="w-4 h-4 text-emerald-500 absolute top-2.5 right-2.5" />
        </div>

        <div className="sm:col-span-3">
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="w-full bg-[#070e09] border border-emerald-700/60 rounded-lg py-2 px-2.5 text-emerald-200 focus:outline-none focus:border-amber-400"
          >
            <option value="ALL">كل الفرق</option>
            {Object.values(teams).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full bg-[#070e09] border border-emerald-700/60 rounded-lg py-2 px-2.5 text-emerald-200 focus:outline-none focus:border-amber-400"
          >
            <option value="points_desc">الأعلى نقاطاً</option>
            <option value="price_desc">الأغلى سعراً</option>
            <option value="price_asc">الأرخص سعراً</option>
          </select>
        </div>
      </div>

      {/* Players List Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {playerList.map((player) => {
          const team = teams[player.teamId];

          return (
            <div
              key={player.id}
              className="bg-[#122218] border border-emerald-700/40 hover:border-emerald-500/70 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-md transition-all hover:bg-[#14281c]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <JerseyKit
                  c1={team?.c1}
                  c2={team?.c2}
                  pat={team?.pat}
                  num={player.num}
                  kitUrl={team?.kitUrl}
                  size="md"
                />

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-sm truncate">
                      {player.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-black bg-emerald-950 text-emerald-300">
                      {POSITIONS_SHORT[player.pos]}
                    </span>
                  </div>

                  <div className="text-xs text-emerald-400/80 mt-0.5">
                    {team?.name || 'فريق'}
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-xs">
                    <span className="font-bold text-amber-300 font-mono">
                      {player.price} م
                    </span>
                    <span className="text-emerald-300 font-bold">
                      {player.totalPoints} نقطة
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
