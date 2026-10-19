import React, { useState, useMemo } from 'react';
import { Match, Team, Player, TournamentConfig, Entry } from '../types';
import { PLStandingsView } from './PLStandingsView';
import { JerseyKit } from './JerseyKit';
import {
  Calendar,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Trophy,
  Award,
  Medal,
  Clock,
  Tv,
  CheckCircle,
} from 'lucide-react';
import { calculatePlayerTotalPoints, POSITIONS_SHORT } from '../utils/fantasyScoring';
import { BookingState, bookingTotals } from '../utils/booking';

interface PLScreenSeasonProps {
  matches: Record<string, Match>;
  teams: Record<string, Team>;
  players: Record<string, Player>;
  cfg: TournamentConfig;
  allRoundStats: Record<number, { p: Record<string, any> }>;
  onSelectMatch?: (match: Match) => void;
  entries?: Record<string, Entry>;
  currentUserId?: string;
  booking?: BookingState | null;
}

export const PLScreenSeason: React.FC<PLScreenSeasonProps> = ({
  matches,
  teams,
  players,
  cfg,
  allRoundStats,
  onSelectMatch,
  entries = {},
  currentUserId = '',
  booking = null,
}) => {
  const [seasonSubTab, setSeasonSubTab] = useState<'matches' | 'table' | 'stats' | 'managers' | 'booking'>('matches');
  const [selectedRound, setSelectedRound] = useState<number>(cfg.round);
  const [teamFilter, setTeamFilter] = useState<string>('ALL');

  // Matchweek round list
  const roundList = useMemo(() => {
    const set = new Set<number>();
    Object.values(matches).forEach((m) => set.add(m.round));
    set.add(cfg.round);
    return Array.from(set).sort((a, b) => a - b);
  }, [matches, cfg.round]);

  // Matches for the selected round
  const roundMatches = useMemo(() => {
    return Object.values(matches)
      .filter((m) => m.round === selectedRound)
      .filter((m) => (teamFilter === 'ALL' ? true : m.teamAId === teamFilter || m.teamBId === teamFilter));
  }, [matches, selectedRound, teamFilter]);

  // Calculate Tournament Team Table (الترتيب) based on match results
  const standings = useMemo(() => {
    const statsMap: Record<
      string,
      { team: Team; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; gd: number; pts: number }
    > = {};

    Object.values(teams).forEach((t) => {
      statsMap[t.id] = {
        team: t,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        pts: 0,
      };
    });

    Object.values(matches).forEach((m) => {
      if (m.status === 'finished' && typeof m.scoreA === 'number' && typeof m.scoreB === 'number') {
        const sA = statsMap[m.teamAId];
        const sB = statsMap[m.teamBId];
        if (sA && sB) {
          sA.played++;
          sB.played++;
          sA.gf += m.scoreA;
          sA.ga += m.scoreB;
          sB.gf += m.scoreB;
          sB.ga += m.scoreA;

          if (m.scoreA > m.scoreB) {
            sA.won++;
            sA.pts += 3;
            sB.lost++;
          } else if (m.scoreB > m.scoreA) {
            sB.won++;
            sB.pts += 3;
            sA.lost++;
          } else {
            sA.drawn++;
            sB.drawn++;
            sA.pts += 1;
            sB.pts += 1;
          }
        }
      }
    });

    return Object.values(statsMap)
      .map((s) => ({ ...s, gd: s.gf - s.ga }))
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  }, [teams, matches]);

  // Top players stats (الهدافون وصناع اللعب)
  const topScorers = useMemo(() => {
    return Object.values(players)
      .map((p) => {
        let goals = 0;
        let assists = 0;
        Object.values(allRoundStats).forEach((rd) => {
          if (rd.p && rd.p[p.id]) {
            goals += rd.p[p.id].g || 0;
            assists += rd.p[p.id].a || 0;
          }
        });
        const pts = calculatePlayerTotalPoints(p.id, players, allRoundStats);
        return { ...p, goals, assists, totalPoints: pts };
      })
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
      .slice(0, 10);
  }, [players, allRoundStats]);

  return (
    <div className="space-y-3 pb-4 animate-in fade-in duration-200">
      {/* Top Purple Gradient Header (Season 2026/27 - As seen in Screenshot 3) */}
      <div className="rounded-3xl p-5 text-white bg-gradient-to-r from-[#38003c] via-[#5b0068] to-[#00ff87]/30 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black font-['Lalezar',sans-serif] tracking-tight">
              Season
            </h2>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-xs font-bold cursor-pointer transition-colors mt-1">
              <span>الموسم 2026/27</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
            <Trophy className="w-6 h-6 text-amber-300" />
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs: Matches | Table | Stats (Underline indicator as in Screenshot 3) */}
      <div className="bg-white dark:bg-[#15251c] border-b border-gray-200 dark:border-emerald-900/60 flex items-center justify-around px-2 text-xs sm:text-sm font-bold">
        <button
          type="button"
          onClick={() => setSeasonSubTab('matches')}
          className={`py-3 px-4 relative transition-colors ${
            seasonSubTab === 'matches'
              ? 'text-purple-700 dark:text-purple-300 font-black'
              : 'text-gray-500 dark:text-emerald-400 hover:text-gray-800'
          }`}
        >
          <span>المباريات (Matches)</span>
          {seasonSubTab === 'matches' && (
            <div className="absolute bottom-0 inset-x-2 h-1 bg-purple-700 dark:bg-purple-400 rounded-t-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setSeasonSubTab('table')}
          className={`py-3 px-4 relative transition-colors ${
            seasonSubTab === 'table'
              ? 'text-purple-700 dark:text-purple-300 font-black'
              : 'text-gray-500 dark:text-emerald-400 hover:text-gray-800'
          }`}
        >
          <span>الترتيب (Table)</span>
          {seasonSubTab === 'table' && (
            <div className="absolute bottom-0 inset-x-2 h-1 bg-purple-700 dark:bg-purple-400 rounded-t-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setSeasonSubTab('stats')}
          className={`py-3 px-4 relative transition-colors ${
            seasonSubTab === 'stats'
              ? 'text-purple-700 dark:text-purple-300 font-black'
              : 'text-gray-500 dark:text-emerald-400 hover:text-gray-800'
          }`}
        >
          <span>الإحصائيات (Stats)</span>
          {seasonSubTab === 'stats' && (
            <div className="absolute bottom-0 inset-x-2 h-1 bg-purple-700 dark:bg-purple-400 rounded-t-full" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setSeasonSubTab('managers')}
          className={`py-3 px-4 relative transition-colors ${
            seasonSubTab === 'managers'
              ? 'text-purple-700 dark:text-purple-300 font-black'
              : 'text-gray-500 dark:text-emerald-400 hover:text-gray-800'
          }`}
        >
          <span>المشتركين</span>
          {seasonSubTab === 'managers' && (
            <div className="absolute bottom-0 inset-x-2 h-1 bg-purple-700 dark:bg-purple-400 rounded-t-full" />
          )}
        </button>
        {(booking?.teamIds?.length ?? 0) > 0 && (
          <button
            type="button"
            onClick={() => setSeasonSubTab('booking')}
            className={`py-3 px-4 relative transition-colors ${
              seasonSubTab === 'booking'
                ? 'text-purple-700 dark:text-purple-300 font-black'
                : 'text-gray-500 dark:text-emerald-400 hover:text-gray-800'
            }`}
          >
            <span>الحجز</span>
            {seasonSubTab === 'booking' && (
              <div className="absolute bottom-0 inset-x-2 h-1 bg-purple-700 dark:bg-purple-400 rounded-t-full" />
            )}
          </button>
        )}
      </div>

      {seasonSubTab === 'booking' && booking && (() => {
        const rows = bookingTotals(matches, booking);
        const name = (id: string) => teams[id]?.name || '—';
        const cur = booking.currentMatchId ? matches[booking.currentMatchId] : undefined;
        const last = Object.values(matches)
          .filter((m) => m.booking && m.status === 'finished')
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
          .slice(0, 8);
        return (
          <div className="space-y-3 px-1 pb-4">
            {booking.active ? (
              <div className="rounded-2xl p-4 text-white bg-gradient-to-br from-[#38003c] via-[#4c1d95] to-[#0e7a4a] shadow-xl">
                <div className="text-[11px] text-white/70 font-bold">{cur?.status === 'live' ? '🔴 مباشر دلوقتي' : 'في الملعب دلوقتي'}</div>
                <div className="flex items-center justify-center gap-3 mt-2 text-lg font-black">
                  <span className="truncate">{name(booking.onPitch[0])}</span>
                  <span className="font-mono text-2xl">
                    {cur && cur.status !== 'upcoming' ? `${cur.scoreA ?? 0} - ${cur.scoreB ?? 0}` : 'VS'}
                  </span>
                  <span className="truncate">{name(booking.onPitch[1])}</span>
                </div>
                <div className="mt-3 text-[11px] text-white/80 font-bold">
                  الدور بره: {booking.queue.map((t, i) => `${i + 1}. ${name(t)}`).join('  ·  ') || '—'}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-3 bg-gray-100 dark:bg-emerald-950 text-center text-sm font-bold text-gray-700 dark:text-emerald-200">انتهى الحجز، دي الإجماليات النهائية</div>
            )}

            <div className="bg-white dark:bg-[#0d1812] rounded-2xl border border-gray-200 dark:border-emerald-900 overflow-x-auto">
              <table className="w-full text-xs text-center">
                <thead className="text-gray-500 dark:text-emerald-400">
                  <tr><th className="text-right p-2">الفريق</th><th>لعب</th><th>فاز</th><th>تعادل</th><th>خسر</th><th>له</th><th>عليه</th><th>فرق</th><th>نقاط</th><th>🔥</th></tr>
                </thead>
                <tbody className="text-gray-900 dark:text-white font-bold">
                  {rows.map((r) => (
                    <tr key={r.teamId} className="border-t border-gray-100 dark:border-emerald-900/60">
                      <td className="text-right p-2">{name(r.teamId)}</td>
                      <td>{r.played}</td><td>{r.won}</td><td>{r.drawn}</td><td>{r.lost}</td><td>{r.gf}</td><td>{r.ga}</td><td>{r.gd}</td>
                      <td className="text-purple-700 dark:text-amber-300">{r.pts}</td>
                      <td title="انتصارات متتالية (الحالي / الأفضل)">{r.streak}/{r.bestStreak}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={10} className="p-3 text-gray-500">لسه مفيش مباريات خلصت</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {last.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-black text-gray-700 dark:text-emerald-300">آخر النتائج</div>
                {last.map((m) => (
                  <div key={m.id} className="flex items-center justify-between bg-white dark:bg-[#0d1812] rounded-xl border border-gray-200 dark:border-emerald-900 px-3 py-2 text-xs font-bold text-gray-900 dark:text-white">
                    <span className="truncate flex-1 text-right">{name(m.teamAId)}</span>
                    <span className="font-mono px-3">{m.scoreA ?? 0} - {m.scoreB ?? 0}</span>
                    <span className="truncate flex-1 text-left">{name(m.teamBId)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {seasonSubTab === 'managers' && (
        <PLStandingsView entries={entries} players={players} cfg={cfg} allRoundStats={allRoundStats} currentUserId={currentUserId} />
      )}

      {/* SUBTAB 1: MATCHES (المباريات - Matching Screenshot 3) */}
      {seasonSubTab === 'matches' && (
        <div className="space-y-3">
          {/* Dropdown Filters Row (Premier League ∨ | Matchweek 7 ∨ | All Clubs ∨) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
            <div className="bg-white dark:bg-[#15251c] border border-gray-200 dark:border-emerald-800 px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 shrink-0 text-gray-800 dark:text-white shadow-sm">
              <span>{cfg.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </div>

            <div className="bg-white dark:bg-[#15251c] border border-gray-200 dark:border-emerald-800 px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 shrink-0 text-gray-800 dark:text-white shadow-sm">
              <span>Matchweek {selectedRound}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </div>

            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="bg-white dark:bg-[#15251c] border border-gray-200 dark:border-emerald-800 px-3 py-1.5 rounded-full font-bold text-xs text-gray-800 dark:text-white shadow-sm focus:outline-none"
            >
              <option value="ALL">All Clubs (كل الفرق)</option>
              {Object.values(teams).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Matchweek Arrow Slider (< Matchweek 7 > - Matching Screenshot 3) */}
          <div className="bg-white dark:bg-[#15251c] border border-gray-200 dark:border-emerald-900/60 rounded-2xl p-3 flex items-center justify-between shadow-sm">
            <button
              type="button"
              disabled={selectedRound <= 1}
              onClick={() => setSelectedRound((r) => Math.max(1, r - 1))}
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-emerald-950 flex items-center justify-center text-gray-700 dark:text-emerald-300 disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <div className="text-center">
              <span className="font-black text-sm text-gray-900 dark:text-white block font-['Lalezar',sans-serif]">
                Matchweek {selectedRound} • الجولة {selectedRound}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-emerald-400 font-mono">
                Sat 17 Oct - Mon 19 Oct
              </span>
            </div>

            <button
              type="button"
              disabled={selectedRound >= (roundList[roundList.length - 1] || cfg.round)}
              onClick={() => setSelectedRound((r) => r + 1)}
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-emerald-950 flex items-center justify-center text-gray-700 dark:text-emerald-300 disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          {/* Matches List Section: "Today" */}
          <div className="space-y-2">
            <h3 className="text-base font-black text-gray-900 dark:text-white font-['Lalezar',sans-serif] px-1">
              مباريات الجولة (Today)
            </h3>

            <div className="bg-white dark:bg-[#15251c] border border-gray-200 dark:border-emerald-900/60 rounded-3xl shadow-xl overflow-hidden divide-y divide-gray-100 dark:divide-emerald-900/40">
              {roundMatches.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="font-bold text-sm">لا توجد مباريات مجدولة لهذه الجولة</p>
                </div>
              ) : (
                roundMatches.map((match) => {
                  const teamA = teams[match.teamAId];
                  const teamB = teams[match.teamBId];
                  const isFinished = match.status === 'finished';
                  const isLive = match.status === 'live';

                  return (
                    <div
                      key={match.id}
                      onClick={() => onSelectMatch && onSelectMatch(match)}
                      className="p-4 sm:p-5 hover:bg-gray-50/80 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer space-y-1.5"
                    >
                      <div className="grid grid-cols-12 items-center gap-2">
                        {/* Team A */}
                        <div className="col-span-4 flex items-center justify-end gap-2 text-right">
                          <span className="font-extrabold text-xs sm:text-sm text-gray-900 dark:text-white truncate">
                            {teamA?.name || 'فريق أ'}
                          </span>
                          <div className="shrink-0">
                            <JerseyKit
                              c1={teamA?.c1}
                              c2={teamA?.c2}
                              pat={teamA?.pat}
                              num={10}
                              kitUrl={teamA?.kitUrl}
                              size="sm"
                            />
                          </div>
                        </div>

                        {/* Middle Box */}
                        <div className="col-span-4 flex flex-col items-center justify-center text-center">
                          {isFinished || isLive ? (
                            <div className="flex items-center gap-2">
                              <span className="text-lg sm:text-xl font-black text-gray-900 dark:text-white font-mono">
                                {match.scoreA ?? 0}
                              </span>
                              <span className="text-gray-400 font-bold">-</span>
                              <span className="text-lg sm:text-xl font-black text-gray-900 dark:text-white font-mono">
                                {match.scoreB ?? 0}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white font-mono">
                              {match.time || '17:00'}
                            </span>
                          )}

                          <span className="text-[10px] text-gray-500 dark:text-emerald-400/80 font-mono">
                            {isLive ? '🔴 مباشر الآن' : match.date || 'السبت 17 أكتوبر'}
                          </span>
                        </div>

                        {/* Team B */}
                        <div className="col-span-4 flex items-center justify-start gap-2 text-left">
                          <div className="shrink-0">
                            <JerseyKit
                              c1={teamB?.c1}
                              c2={teamB?.c2}
                              pat={teamB?.pat}
                              num={7}
                              kitUrl={teamB?.kitUrl}
                              size="sm"
                            />
                          </div>
                          <span className="font-extrabold text-xs sm:text-sm text-gray-900 dark:text-white truncate text-right">
                            {teamB?.name || 'فريق ب'}
                          </span>
                        </div>
                      </div>

                      {/* Pitch / Broadcaster */}
                      <div className="text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-emerald-400/70 font-medium">
                          <Tv className="w-3 h-3 opacity-60" />
                          <span>{match.pitch || 'Multiple broadcasters (بث مباشر وملاعب الدورة)'}</span>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: TABLE (جدول ترتيب الفرق) */}
      {seasonSubTab === 'table' && (
        <div className="bg-white dark:bg-[#15251c] border border-gray-200 dark:border-emerald-900/60 rounded-3xl shadow-xl overflow-hidden">
          <div className="p-3 bg-gray-50 dark:bg-[#101e16] border-b border-gray-100 dark:border-emerald-900/40 text-xs font-black text-gray-800 dark:text-white flex items-center justify-between">
            <span>جدول ترتيب أندية الدورة</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-normal">الموسم 2026/27</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="border-b border-gray-200 dark:border-emerald-900/60 text-gray-500 dark:text-emerald-400 text-[11px]">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">الفريق</th>
                  <th className="py-2.5 px-2 text-center">لعب</th>
                  <th className="py-2.5 px-2 text-center">فوز</th>
                  <th className="py-2.5 px-2 text-center">تعادل</th>
                  <th className="py-2.5 px-2 text-center">خسارة</th>
                  <th className="py-2.5 px-2 text-center font-mono">+/-</th>
                  <th className="py-2.5 px-3 text-center font-black">النقاط</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-emerald-900/30">
                {standings.map((row, idx) => (
                  <tr
                    key={row.team.id}
                    className="hover:bg-gray-50 dark:hover:bg-emerald-950/30 transition-colors font-medium text-gray-900 dark:text-white"
                  >
                    <td className="py-2.5 px-3 font-bold font-mono text-gray-500">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center">
                        <JerseyKit
                          c1={row.team.c1}
                          c2={row.team.c2}
                          pat={row.team.pat}
                          num={idx + 1}
                          size="sm"
                        />
                      </div>
                      <span className="font-extrabold truncate max-w-[120px]">
                        {row.team.name}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono">{row.played}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-emerald-600 dark:text-emerald-400">
                      {row.won}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono text-gray-500">{row.drawn}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-red-500">{row.lost}</td>
                    <td className="py-2.5 px-2 text-center font-mono font-bold">
                      {row.gd > 0 ? `+${row.gd}` : row.gd}
                    </td>
                    <td className="py-2.5 px-3 text-center font-black text-amber-500 text-sm font-mono">
                      {row.pts}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: STATS (إحصائيات هدافي الدورة) */}
      {seasonSubTab === 'stats' && (
        <div className="bg-white dark:bg-[#15251c] border border-gray-200 dark:border-emerald-900/60 rounded-3xl shadow-xl overflow-hidden">
          <div className="p-3.5 bg-gray-50 dark:bg-[#101e16] border-b border-gray-100 dark:border-emerald-900/40 text-xs font-black text-gray-800 dark:text-white flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" />
              هدافو ونجوم البطولة
            </span>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-emerald-900/30">
            {topScorers.map((p, idx) => {
              const team = teams[p.teamId];
              return (
                <div
                  key={p.id}
                  className="p-3 sm:p-4 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-black text-sm text-gray-400 font-mono w-5 text-center">
                      {idx + 1}
                    </span>
                    <JerseyKit
                      c1={team?.c1}
                      c2={team?.c2}
                      pat={team?.pat}
                      num={p.num}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <span className="font-extrabold text-sm text-gray-900 dark:text-white truncate block">
                        {p.name}
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-emerald-400">
                        {team?.name} • {POSITIONS_SHORT[p.pos]}
                      </span>
                    </div>
                  </div>

                  <div className="text-left font-mono">
                    <span className="text-base font-black text-amber-500">
                      ⚽ {p.goals}
                    </span>
                    <span className="text-[10px] text-gray-400 block">
                      صناعة {p.assists} • {p.totalPoints} ن
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
