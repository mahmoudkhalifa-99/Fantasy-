import React from 'react';
import { Entry, Match, Player, PlayerMatchStats, Team, TournamentConfig } from '../types';
import { JerseyKit } from './JerseyKit';
import { POSITIONS_SHORT } from '../utils/fantasyScoring';
import { buildPlayerProfile } from '../utils/playerProfile';
import { swipeRightHandlers } from '../utils/swipe';
import { X } from 'lucide-react';

interface Props {
  player: Player;
  teams: Record<string, Team>;
  matches: Record<string, Match>;
  allRoundStats: Record<number, { p: Record<string, PlayerMatchStats> }>;
  entries?: Record<string, Entry>;
  cfg?: TournamentConfig;
  onClose: () => void;
  action?: { label: string; disabled?: boolean; note?: string; onClick: () => void };
}

const Stat: React.FC<{ label: string; value: React.ReactNode; hi?: boolean }> = ({ label, value, hi }) => (
  <div className={`rounded-xl p-2.5 text-center border ${hi ? 'bg-amber-400/10 border-amber-400/40' : 'bg-[#0a140e] border-emerald-800/50'}`}>
    <div className={`text-xl font-black font-mono ${hi ? 'text-amber-300' : 'text-white'}`}>{value}</div>
    <div className="text-[10px] text-emerald-400 font-bold mt-0.5">{label}</div>
  </div>
);

