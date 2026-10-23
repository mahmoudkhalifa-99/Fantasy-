import React, { useState } from 'react';
import {
  Player,
  Team,
  TournamentConfig,
  Position,
  Match,
  PlayerMatchStats,
} from '../types';
import { JerseyKit } from './JerseyKit';
import { PlayerProfileSheet } from './PlayerProfileSheet';
import { swipeRightHandlers } from '../utils/swipe';
import { buildPlayerProfile, playerMatchTimeline } from '../utils/playerProfile';
import { transferInfo } from '../utils/transfers';
import type { ChipType } from '../types';
import {
  calculatePlayerRoundPoints,
  calculatePlayerTotalPoints,
  POSITIONS_SHORT,
  POS_ORDER,
  parseFormation,
  SQUAD_SIZE,
} from '../utils/fantasyScoring';
import {
  ArrowLeft,
  ChevronDown,
  X,
  ExternalLink,
  Shield,
  Zap,
  TrendingUp,
  Flame,
  Award,
  Check,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';

interface PLTransfersViewProps {
  cfg: TournamentConfig;
  teams: Record<string, Team>;
  players: Record<string, Player>;
  matches: Record<string, Match>;
  allRoundStats: Record<number, { p: Record<string, PlayerMatchStats> }>;
  squadIds: string[];
  benchIds?: string[];
  captainId: string;
  formation: string;
  onBack: () => void;
  onSelectPlayerToReplace: (playerId: string) => void;
  onRemovePlayer: (playerId: string) => void;
  onOpenAddPlayerModal: (pos?: Position | 'ALL') => void;
  onConfirmTransfers: () => void;
  entries?: Record<string, any>;
  editRound: number;
  baseIds: string[] | null;
  activeChip: ChipType | null;
  chipsUsed: { wildcard: number | null; freehit: number | null };
  onChipChange: (chip: ChipType | null) => void;
}

export const PLTransfersView: React.FC<PLTransfersViewProps> = ({
  cfg,
  teams,
  players,
  matches,
  allRoundStats,
  squadIds,
  benchIds = [],
  captainId,
  formation,
  onBack,
  onSelectPlayerToReplace,
  onRemovePlayer,
  onOpenAddPlayerModal,
  onConfirmTransfers,
  entries,
  editRound,
  baseIds,
  activeChip,
  chipsUsed,
  onChipChange,
}) => {
  const [viewMode, setViewMode] = useState<'pitch' | 'list'>('pitch');
  const [selectedPlayerForSheet, setSelectedPlayerForSheet] = useState<Player | null>(null);
  const [profilePlayer, setProfilePlayer] = useState<Player | null>(null);
  const [opponentFilter, setOpponentFilter] = useState<string>('ALL');
  const tInfo = transferInfo(squadIds, baseIds, activeChip, cfg);

  // Compute budget
  const totalCost = [...squadIds, ...benchIds].reduce((sum, pid) => sum + (Number(players[pid]?.price) || 0), 0);
  const remainingBudget = Math.max(0, cfg.budget - totalCost);

  // Group squad by position
  const reqCounts = parseFormation(formation);
  const grouped: Record<Position, Player[]> = {
    FWD: [],
    MID: [],
    DEF: [],
    GK: [],
  };

  squadIds.forEach((id) => {
    const p = players[id];
    if (p && grouped[p.pos]) {
      grouped[p.pos].push(p);
    }
  });

  // Helper to get next match fixture string for player's team (e.g. "EVE (H)")
  const getPlayerFixture = (p: Player) => {
    const nextMatch = Object.values(matches).find(
      (m) => (m.teamAId === p.teamId || m.teamBId === p.teamId) && m.status !== 'finished'
    );
    if (!nextMatch) return 'TBD';
    const isHome = nextMatch.teamAId === p.teamId;
    const oppTeam = teams[isHome ? nextMatch.teamBId : nextMatch.teamAId];
    const shortName = oppTeam ? oppTeam.name.slice(0, 4) : 'OPP';
    return `${shortName} (${isHome ? 'H' : 'A'})`;
  };

  const sheetProfile = selectedPlayerForSheet
    ? buildPlayerProfile(selectedPlayerForSheet, matches, allRoundStats, entries, cfg)
    : null;

  const renderPlayerSlot = (player: Player) => {
    const team = teams[player.teamId];
    const isCaptain = player.id === captainId;
    const fixtureText = getPlayerFixture(player);

    return (
      <div
        key={player.id}
        onClick={() => setSelectedPlayerForSheet(player)}
        {...swipeRightHandlers(() => setProfilePlayer(player))}
        className="flex flex-col items-center cursor-pointer group transition-transform active:scale-95 select-none w-[70px] sm:w-[86px]"
      >
        {/* Price Tag badge above jersey (e.g. £6.0m) */}
        <div className="bg-[#102a1d] text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-500/40 shadow-sm mb-0.5">
          £{player.price}m
        </div>

        {/* Jersey Graphic */}
        <div className="relative py-0.5">
          <JerseyKit
            c1={team?.c1}
            c2={team?.c2}
            pat={team?.pat}
            num={player.num}
            kitUrl={team?.kitUrl}
            isCaptain={isCaptain}
            size="md"
          />
        </div>

        {/* White rounded box below shirt: Player Name + Fixture (Exactly as in screenshot) */}
        <div className="w-full bg-white dark:bg-[#0f1f16] rounded-md shadow-md border border-gray-200 dark:border-emerald-800/80 text-center overflow-hidden mt-0.5">
          <div className="px-1 py-0.5 text-[11px] font-extrabold text-gray-900 dark:text-white truncate">
            {player.name}
          </div>
          <div className="bg-gray-100 dark:bg-emerald-950/80 px-1 py-0.5 text-[9.5px] font-mono text-gray-600 dark:text-emerald-300 border-t border-gray-200 dark:border-emerald-800/60 truncate uppercase">
            {fixtureText}
          </div>
        </div>
      </div>
    );
  };

  const renderEmptySlot = (pos: Position, idx: number) => {
    return (
      <button
        key={`empty-${pos}-${idx}`}
        type="button"
        onClick={() => onOpenAddPlayerModal(pos)}
        className="flex flex-col items-center justify-center w-[70px] sm:w-[86px] h-[95px] rounded-xl border-2 border-dashed border-white/40 hover:border-amber-400 bg-white/10 hover:bg-white/20 transition-all text-white p-1"
      >
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center mb-1">
          <Plus className="w-4 h-4 text-white" />
        </div>
        <span className="text-[10px] font-bold text-white leading-tight">
          + {POSITIONS_SHORT[pos]}
        </span>
      </button>
    );
  };

  const renderRow = (pos: Position, requiredCount: number) => {
    const filled = grouped[pos] || [];
    const emptyCount = Math.max(0, requiredCount - filled.length);

    return (
      <div className="flex justify-center items-center gap-2 sm:gap-3 z-10 w-full min-h-[95px]">
        {filled.map((player) => renderPlayerSlot(player))}
        {Array.from({ length: emptyCount }).map((_, idx) => renderEmptySlot(pos, idx))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8faf9] dark:bg-[#04100c] text-gray-900 dark:text-[#e8f1ea] pb-24 font-['Cairo',sans-serif] animate-in fade-in duration-200">
      {/* Top Navigation Bar: Back Arrow | Transfers */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#04100c]/95 backdrop-blur-md border-b border-gray-200 dark:border-emerald-900/60 px-4 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-emerald-900/40 flex items-center justify-center text-gray-800 dark:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h1 className="text-lg font-black text-gray-900 dark:text-white font-['Lalezar',sans-serif]">
          Transfers
        </h1>

        <div className="w-8 h-8" />
      </div>

      <div className="max-w-md mx-auto px-3.5 pt-2.5 space-y-3">
        {/* الجولة اللي بتعدّل لها */}
        <div className="text-center text-xs font-bold text-gray-700 dark:text-emerald-300">
          <span>تعديل تشكيلة الجولة {editRound}</span>
          <span className="mx-2">•</span>
          <span>{cfg.locked ? 'الجولة الحالية اتقفلت' : 'التعديل مفتوح'}</span>
        </div>

        {/* شريط التحويلات: مجاني | التكلفة | الميزانية | الكروت */}
        <div className="bg-white dark:bg-[#15251c] border border-gray-200 dark:border-emerald-900/60 rounded-2xl p-3 shadow-md grid grid-cols-5 gap-1 text-center items-center">
          <div>
            <div className="text-base font-black text-gray-900 dark:text-white font-mono">
              {tInfo.unlimited ? '∞' : tInfo.freeLeft}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-emerald-400 font-bold leading-tight">
              تحويل مجاني
            </div>
            <div className="text-[8px] text-gray-400">
              {baseIds ? `عملت ${tInfo.made}` : 'أول تشكيلة'}
            </div>
          </div>

          <div>
            <div className={`text-base font-black font-mono ${tInfo.cost > 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
              {tInfo.cost > 0 ? `-${tInfo.cost}` : '0'}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-emerald-400 font-bold leading-tight">
              خصم نقاط
            </div>
            <div className="text-[8px] text-gray-400">{tInfo.penalty} لكل زيادة</div>
          </div>

          <div className="flex flex-col items-center">
            <div className="bg-emerald-600 text-white text-[11px] font-mono font-black px-2.5 py-0.5 rounded-full shadow-sm">
              {remainingBudget.toFixed(1)} م
            </div>
            <div className="text-[10px] text-gray-500 dark:text-emerald-400 font-bold leading-tight mt-0.5">
              الميزانية
            </div>
          </div>

          <button
            type="button"
            disabled={chipsUsed.wildcard !== null}
            onClick={() => onChipChange(activeChip === 'wildcard' ? null : 'wildcard')}
            className="flex flex-col items-center cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center border text-[10px] ${
                activeChip === 'wildcard'
                  ? 'bg-cyan-500 text-white border-cyan-400'
                  : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/40'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
            </div>
            <div className="text-[10px] font-bold text-gray-800 dark:text-gray-200 mt-0.5">
              وايلد كارد
            </div>
            <span className="text-[8px] text-gray-400">
              {activeChip === 'wildcard' ? 'شغّال ✓' : chipsUsed.wildcard !== null ? `اتلعب ج${chipsUsed.wildcard}` : 'متاح'}
            </span>
          </button>

          <button
            type="button"
            disabled={chipsUsed.freehit !== null}
            onClick={() => onChipChange(activeChip === 'freehit' ? null : 'freehit')}
            className="flex flex-col items-center cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center border text-[10px] ${
                activeChip === 'freehit'
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/40'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div className="text-[10px] font-bold text-gray-800 dark:text-gray-200 mt-0.5">
              فري هيت
            </div>
            <span className="text-[8px] text-gray-400">
              {activeChip === 'freehit' ? 'شغّال ✓' : chipsUsed.freehit !== null ? `اتلعب ج${chipsUsed.freehit}` : 'متاح'}
            </span>
          </button>
        </div>

        {activeChip && (
          <div className="text-center text-[11px] font-bold rounded-xl px-3 py-2 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
            {activeChip === 'wildcard'
              ? 'وايلد كارد: غيّر أي عدد من اللاعبين من غير خصم، ومتاح مرة واحدة في الدورة.'
              : 'فري هيت: غيّر براحتك للجولة دي بس، وتشكيلتك القديمة بترجع في الجولة اللي بعدها. مرة واحدة في الدورة.'}
          </div>
        )}

        {/* View Switcher & Opponent Filter (Pitch | List | Opponent ∨ - As in Screenshot 1) */}
        <div className="flex items-center justify-between gap-3">
          {/* Pitch vs List Toggle Pill */}
          <div className="bg-gray-200 dark:bg-[#15251c] p-1 rounded-full flex items-center border border-gray-300 dark:border-emerald-800">
            <button
              type="button"
              onClick={() => setViewMode('pitch')}
              className={`px-5 py-1 text-xs font-bold rounded-full transition-all ${
                viewMode === 'pitch'
                  ? 'bg-white dark:bg-emerald-700 text-gray-900 dark:text-white shadow-sm font-black'
                  : 'text-gray-600 dark:text-emerald-300 hover:text-black'
              }`}
            >
              Pitch
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-5 py-1 text-xs font-bold rounded-full transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-emerald-700 text-gray-900 dark:text-white shadow-sm font-black'
                  : 'text-gray-600 dark:text-emerald-300 hover:text-black'
              }`}
            >
              List
            </button>
          </div>

          {/* Opponent Filter Dropdown */}
          <div className="relative">
            <select
              value={opponentFilter}
              onChange={(e) => setOpponentFilter(e.target.value)}
              className="appearance-none bg-white dark:bg-[#15251c] border border-gray-300 dark:border-emerald-800 rounded-full py-1.5 pr-4 pl-8 text-xs font-bold text-gray-800 dark:text-emerald-200 shadow-sm focus:outline-none"
            >
              <option value="ALL">Opponent ∨</option>
              {Object.values(teams).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Green Football Pitch with Fantasy Top Goalposts (Matching Screenshot 1) */}
        {viewMode === 'pitch' ? (
          <div className="relative w-full rounded-3xl overflow-hidden border-2 border-emerald-500/40 shadow-2xl bg-gradient-to-b from-[#1b8a51] via-[#167041] to-[#0f4e2c]">
            {/* Turf striped overlay */}
            <div
              className="absolute inset-0 pointer-events-none opacity-25"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 32px, transparent 32px, transparent 64px)',
              }}
            />

            {/* Top goal banner with cyan 'Fantasy' banners on both sides (Exactly as in screenshot!) */}
            <div className="relative z-20 flex items-center justify-between px-3 pt-2">
              <div className="bg-[#00ff87] text-black font-black text-[10px] px-3 py-1 rounded-md shadow-md uppercase tracking-wider flex items-center gap-1">
                <span>🦁</span>
                <span>Fantasy</span>
              </div>

              {/* Goal outline */}
              <div className="w-28 h-4 border-b-2 border-x-2 border-white/60 rounded-b-md" />

              <div className="bg-[#963cff] text-white font-black text-[10px] px-3 py-1 rounded-md shadow-md uppercase tracking-wider flex items-center gap-1">
                <span>🦁</span>
                <span>Fantasy</span>
              </div>
            </div>

            {/* Pitch Markings */}
            <div className="absolute inset-2 top-8 border-2 border-white/35 rounded-2xl pointer-events-none">
              {/* Penalty Box */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-44 h-16 border-b-2 border-x-2 border-white/30 rounded-b-md" />
              {/* Penalty spot */}
              <div className="absolute top-11 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white/50" />
              {/* Center Circle */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-32 h-32 rounded-full border-2 border-white/30" />
            </div>

            {/* Squad Rows: GK, DEF, MID, FWD */}
            <div className="relative py-4 px-2 space-y-3 min-h-[460px] flex flex-col justify-around">
              {/* 1. Goalkeepers */}
              {renderRow('GK', reqCounts.GK)}

              {/* 2. Defenders */}
              {renderRow('DEF', reqCounts.DEF)}

              {/* 3. Midfielders */}
              {renderRow('MID', reqCounts.MID)}

              {/* 4. Forwards */}
              {renderRow('FWD', reqCounts.FWD)}
            </div>
          </div>
        ) : (
          /* List Mode */
          <div className="bg-white dark:bg-[#15251c] rounded-2xl border border-gray-200 dark:border-emerald-900/60 divide-y divide-gray-100 dark:divide-emerald-900/40 overflow-hidden shadow-md">
            {squadIds.map((pid) => {
              const p = players[pid];
              if (!p) return null;
              const t = teams[p.teamId];
              return (
                <div
                  key={pid}
                  onClick={() => setSelectedPlayerForSheet(p)}
                  {...swipeRightHandlers(() => setProfilePlayer(p))}
                  className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-emerald-950/30 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <JerseyKit
                      c1={t?.c1}
                      c2={t?.c2}
                      pat={t?.pat}
                      num={p.num}
                      size="sm"
                    />
                    <div>
                      <span className="font-extrabold text-sm block">{p.name}</span>
                      <span className="text-xs text-gray-500 dark:text-emerald-400">
                        {t?.name} • {POSITIONS_SHORT[p.pos]}
                      </span>
                    </div>
                  </div>

                  <div className="text-left font-mono">
                    <span className="font-bold text-emerald-600 dark:text-amber-300">
                      £{p.price}m
                    </span>
                    <span className="text-[10px] text-gray-400 block">{getPlayerFixture(p)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Fixed-style Action Bar: Add Player | Next (Matching Screenshot 1) */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => onOpenAddPlayerModal('ALL')}
            className="flex-1 py-3.5 px-4 bg-[#200030] hover:bg-[#2e0046] text-white rounded-full font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 border border-purple-900/60"
          >
            <span>Add Player (إضافة لاعب)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (
                tInfo.cost > 0 &&
                !window.confirm(`هتعمل ${tInfo.made} تحويلات والمجاني ${tInfo.free}، فهيتخصم ${tInfo.cost} نقطة من الجولة ${editRound}. تكمّل؟`)
              )
                return;
              onConfirmTransfers();
            }}
            className="flex-1 py-3.5 px-4 bg-gray-200 dark:bg-emerald-900/60 hover:bg-emerald-600 hover:text-white text-gray-800 dark:text-emerald-200 rounded-full font-black text-sm flex items-center justify-center gap-2 shadow transition-transform active:scale-95"
          >
            <span>{tInfo.cost > 0 ? `تأكيد (خصم ${tInfo.cost} نقطة)` : 'تأكيد التحويلات'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PLAYER DETAIL BOTTOM SHEET MODAL (Exactly matching Screenshot 2!) */}
      {/* ========================================================================= */}
      {selectedPlayerForSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#122218] rounded-t-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col border-t border-gray-200 dark:border-emerald-800 animate-in slide-in-from-bottom-8">
            {/* Grab handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-emerald-700/60" />
            </div>

            <div className="p-4 overflow-y-auto space-y-4">
              {/* Cyan / Blue Gradient Header Card (As in Screenshot 2) */}
              <div className="rounded-2xl p-4 text-white bg-gradient-to-r from-[#00d2ff] via-[#3a7bd5] to-[#6a11cb] relative overflow-hidden shadow-lg flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-white/90">
                    {selectedPlayerForSheet.pos === 'GK'
                      ? 'Goalkeeper'
                      : selectedPlayerForSheet.pos === 'DEF'
                      ? 'Defender'
                      : selectedPlayerForSheet.pos === 'MID'
                      ? 'Midfielder'
                      : 'Forward'}
                  </div>
                  <h3 className="text-xl font-black font-['Lalezar',sans-serif] leading-tight">
                    {selectedPlayerForSheet.name}
                  </h3>
                  <div className="text-xs text-white/90 font-medium">
                    {teams[selectedPlayerForSheet.teamId]?.name || 'فريق البطولة'}
                  </div>
                </div>

                {/* Jersey Avatar */}
                <div className="shrink-0">
                  <JerseyKit
                    c1={teams[selectedPlayerForSheet.teamId]?.c1}
                    c2={teams[selectedPlayerForSheet.teamId]?.c2}
                    pat={teams[selectedPlayerForSheet.teamId]?.pat}
                    num={selectedPlayerForSheet.num}
                    size="lg"
                  />
                </div>
              </div>

              {/* إحصائيات اللاعب */}
              <button
                type="button"
                onClick={() => setProfilePlayer(selectedPlayerForSheet)}
                className="w-full py-2.5 px-3 rounded-full border border-gray-300 dark:border-emerald-800 bg-gray-50 dark:bg-[#15251c] text-gray-800 dark:text-emerald-200 flex items-center justify-center gap-1.5 hover:bg-gray-100 text-xs font-bold"
              >
                <span>إحصائيات اللاعب</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              {/* السعر */}
              <div className="bg-gray-50 dark:bg-[#15251c] p-3 rounded-2xl border border-gray-200 dark:border-emerald-900/60 flex items-center justify-between">
                <div className="text-sm font-black text-gray-900 dark:text-white font-mono">السعر: {selectedPlayerForSheet.price}م</div>
                <div className="text-[11px] text-gray-500 dark:text-emerald-400 font-bold">
                  مختار بنسبة {sheetProfile?.selectedPct == null ? '—' : `${sheetProfile.selectedPct}%`}
                </div>
              </div>

              {/* نقاط/ماتش | الفورمة | الإجمالي (حقيقي من المباريات) */}
              <div className="bg-gray-50 dark:bg-[#15251c] p-3 rounded-2xl border border-gray-200 dark:border-emerald-900/60">
                <div className="grid grid-cols-3 text-center divide-x divide-gray-200 dark:divide-emerald-900/40">
                  <div>
                    <span className="text-[10px] text-gray-500 dark:text-emerald-400 font-bold block">نقاط/ماتش</span>
                    <span className="text-xl font-black font-mono text-gray-900 dark:text-white">{sheetProfile ? sheetProfile.avg.toFixed(1) : '0.0'}</span>
                    <span className="text-[9px] text-gray-400 block">لعب {sheetProfile?.played ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 dark:text-emerald-400 font-bold block">الفورمة</span>
                    <span className="text-xl font-black font-mono text-gray-900 dark:text-white">{sheetProfile ? sheetProfile.form.toFixed(1) : '0.0'}</span>
                    <span className="text-[9px] text-gray-400 block">آخر 3 جولات</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 dark:text-emerald-400 font-bold block">الإجمالي</span>
                    <span className="text-xl font-black font-mono text-gray-900 dark:text-white">{sheetProfile ? sheetProfile.total : 0}</span>
                    <span className="text-[9px] text-gray-400 block">نقطة</span>
                  </div>
                </div>
              </div>

              {/* النتائج السابقة والمواجهات القادمة (حقيقية من جدول المباريات) */}
              {(() => {
                const tl = playerMatchTimeline(selectedPlayerForSheet, matches, players);
                const oppName = (id: string) => teams[id]?.name || '—';
                const chip = (r?: string) => (r === 'W' ? 'bg-emerald-600' : r === 'L' ? 'bg-rose-600' : 'bg-gray-500');
                return (
                  <div className="bg-gray-50 dark:bg-[#15251c] p-3 rounded-2xl border border-gray-200 dark:border-emerald-900/60 space-y-3">
                    <div>
                      <div className="text-xs font-bold text-gray-800 dark:text-white mb-1.5">النتائج السابقة (نقاطه في كل ماتش)</div>
                      {tl.past.length === 0 ? (
                        <div className="text-[11px] text-gray-500 dark:text-emerald-500">لسه مفيش مباريات خلصت لفريقه</div>
                      ) : (
                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          {tl.past.map((l) => (
                            <div key={l.match.id} className="space-y-1">
                              <span className="text-[10px] text-gray-400 font-bold block">ج{l.match.round}</span>
                              <div className={`${chip(l.result)} text-white text-[11px] font-black rounded-lg py-1 font-mono`} dir="ltr">{l.score}</div>
                              <span className="text-[10px] text-gray-600 dark:text-emerald-300 block truncate">{oppName(l.oppTeamId)}</span>
                              <div className="bg-gray-200 dark:bg-emerald-900 text-gray-800 dark:text-white text-[10px] font-black rounded py-0.5">
                                {l.played ? `${l.pts} ن` : 'لم يلعب'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-800 dark:text-white mb-1.5">المواجهات القادمة</div>
                      {tl.next.length === 0 ? (
                        <div className="text-[11px] text-gray-500 dark:text-emerald-500">مفيش ماتشات جاية متسجلة</div>
                      ) : (
                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          {tl.next.map((l) => (
                            <div key={l.match.id} className="space-y-1">
                              <span className="text-[10px] text-gray-400 font-bold block">ج{l.match.round}</span>
                              <div className="bg-white dark:bg-emerald-950 border border-gray-200 dark:border-emerald-800 text-[11px] font-black rounded-lg py-1 text-gray-900 dark:text-white truncate px-1">
                                {oppName(l.oppTeamId)}
                              </div>
                              <span className="text-[10px] text-gray-500 dark:text-emerald-400 block">
                                {[l.match.date, l.match.time].filter(Boolean).join(' ') || 'الميعاد لسه'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons: Remove & Replace (Exact buttons from Screenshot 2) */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onRemovePlayer(selectedPlayerForSheet.id);
                    setSelectedPlayerForSheet(null);
                  }}
                  className="py-3 px-4 rounded-full border-2 border-gray-900 dark:border-white text-gray-900 dark:text-white font-black text-sm flex items-center justify-center gap-1.5 hover:bg-gray-100 dark:hover:bg-emerald-900/40 transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                  <span>Remove</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const toReplace = selectedPlayerForSheet.id;
                    setSelectedPlayerForSheet(null);
                    onSelectPlayerToReplace(toReplace);
                  }}
                  className="py-3 px-4 rounded-full bg-[#200030] hover:bg-[#32004b] text-white font-black text-sm flex items-center justify-center gap-1.5 shadow-lg transition-transform active:scale-95"
                >
                  <RefreshCw className="w-4 h-4 text-cyan-300" />
                  <span>Replace</span>
                </button>
              </div>

              {/* Full Profile Button */}
              <button
                type="button"
                onClick={() => setSelectedPlayerForSheet(null)}
                className="w-full py-3 px-4 rounded-full bg-gray-100 dark:bg-emerald-900/40 text-gray-800 dark:text-emerald-200 font-bold text-xs hover:bg-gray-200 transition-colors"
              >
                إغلاق التفاصيل
              </button>
            </div>
          </div>
        </div>
      )}

      {profilePlayer && (
        <PlayerProfileSheet
          player={profilePlayer}
          teams={teams}
          matches={matches}
          allRoundStats={allRoundStats}
          entries={entries}
          cfg={cfg}
          onClose={() => setProfilePlayer(null)}
          action={{
            label: 'استبدال اللاعب',
            onClick: () => {
              const id = profilePlayer.id;
              setProfilePlayer(null);
              setSelectedPlayerForSheet(null);
              onSelectPlayerToReplace(id);
            },
          }}
        />
      )}
    </div>
  );
};
