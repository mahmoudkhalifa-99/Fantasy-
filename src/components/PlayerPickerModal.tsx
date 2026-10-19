import React, { useState, useMemo } from 'react';
import { Player, Team, Position, TournamentConfig, Match, Entry } from '../types';
import { PlayerProfileSheet } from './PlayerProfileSheet';
import { swipeRightHandlers } from '../utils/swipe';
import { JerseyKit } from './JerseyKit';
import { POSITIONS_SHORT, POS_ORDER, parseFormation, calculatePlayerTotalPoints } from '../utils/fantasyScoring';
import { Search, X, Check, AlertCircle, ArrowUpDown } from 'lucide-react';

interface PlayerPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlayer: (player: Player) => void;
  targetPos: Position | 'ALL';
  squadIds: string[];
  players: Record<string, Player>;
  teams: Record<string, Team>;
  cfg: TournamentConfig;
  formation: string;
  allRoundStats: Record<number, { p: Record<string, any> }>;
  matches?: Record<string, Match>;
  entries?: Record<string, Entry>;
  replacingId?: string | null; // لو بنبدّل لاعب موجود في التشكيلة (بنحسب القيود من غيره)
}

export const PlayerPickerModal: React.FC<PlayerPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectPlayer,
  targetPos,
  squadIds,
  players,
  teams,
  cfg,
  formation,
  allRoundStats,
  matches = {},
  entries,
  replacingId = null,
}) => {
  const [selectedPos, setSelectedPos] = useState<Position | 'ALL'>(targetPos || 'ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'price_desc' | 'price_asc' | 'points_desc'>('price_desc');
  const [profileId, setProfileId] = useState<string | null>(null);

  // Sync initial target position when modal opens
  React.useEffect(() => {
    if (targetPos) {
      setSelectedPos(targetPos);
    }
  }, [targetPos, isOpen]);

  // Compute current squad metrics
  const squadMetrics = useMemo(() => {
    let spent = 0;
    const posCounts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    const teamCounts: Record<string, number> = {};

    // وقت التبديل: التشكيلة المحسوبة هي من غير اللاعب اللي هيتبدّل
    squadIds.forEach((id) => {
      if (replacingId && id === replacingId) return;
      const p = players[id];
      if (p) {
        spent += Number(p.price) || 0;
        posCounts[p.pos] = (posCounts[p.pos] || 0) + 1;
        if (p.pos !== 'GK') teamCounts[p.teamId] = (teamCounts[p.teamId] || 0) + 1; // الحراس مستثنيين من حد الفريق
      }
    });

    const budgetRemaining = Math.max(0, cfg.budget - spent);
    return { spent, budgetRemaining, posCounts, teamCounts };
  }, [squadIds, players, cfg.budget, replacingId]);

  const reqForm = parseFormation(formation);

  // Filter and sort players
  const filteredPlayers = useMemo(() => {
    const list = Object.values(players).map((p) => {
      const totPts = calculatePlayerTotalPoints(p.id, players, allRoundStats);
      return {
        ...p,
        totalPoints: totPts,
      };
    });

    return list
      .filter((p) => {
        // Position filter
        if (selectedPos !== 'ALL' && p.pos !== selectedPos) return false;
        // Team filter
        if (teamFilter !== 'ALL' && p.teamId !== teamFilter) return false;
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const teamName = (teams[p.teamId]?.name || '').toLowerCase();
          const pName = p.name.toLowerCase();
          if (!pName.includes(q) && !teamName.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price_desc') return b.price - a.price;
        if (sortBy === 'price_asc') return a.price - b.price;
        if (sortBy === 'points_desc') return b.totalPoints - a.totalPoints;
        return 0;
      });
  }, [players, teams, selectedPos, teamFilter, searchQuery, sortBy, allRoundStats]);

  // Check if player can be added
  const getAddRestriction = (player: Player): string | null => {
    if (squadIds.includes(player.id)) {
      return 'موجود بالتشكيلة';
    }
    if (!replacingId && squadIds.length >= 7) {
      return 'التشكيلة مكتملة (7 لاعبين)';
    }
    if (replacingId && players[replacingId] && players[replacingId].pos !== player.pos) {
      return `التبديل لازم يكون بنفس المركز (${POSITIONS_SHORT[players[replacingId].pos]})`;
    }
    const currentPosCount = squadMetrics.posCounts[player.pos] || 0;
    const maxAllowedForPos = reqForm[player.pos];
    if (currentPosCount >= maxAllowedForPos) {
      return `اكتمل مركز ${POSITIONS_SHORT[player.pos]} في خطة ${formation}`;
    }
    const currentFromTeam = squadMetrics.teamCounts[player.teamId] || 0;
    if (player.pos !== 'GK' && currentFromTeam >= cfg.maxPerTeam) {
      return `وصلت للحد (${cfg.maxPerTeam}) من فريق ${teams[player.teamId]?.name || ''}`;
    }
    if (player.price > squadMetrics.budgetRemaining + 0.001) {
      return `السعر أعلى من المتبقي (${squadMetrics.budgetRemaining.toFixed(1)}م)`;
    }
    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#13231a] border border-emerald-600/40 rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-emerald-800/60 bg-[#0d1812] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-amber-400 font-['Lalezar',sans-serif]">
              سوق اللاعبين · اختيار التشكيلة
            </h3>
            <p className="text-xs text-emerald-300">
              الميزانية المتبقية: <span className="font-bold text-amber-300">{squadMetrics.budgetRemaining.toFixed(1)} م</span> · اللاعبون: {squadIds.length}/7
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-400 hover:text-white hover:bg-emerald-800/40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters Bar */}
        <div className="p-3 bg-[#111f17] border-b border-emerald-800/40 space-y-2.5">
          {/* Position tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedPos('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                selectedPos === 'ALL'
                  ? 'bg-amber-400 text-amber-950 shadow-md'
                  : 'bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60'
              }`}
            >
              جميع المراكز ({Object.keys(players).length})
            </button>
            {POS_ORDER.map((pos) => {
              const count = Object.values(players).filter((p) => p.pos === pos).length;
              return (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setSelectedPos(pos)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                    selectedPos === pos
                      ? 'bg-amber-400 text-amber-950 shadow-md'
                      : 'bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60'
                  }`}
                >
                  {POSITIONS_SHORT[pos]} ({count})
                </button>
              );
            })}
          </div>

          {/* Search and Team Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-6 relative">
              <input
                type="text"
                placeholder="ابحث باسم اللاعب أو الفريق..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0a140e] border border-emerald-700/50 rounded-lg py-1.5 pr-8 pl-3 text-xs text-white placeholder-emerald-600 focus:outline-none focus:border-amber-400"
              />
              <Search className="w-4 h-4 text-emerald-500 absolute top-2 right-2.5" />
            </div>

            <div className="sm:col-span-3">
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="w-full bg-[#0a140e] border border-emerald-700/50 rounded-lg py-1.5 px-2 text-xs text-emerald-200 focus:outline-none focus:border-amber-400"
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
                className="w-full bg-[#0a140e] border border-emerald-700/50 rounded-lg py-1.5 px-2 text-xs text-emerald-200 focus:outline-none focus:border-amber-400"
              >
                <option value="price_desc">الأغلى سعراً</option>
                <option value="price_asc">الأقل سعراً</option>
                <option value="points_desc">الأعلى نقاطاً</option>
              </select>
            </div>
          </div>
        </div>

        <div className="px-3 py-1.5 text-[11px] text-sky-300 bg-sky-950/30 border-b border-emerald-800/40 text-center">
          👉 اسحب أي لاعب لليمين (أو دوس 📊) عشان تشوف إحصائياته والماتش الجاي
        </div>

        {/* Players List */}
        <div className="p-3 overflow-y-auto divide-y divide-emerald-800/30 flex-1 space-y-1">
          {filteredPlayers.length === 0 ? (
            <div className="py-12 text-center text-emerald-400/80">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="font-semibold">لا يوجد لاعبين مطابقين للبحث</p>
            </div>
          ) : (
            filteredPlayers.map((player) => {
              const team = teams[player.teamId];
              const restriction = getAddRestriction(player);
              const isSelected = squadIds.includes(player.id);

              return (
                <div
                  key={player.id}
                  {...swipeRightHandlers(() => setProfileId(player.id))}
                  className={`flex items-center justify-between p-2.5 rounded-xl transition-colors ${
                    isSelected
                      ? 'bg-emerald-950/40 border border-emerald-500/30'
                      : 'hover:bg-emerald-900/20'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <JerseyKit
                      c1={team?.c1}
                      c2={team?.c2}
                      pat={team?.pat}
                      num={player.num}
                      kitUrl={team?.kitUrl}
                      size="sm"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-sm truncate">
                          {player.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-black bg-emerald-800/70 text-emerald-200">
                          {POSITIONS_SHORT[player.pos]}
                        </span>
                      </div>

                      <div className="text-xs text-emerald-400/80 flex items-center gap-2 mt-0.5">
                        <span>{team?.name || 'فريق'}</span>
                        <span>•</span>
                        <span className="text-amber-300 font-bold">{player.price} م</span>
                        <span>•</span>
                        <span>{player.totalPoints} نقطة</span>
                      </div>

                      {restriction && !isSelected && (
                        <div className="text-[11px] text-red-400 font-medium mt-0.5">
                          {restriction}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setProfileId(player.id)}
                      className="px-2 py-1.5 rounded-lg text-xs font-bold bg-sky-900/40 text-sky-300 hover:bg-sky-800/50"
                      title="إحصائيات اللاعب"
                    >
                      📊
                    </button>
                    {isSelected ? (
                      <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-700/40 text-emerald-300 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        بالتشكيلة
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!!restriction}
                        onClick={() => {
                          onSelectPlayer(player);
                          onClose();
                        }}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                          restriction
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95'
                        }`}
                      >
                        {replacingId ? 'تبديل' : 'إضافة'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {profileId && players[profileId] && (() => {
        const pl = players[profileId];
        const restriction = getAddRestriction(pl);
        const inSquad = squadIds.includes(pl.id);
        return (
          <PlayerProfileSheet
            player={pl}
            teams={teams}
            matches={matches}
            allRoundStats={allRoundStats}
            entries={entries}
            cfg={cfg}
            onClose={() => setProfileId(null)}
            action={
              inSquad
                ? { label: 'موجود بالتشكيلة ✓', disabled: true, onClick: () => {} }
                : {
                    label: 'إضافة للتشكيلة',
                    disabled: !!restriction,
                    note: restriction || undefined,
                    onClick: () => {
                      onSelectPlayer(pl);
                      setProfileId(null);
                      onClose();
                    },
                  }
            }
          />
        );
      })()}
    </div>
  );
};