export const PlayerProfileSheet: React.FC<Props> = ({ player, teams, matches, allRoundStats, entries, cfg, onClose, action }) => {
  const team = teams[player.teamId];
  const pr = buildPlayerProfile(player, matches, allRoundStats, entries, cfg);
  const isGK = player.pos === 'GK';
  const nextM = pr.next[0];
  const oppOf = (m: Match) => teams[m.teamAId === player.teamId ? m.teamBId : m.teamAId];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-md max-h-[92vh] flex flex-col bg-[#122218] border border-emerald-600/40 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8"
        onClick={(e) => e.stopPropagation()}
        {...swipeRightHandlers(onClose, 90)}
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-l from-emerald-800 to-[#0d1812] flex items-center gap-3 relative">
          <button type="button" onClick={onClose} className="absolute top-3 left-3 p-1.5 rounded-lg text-emerald-200 hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
          <JerseyKit c1={team?.c1} c2={team?.c2} pat={team?.pat} num={player.num} kitUrl={team?.kitUrl} size="lg" />
          <div className="min-w-0">
            <div className="text-[11px] text-emerald-300 font-bold">
              {POSITIONS_SHORT[player.pos]} · {team?.name}
            </div>
            <h3 className="text-xl font-black text-white font-['Lalezar',sans-serif] truncate">{player.name}</h3>
            <div className="text-sm text-amber-300 font-black font-mono">{player.price} م</div>
          </div>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {/* Next fixture */}
          <div className="rounded-2xl border border-emerald-700/50 bg-[#0a140e] p-3">
            <div className="text-[11px] font-black text-emerald-300 mb-1.5">⏭ الماتش الجاي</div>
            {nextM ? (
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-white">
                    ضد {oppOf(nextM)?.name || 'فريق'}{' '}
                    <span className="text-[11px] text-emerald-400 font-bold">({nextM.teamAId === player.teamId ? 'الأول' : 'التاني'})</span>
                  </span>
                  <span className="text-xs font-bold text-amber-300">ج{nextM.round}</span>
                </div>
                <div className="text-[11px] text-emerald-400 mt-0.5">
                  {[nextM.date, nextM.time, nextM.pitch].filter(Boolean).join(' • ')}
                  {nextM.status === 'live' && <span className="text-red-500 font-black mr-2 animate-pulse"> ● بتتلعب دلوقتي</span>}
                </div>
                {pr.next.length > 1 && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {pr.next.slice(1, 4).map((m) => (
                      <span key={m.id} className="text-[10px] px-2 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800/50">
                        ج{m.round} · {oppOf(m)?.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-emerald-500">مفيش ماتش جاي متسجل لفريقه</div>
            )}
          </div>

          {/* Main stats */}
          <div className="grid grid-cols-3 gap-2">
            <Stat label="إجمالي النقاط" value={pr.total} hi />
            <Stat label="نقاط/ماتش" value={pr.avg.toFixed(1)} />
            <Stat label="الفورمة (آخر 3)" value={pr.form.toFixed(1)} />
            <Stat label="لعب" value={pr.played} />
            <Stat label="أهداف ⚽" value={pr.goals} />
            <Stat label="صناعات 👟" value={pr.assists} />
            <Stat label="كلين شيت" value={pr.cleanSheets} />
            <Stat label="رجل الماتش" value={pr.motm} />
            <Stat label="مختار بنسبة" value={pr.selectedPct === null ? '—' : `${pr.selectedPct}%`} />
          </div>

          {(pr.yellow > 0 || pr.red > 0 || pr.ownGoals > 0 || pr.penMissed > 0 || (isGK && pr.penSaved > 0)) && (
            <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
              {pr.yellow > 0 && <span className="px-2 py-1 rounded-lg bg-yellow-500/20 text-yellow-300">🟨 {pr.yellow}</span>}
              {pr.red > 0 && <span className="px-2 py-1 rounded-lg bg-red-600/20 text-red-300">🟥 {pr.red}</span>}
              {pr.ownGoals > 0 && <span className="px-2 py-1 rounded-lg bg-orange-600/20 text-orange-300">🥅 عكسي {pr.ownGoals}</span>}
              {pr.penMissed > 0 && <span className="px-2 py-1 rounded-lg bg-rose-700/20 text-rose-300">❌ جزاء ضايع {pr.penMissed}</span>}
              {isGK && pr.penSaved > 0 && <span className="px-2 py-1 rounded-lg bg-teal-600/20 text-teal-300">🧤 تصدى جزاء {pr.penSaved}</span>}
            </div>
          )}

          {/* Round by round */}
          <div>
            <div className="text-[11px] font-black text-emerald-300 mb-1.5">📅 الجولات</div>
            {pr.lines.length === 0 ? (
              <div className="text-xs text-emerald-500 text-center py-3">لسه ما لعبش أي جولة</div>
            ) : (
              <div className="rounded-xl border border-emerald-800/50 overflow-hidden text-xs">
                <div className="grid grid-cols-[34px_1fr_44px_28px_28px_38px] gap-1 px-2 py-1.5 bg-emerald-950 text-[10px] text-emerald-400 font-bold">
                  <span>ج</span><span>الخصم</span><span>النتيجة</span><span>⚽</span><span>👟</span><span className="text-center">نقاط</span>
                </div>
                {[...pr.lines].reverse().map((l) => (
                  <div key={l.round} className="grid grid-cols-[34px_1fr_44px_28px_28px_38px] gap-1 px-2 py-2 items-center border-t border-emerald-900/50 text-white">
                    <span className="font-mono text-emerald-400">{l.round}</span>
                    <span className="truncate">{l.oppTeamId ? teams[l.oppTeamId]?.name : '—'}</span>
                    <span className="font-mono text-emerald-300" dir="ltr">{l.score || '—'}</span>
                    <span className="font-mono">{l.played ? l.stats.g || 0 : '-'}</span>
                    <span className="font-mono">{l.played ? l.stats.a || 0 : '-'}</span>
                    <span className={`text-center font-black font-mono rounded-md ${l.played ? 'bg-amber-400/15 text-amber-300' : 'text-emerald-700'}`}>
                      {l.played ? l.pts : 'لم يلعب'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {action && (
          <div className="p-3 border-t border-emerald-800/60 bg-[#0d1812]">
            {action.note && <div className="text-[11px] text-red-400 font-medium mb-1.5 text-center">{action.note}</div>}
            <button
              type="button"
              disabled={action.disabled}
              onClick={action.onClick}
              className={`w-full py-3 rounded-xl font-black text-sm ${
                action.disabled ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
              }`}
            >
              {action.label}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
