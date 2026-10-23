import React, { useEffect, useState } from 'react';
import { Player, Team, TournamentConfig, Position, KitPattern, PlayerMatchStats, Match, Entry, TopStoryAd, SquadSelection } from '../types';
import { JerseyKit } from './JerseyKit';
import { LiveMatchConsole } from './LiveMatchConsole';
import { matchStartMs, formatDeadline } from '../utils/deadline';
import { BookingState, BOOKING_MAX_TEAMS, BOOKING_MIN_TEAMS, bookingTotals } from '../utils/booking';
import type { LiveState } from '../utils/liveMatch';
import { POSITIONS_SHORT, POS_ORDER, calculatePlayerRoundPoints } from '../utils/fantasyScoring';
import {
  Settings,
  Users,
  Shirt,
  ClipboardList,
  Calendar,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Pencil,
  Save,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

interface AdminPanelProps {
  topStories?: Record<string, TopStoryAd>;
  onSaveTopStories?: (next: Record<string, TopStoryAd>) => Promise<boolean>;
  booking?: BookingState | null;
  onStartBooking?: (teamIds: string[], first: string, second: string, startAt?: number) => Promise<boolean>;
  onEndBooking?: () => Promise<void> | void;
  onResumeBooking?: () => Promise<boolean> | boolean;
  onResetBooking?: () => Promise<boolean> | boolean;
  entries?: Record<string, Entry>;
  cfg: TournamentConfig;
  teams: Record<string, Team>;
  players: Record<string, Player>;
  matches: Record<string, Match>;
  allRoundStats: Record<number, { p: Record<string, PlayerMatchStats> }>;
  bookingStats?: { p: Record<string, PlayerMatchStats> };
  onUpdateConfig: (newCfg: TournamentConfig) => void;
  onAddTeam: (team: Omit<Team, 'id'>) => void;
  onUpdateTeam: (id: string, updates: Partial<Team>) => void;
  onDeleteTeam: (id: string) => void;
  onAddPlayer: (player: Omit<Player, 'id'>) => void;
  onBulkAddPlayers: (teamId: string, lines: string) => void;
  onDeletePlayer: (id: string) => void;
  onUpdatePlayer?: (id: string, updates: Partial<Player>) => void;
  onUpdatePlayerStats: (round: number, playerId: string, stats: PlayerMatchStats) => void;
  onAddMatch: (match: Omit<Match, 'id'>) => void;
  onUpdateMatch: (id: string, updates: Partial<Match>) => void;
  onDeleteMatch: (id: string) => void;
  onResetDemoData: () => void;
  onLiveUpdate: (matchId: string, fn: (s: LiveState) => LiveState) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  topStories = {},
  onSaveTopStories,
  booking = null,
  onStartBooking,
  onEndBooking,
  onResumeBooking,
  onResetBooking,
  entries = {},
  cfg,
  teams,
  players,
  matches,
  allRoundStats,
  bookingStats,
  onUpdateConfig,
  onAddTeam,
  onUpdateTeam,
  onDeleteTeam,
  onAddPlayer,
  onBulkAddPlayers,
  onDeletePlayer,
  onUpdatePlayer,
  onUpdatePlayerStats,
  onAddMatch,
  onUpdateMatch,
  onDeleteMatch,
  onResetDemoData,
  onLiveUpdate,
}) => {
  const [activeSection, setActiveSection] = useState<'live' | 'matches' | 'stats' | 'teams' | 'players' | 'users' | 'booking' | 'ads' | 'settings'>('live');

  // عرض تشكيلات المستخدمين (للمنظم بس)
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [userRoundSel, setUserRoundSel] = useState<Record<string, string>>({});

  // Config form state
  const [cfgName, setCfgName] = useState(cfg.name);
  const [cfgBudget, setCfgBudget] = useState(cfg.budget);
  const [cfgMaxPerTeam, setCfgMaxPerTeam] = useState(cfg.maxPerTeam);
  const [cfgFreeTransfers, setCfgFreeTransfers] = useState<number>(cfg.freeTransfers ?? 1);
  const [cfgTransferPenalty, setCfgTransferPenalty] = useState<number>(cfg.transferPenalty ?? 4);

  // New Team form state
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamC1, setNewTeamC1] = useState('#dc2626');
  const [newTeamC2, setNewTeamC2] = useState('#ffffff');
  const [newTeamPat, setNewTeamPat] = useState<KitPattern>('stripes');

  // New Player form state
  const teamKeys = Object.keys(teams);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerTeamId, setNewPlayerTeamId] = useState(teamKeys[0] || '');
  const [newPlayerPos, setNewPlayerPos] = useState<Position>('FWD');
  const [newPlayerPrice, setNewPlayerPrice] = useState('7.0');
  const [newPlayerNum, setNewPlayerNum] = useState('');

  // Bulk add state
  const [bulkTeamId, setBulkTeamId] = useState(teamKeys[0] || '');
  const [bulkText, setBulkText] = useState('');

  // Match stats recording state
  const [statsRound, setStatsRound] = useState<number>(cfg.round);
  const [statsTeamId, setStatsTeamId] = useState<string>(teamKeys[0] || '');
  const [expandedPlayerStatId, setExpandedPlayerStatId] = useState<string | null>(null);

  // Match scheduling form state
  const [matchRound, setMatchRound] = useState<number>(cfg.round);
  const [matchTeamA, setMatchTeamA] = useState<string>(teamKeys[0] || '');
  const [matchTeamB, setMatchTeamB] = useState<string>(teamKeys[1] || teamKeys[0] || '');
  const [matchDate, setMatchDate] = useState<string>('2026-10-18');
  const [matchTime, setMatchTime] = useState<string>('20:30');
  const [matchPitch, setMatchPitch] = useState<string>('الملعب الرئيسي (خماسي)');
  const [matchStatus, setMatchStatus] = useState<'upcoming' | 'live' | 'finished'>('upcoming');
  const [matchScoreA, setMatchScoreA] = useState<string>('');
  const [matchScoreB, setMatchScoreB] = useState<string>('');
  const [matchScorersAText, setMatchScorersAText] = useState<string>('');
  const [matchScorersBText, setMatchScorersBText] = useState<string>('');
  const [matchMotm, setMatchMotm] = useState<string>('');
  const [matchNotes, setMatchNotes] = useState<string>('');

  // الفرق بتتحمّل بعد ما اللوحة تفتح (أو بتتضاف بعدين)، فلازم القوائم تتظبط لأول فريق موجود بدل ما تفضل فاضية
  useEffect(() => {
    const ok = (id: string) => !!id && !!teams[id];
    const keys = Object.keys(teams);
    if (!ok(newPlayerTeamId)) setNewPlayerTeamId(keys[0] || '');
    if (!ok(bulkTeamId)) setBulkTeamId(keys[0] || '');
    if (!ok(statsTeamId)) setStatsTeamId(keys[0] || '');
    if (!ok(matchTeamA)) setMatchTeamA(keys[0] || '');
    if (!ok(matchTeamB)) setMatchTeamB(keys[1] || keys[0] || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams]);

  // ---- الإعلانات (الدواير اللي فوق في شاشة المباريات) ----
  const AD_GRADIENTS = [
    'from-amber-400 to-orange-600',
    'from-emerald-500 to-cyan-400',
    'from-indigo-500 to-purple-600',
    'from-rose-500 to-red-600',
    'from-sky-500 to-blue-700',
    'from-fuchsia-500 to-pink-500',
  ];
  const emptyAd = {
    id: '',
    title: '',
    subtitle: '',
    tag: 'إعلان',
    iconText: '📢',
    colorGradient: AD_GRADIENTS[0],
    actionType: 'modal' as TopStoryAd['actionType'],
    detailsText: '',
    phone: '',
    whatsapp: '',
    linkUrl: '',
    active: true,
  };
  const [adForm, setAdForm] = useState<TopStoryAd>(emptyAd);
  const [adBusy, setAdBusy] = useState(false);
  const [adsWa, setAdsWa] = useState(cfg.adsWhatsapp || '');
  const [adsPh, setAdsPh] = useState(cfg.adsPhone || '');
  useEffect(() => {
    setAdsWa(cfg.adsWhatsapp || '');
    setAdsPh(cfg.adsPhone || '');
  }, [cfg.adsWhatsapp, cfg.adsPhone]);
  const digits = (v: string) => v.replace(/[^\d]/g, '');
  const intl = (v: string) => {
    const d = digits(v);
    return d.startsWith('0') ? `2${d}` : d; // 010... → 2010...
  };
  const saveAds = async (next: Record<string, TopStoryAd>) => {
    setAdBusy(true);
    const ok = await onSaveTopStories?.(next);
    setAdBusy(false);
    return !!ok;
  };
  const submitAd = async () => {
    const title = adForm.title.trim();
    if (!title) return window.alert('اكتب عنوان الإعلان');
    const whatsapp = intl(adForm.whatsapp || '');
    const phone = digits(adForm.phone || '');
    const linkUrl = (adForm.linkUrl || '').trim();
    if (adForm.actionType === 'link' && !linkUrl && !whatsapp) return window.alert('اكتب الرابط أو رقم واتساب');
    if (linkUrl && !/^https?:\/\//i.test(linkUrl)) return window.alert('الرابط لازم يبدأ بـ https://');
    const id = adForm.id || `s_${Date.now()}`;
    const item: TopStoryAd = { ...adForm, id, title, whatsapp, phone, linkUrl };
    if (await saveAds({ ...topStories, [id]: item })) setAdForm(emptyAd);
  };

  // تعديل لاعب
  const [editPlayerId, setEditPlayerId] = useState<string | null>(null);
  const [epName, setEpName] = useState('');
  const [epTeam, setEpTeam] = useState('');
  const [epPos, setEpPos] = useState<Position>('FWD');
  const [epPrice, setEpPrice] = useState('');
  const [epNum, setEpNum] = useState('');
  const [playersFilterTeam, setPlayersFilterTeam] = useState<string>('all');
  const [playersQuery, setPlayersQuery] = useState('');
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamC1, setEditTeamC1] = useState('#dc2626');
  const [editTeamC2, setEditTeamC2] = useState('#0000ff');
  const [bkTeams, setBkTeams] = useState<string[]>([]);
  const [bkFirst, setBkFirst] = useState('');
  const [bkSecond, setBkSecond] = useState('');
  const [bkBusy, setBkBusy] = useState(false);
  const [bkDate, setBkDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }));
  const [bkTime, setBkTime] = useState('20:00');
  const bkStartAt = matchStartMs(bkDate, bkTime);
  const bkChosen = bkTeams.filter((t) => teams[t]);
  const bkRows = bookingTotals(matches, booking);
  const tName = (id: string) => teams[id]?.name || '—';

  const currentRoundStatsDoc = allRoundStats[statsRound]?.p || {};

  const handleSaveConfig = () => {
    onUpdateConfig({
      ...cfg,
      name: cfgName.trim() || cfg.name,
      budget: Number(cfgBudget) || 50,
      maxPerTeam: Number(cfgMaxPerTeam) || 2,
      freeTransfers: Math.max(0, Number(cfgFreeTransfers) || 0),
      transferPenalty: Math.max(0, Number(cfgTransferPenalty) || 0),
    });
  };

  const handleAddTeamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    onAddTeam({
      name: newTeamName.trim(),
      c1: newTeamC1,
      c2: newTeamC2,
      pat: newTeamPat,
    });
    setNewTeamName('');
  };

  const handleAddPlayerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim() || !newPlayerTeamId) return;
    onAddPlayer({
      name: newPlayerName.trim(),
      teamId: newPlayerTeamId,
      pos: newPlayerPos,
      price: Math.max(1, parseFloat(newPlayerPrice) || 5.0),
      num: newPlayerNum ? parseInt(newPlayerNum, 10) : undefined,
    });
    setNewPlayerName('');
    setNewPlayerNum('');
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim() || !bulkTeamId) return;
    onBulkAddPlayers(bulkTeamId, bulkText);
    setBulkText('');
  };

  const handleAddMatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchTeamA || !matchTeamB || matchTeamA === matchTeamB) {
      alert('يرجى اختيار فريقين مختلفين للمباراة');
      return;
    }

    const scA = matchScoreA !== '' ? parseInt(matchScoreA, 10) : null;
    const scB = matchScoreB !== '' ? parseInt(matchScoreB, 10) : null;

    onAddMatch({
      round: matchRound,
      teamAId: matchTeamA,
      teamBId: matchTeamB,
      scoreA: scA,
      scoreB: scB,
      date: matchDate,
      time: matchTime,
      pitch: matchPitch,
      status: matchStatus,
      scorersA: matchScorersAText ? matchScorersAText.split(',').map((s) => s.trim()) : [],
      scorersB: matchScorersBText ? matchScorersBText.split(',').map((s) => s.trim()) : [],
      motm: matchMotm.trim() || undefined,
      notes: matchNotes.trim() || undefined,
    });

    setMatchScoreA('');
    setMatchScoreB('');
    setMatchScorersAText('');
    setMatchScorersBText('');
    setMatchMotm('');
    setMatchNotes('');
  };

  // Helper to adjust player match stats
  const modifyStat = (
    playerId: string,
    field: keyof PlayerMatchStats,
    delta: number,
    isToggle: boolean = false
  ) => {
    const current = { ...(currentRoundStatsDoc[playerId] || { pl: 1 }) };
    if (isToggle) {
      (current as any)[field] = current[field] ? 0 : 1;
    } else {
      const val = (Number(current[field]) || 0) + delta;
      (current as any)[field] = Math.max(0, val);
    }
    if (field !== 'pl' && current[field]) {
      current.pl = 1;
    }
    onUpdatePlayerStats(statsRound, playerId, current);
  };

  return (
    <div className="space-y-4">
      {/* Admin Top Navigation */}
      <div className="bg-[#122218] border border-emerald-600/40 rounded-2xl p-4 shadow-xl flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-amber-950 flex items-center justify-center font-bold">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white font-['Lalezar',sans-serif]">
              لوحة منظم الدورة الشعبية
            </h2>
            <p className="text-xs text-emerald-300">
              إدارة جدول المباريات، تسجيل نتائج وأهداف اللقاءات، والفرق واللاعبين
            </p>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1.5 bg-[#0a140f] p-1 rounded-xl border border-emerald-800/60 text-xs flex-wrap">
          <button
            type="button"
            onClick={() => setActiveSection('live')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
              activeSection === 'live'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-emerald-300 hover:text-white'
            }`}
          >
            🔴 مباراة مباشرة
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('matches')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
              activeSection === 'matches'
                ? 'bg-amber-400 text-amber-950 shadow-sm'
                : 'text-emerald-300 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            جدول المباريات ({Object.keys(matches).length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('stats')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
              activeSection === 'stats'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-300 hover:text-white'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            أهداف وإحصائيات اللاعبين
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('teams')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
              activeSection === 'teams'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-300 hover:text-white'
            }`}
          >
            <Shirt className="w-3.5 h-3.5" />
            الفرق ({Object.keys(teams).length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('players')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
              activeSection === 'players'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-300 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            اللاعبون ({Object.keys(players).length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('users')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
              activeSection === 'users'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-300 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            المستخدمون ({Object.keys(entries).length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('booking')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeSection === 'booking'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-300 hover:text-white'
            }`}
          >
            🔁 الحجز
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('ads')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeSection === 'ads'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-300 hover:text-white'
            }`}
          >
            📢 الإعلانات
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('settings')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
              activeSection === 'settings'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-300 hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            الإعدادات
          </button>
        </div>
      </div>

      {/* SECTION: BOOKING (الفايز باقي) */}
      {activeSection === 'booking' && (
        <div className="bg-[#122218] border border-emerald-700/40 rounded-2xl p-4 shadow-xl space-y-4">
          <div>
            <h3 className="font-black text-white text-base font-['Lalezar',sans-serif]">وضع الحجز (الفايز باقي)</h3>
            <p className="text-[11px] text-emerald-400 mt-1">
              من {BOOKING_MIN_TEAMS} لـ {BOOKING_MAX_TEAMS} فرق. الفايز بيفضل في الملعب، والمهزوم بيطلع وبيدخل الفريق اللي مستني بره. المباراة الجاية بتتعمل تلقائيًا لما تنهي المباراة من «المباراة المباشرة».
            </p>
          </div>

          {cfg.mode === 'booking' && (
            <label className="flex items-center justify-between gap-3 bg-[#0a140f] border border-emerald-800/60 rounded-xl p-3 cursor-pointer">
              <span>
                <span className="block text-sm font-black text-white">إظهار تبويب الحجز للمشتركين</span>
                <span className="block text-[11px] text-emerald-400 mt-0.5">
                  {cfg.showBooking !== false ? 'ظاهر: وأول ما المشترك يدخل اللعبة بيفتح على الحجز علطول.' : 'مخفي: المشتركين شايفين الدورة بس.'}
                </span>
              </span>
              <input
                type="checkbox"
                className="w-5 h-5 accent-emerald-500 shrink-0"
                checked={cfg.showBooking !== false}
                onChange={(e) => onUpdateConfig({ ...cfg, showBooking: e.target.checked })}
              />
            </label>
          )}

          {booking?.active ? (
            <div className="space-y-3">
              <div className="bg-[#0a140f] border border-emerald-800/60 rounded-xl p-3 text-sm space-y-1">
                <div className="text-emerald-400 text-[11px] font-bold">في الملعب دلوقتي</div>
                <div className="font-black text-white">
                  {tName(booking.onPitch[0])} <span className="text-emerald-500">×</span> {tName(booking.onPitch[1])}
                </div>
                <div className="text-emerald-400 text-[11px] font-bold pt-1">الدور (في الانتظار)</div>
                <div className="text-white font-bold">{booking.queue.map((t, i) => `${i + 1}. ${tName(t)}`).join('  ·  ') || '—'}</div>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('live')}
                className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-black text-sm"
              >
                افتح المباراة المباشرة
              </button>
              <button
                type="button"
                disabled={bkBusy}
                onClick={async () => {
                  if (!window.confirm('إنهاء الحجز؟ هيتقفل بس، ومفيش حاجة هتتمسح: النقاط والترتيب والتشكيلات فاضلين. لما تجهز للحجز الجاي دوس «تصفير الحجز».')) return;
                  setBkBusy(true);
                  await onEndBooking?.();
                  setBkBusy(false);
                }}
                className="w-full py-2.5 rounded-xl bg-red-600/80 text-white font-bold text-sm disabled:opacity-50"
              >
                إنهاء وضع الحجز
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {booking?.teamIds && !booking.active && (() => {
                const rows = bookingTotals(matches, booking);
                const nm = (id: string) => teams[id]?.name || '—';
                return (
                  <div className="bg-[#0a140f] border border-amber-500/40 rounded-xl p-3 space-y-2">
                    <div className="text-amber-300 font-black text-xs">آخر حجز (اتقفل) • مفيش حاجة اتمسحت: النقاط والترتيب والتشكيلات فاضلين لحد ما تدوس «تصفير الحجز»</div>
                    <div className="space-y-1">
                      {rows.map((r, i) => (
                        <div key={r.teamId} className="flex items-center justify-between text-xs text-white">
                          <span className="font-bold">{i + 1}. {nm(r.teamId)}</span>
                          <span className="text-emerald-300 font-mono">{r.pts} نقطة · لعب {r.played} · فوز {r.won}</span>
                        </div>
                      ))}
                      {rows.length === 0 && <div className="text-xs text-emerald-400">مفيش مباريات منتهية في الحجز ده.</div>}
                    </div>
                    <button
                      type="button"
                      disabled={bkBusy}
                      onClick={async () => {
                        if (!window.confirm('تشغيل الحجز ده تاني من حيث وقف؟')) return;
                        setBkBusy(true);
                        await onResumeBooking?.();
                        setBkBusy(false);
                      }}
                      className="w-full py-2.5 rounded-xl bg-amber-400 text-amber-950 font-black text-sm disabled:opacity-50"
                    >
                      إعادة تشغيل الحجز
                    </button>
                    <button
                      type="button"
                      disabled={bkBusy}
                      onClick={async () => {
                        if (!window.confirm('تصفير الحجز؟ هيتمسح كل حاجة في الحجز: المباريات والنقاط والترتيب وكل تشكيلات المشتركين (حتى اللي جهّزوها للحجز الجاي). مينفعش ترجع تاني. تشكيلات الدورة مش هتتأثر.')) return;
                        setBkBusy(true);
                        await onResetBooking?.();
                        setBkBusy(false);
                      }}
                      className="w-full py-2.5 rounded-xl bg-red-600/90 text-white font-black text-sm disabled:opacity-50"
                    >
                      🗑 تصفير الحجز (مسح النقاط والتشكيلات)
                    </button>
                    <p className="text-[11px] text-emerald-400">لو بدأت حجز جديد من غير تصفير، نتايج ونقاط الحجز القديم بتتصفّر لكن تشكيلات المشتركين بتفضل.</p>
                  </div>
                );
              })()}
              <div className="text-xs font-black text-emerald-300">اختار الفرق ({bkChosen.length}/{BOOKING_MAX_TEAMS})</div>
              <div className="flex flex-wrap gap-2">
                {Object.values(teams).map((t) => {
                  const on = bkTeams.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setBkTeams((cur) => (cur.includes(t.id) ? cur.filter((x) => x !== t.id) : cur.length >= BOOKING_MAX_TEAMS ? cur : [...cur, t.id]));
                        if (on) {
                          if (bkFirst === t.id) setBkFirst('');
                          if (bkSecond === t.id) setBkSecond('');
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${on ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-[#0a140f] text-emerald-300 border-emerald-800/60'}`}
                    >
                      {t.name}
                    </button>
                  );
                })}
                {Object.keys(teams).length === 0 && <span className="text-xs text-emerald-500">ضيف الفرق الأول من تبويب الفرق.</span>}
              </div>
              {bkChosen.length >= BOOKING_MIN_TEAMS && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-emerald-400 font-bold">
                    يبدأ (1)
                    <select value={bkFirst} onChange={(e) => setBkFirst(e.target.value)} className="mt-1 w-full bg-[#0a140f] border border-emerald-800/60 rounded-lg p-2 text-sm text-white">
                      <option value="">— اختار —</option>
                      {bkChosen.map((t) => (
                        <option key={t} value={t} disabled={t === bkSecond}>{tName(t)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[11px] text-emerald-400 font-bold">
                    يبدأ (2)
                    <select value={bkSecond} onChange={(e) => setBkSecond(e.target.value)} className="mt-1 w-full bg-[#0a140f] border border-emerald-800/60 rounded-lg p-2 text-sm text-white">
                      <option value="">— اختار —</option>
                      {bkChosen.map((t) => (
                        <option key={t} value={t} disabled={t === bkFirst}>{tName(t)}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-emerald-300 font-bold">
                  تاريخ أول ماتش
                  <input type="date" value={bkDate} onChange={(e) => setBkDate(e.target.value)} className="mt-1 w-full bg-[#0a140f] border border-emerald-800/60 rounded-lg p-2 text-sm text-white" />
                </label>
                <label className="text-[11px] text-emerald-300 font-bold">
                  ميعاد أول ماتش
                  <input type="time" value={bkTime} onChange={(e) => setBkTime(e.target.value)} className="mt-1 w-full bg-[#0a140f] border border-emerald-800/60 rounded-lg p-2 text-sm text-white" />
                </label>
              </div>
              {bkStartAt && (
                <p className="text-[11px] text-amber-300 font-bold">
                  🔒 تشكيلات الحجز هتتقفل قبل أول ماتش بربع ساعة: {formatDeadline(bkStartAt - 15 * 60000)}
                </p>
              )}
              <button
                type="button"
                disabled={bkBusy || bkChosen.length < BOOKING_MIN_TEAMS || !bkFirst || !bkSecond}
                onClick={async () => {
                  setBkBusy(true);
                  const ok = await onStartBooking?.(bkChosen, bkFirst, bkSecond, bkStartAt ?? undefined);
                  setBkBusy(false);
                  if (ok) setActiveSection('live');
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-black text-sm disabled:opacity-40"
              >
                ابدأ الحجز
              </button>
              <p className="text-[11px] text-emerald-500">
                لو التعادل: الفريق الأقدم في الملعب بيخرج، وتقدر تختار مين يكمّل وقت إنهاء المباراة.
              </p>
            </div>
          )}

          {bkRows.length > 0 && (
            <div className="overflow-x-auto">
              <div className="text-xs font-black text-emerald-300 mb-1">إجماليات الفرق</div>
              <table className="w-full text-xs text-center">
                <thead className="text-emerald-400">
                  <tr><th className="text-right p-1">الفريق</th><th>لعب</th><th>فاز</th><th>تعادل</th><th>خسر</th><th>له</th><th>عليه</th><th>فرق</th><th>نقاط</th></tr>
                </thead>
                <tbody className="text-white font-bold">
                  {bkRows.map((r) => (
                    <tr key={r.teamId} className="border-t border-emerald-900/60">
                      <td className="text-right p-1">{tName(r.teamId)}</td>
                      <td>{r.played}</td><td>{r.won}</td><td>{r.drawn}</td><td>{r.lost}</td><td>{r.gf}</td><td>{r.ga}</td><td>{r.gd}</td><td className="text-amber-300">{r.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION: ADS (إعلانات التطبيق) */}
      {activeSection === 'ads' && (
        <div className="bg-[#122218] border border-emerald-700/40 rounded-2xl p-4 shadow-xl space-y-4">
          <div>
            <h3 className="font-black text-white text-base font-['Lalezar',sans-serif]">إعلانات التطبيق</h3>
            <p className="text-[11px] text-emerald-400 mt-1">بتظهر كدواير فوق في شاشة «المباريات». الضغط عليها يفتح تفاصيل الإعلان أو رابط أو شاشة في التطبيق.</p>
          </div>

          {/* معاينة */}
          <div className="flex gap-3 overflow-x-auto pb-1">
            {Object.values(topStories).map((s) => (
              <div key={s.id} className={`shrink-0 flex flex-col items-center gap-1 ${s.active === false ? 'opacity-40' : ''}`}>
                <div className={`w-14 h-14 rounded-full p-[2.5px] bg-gradient-to-tr ${s.colorGradient || AD_GRADIENTS[0]}`}>
                  <div className="w-full h-full rounded-full bg-[#182a20] flex items-center justify-center text-lg border-2 border-white">{s.iconText || '✦'}</div>
                </div>
                <span className="text-[10px] font-bold text-white max-w-[64px] truncate">{s.title}</span>
              </div>
            ))}
            {Object.keys(topStories).length === 0 && <span className="text-xs text-emerald-500">مفيش إعلانات لسه.</span>}
          </div>

          {/* القايمة */}
          <div className="space-y-2">
            {Object.values(topStories).map((s) => (
              <div key={s.id} className="bg-[#0a140f] border border-emerald-800/60 rounded-xl p-2.5 flex items-center gap-2 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="font-black text-white truncate">{s.title}</div>
                  <div className="text-emerald-500 text-[10px]">
                    {{ modal: 'تفاصيل', link: 'رابط', fantasy: 'شاشة فانتازي', season: 'شاشة الترتيب', live: 'شاشة الترتيب' }[s.actionType]}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={adBusy}
                  onClick={() => saveAds({ ...topStories, [s.id]: { ...s, active: s.active === false } })}
                  className={`px-2 py-1 rounded-lg font-bold ${s.active === false ? 'bg-gray-700 text-gray-300' : 'bg-emerald-600 text-white'}`}
                >
                  {s.active === false ? 'متوقف' : 'شغال'}
                </button>
                <button type="button" onClick={() => setAdForm({ ...emptyAd, ...s })} className="px-2 py-1 rounded-lg bg-sky-600 text-white font-bold">تعديل</button>
                <button
                  type="button"
                  disabled={adBusy}
                  onClick={async () => {
                    if (!window.confirm(`مسح إعلان «${s.title}»؟`)) return;
                    const next = { ...topStories };
                    delete next[s.id];
                    await saveAds(next);
                  }}
                  className="px-2 py-1 rounded-lg bg-red-600 text-white font-bold"
                >
                  مسح
                </button>
              </div>
            ))}
          </div>

          {/* إضافة / تعديل */}
          <div className="border-t border-emerald-800/60 pt-3 space-y-2 text-xs">
            <div className="font-black text-emerald-300">{adForm.id ? 'تعديل إعلان' : 'إضافة إعلان جديد'}</div>
            <div className="grid grid-cols-2 gap-2">
              <input value={adForm.title} onChange={(e) => setAdForm({ ...adForm, title: e.target.value })} placeholder="العنوان (تحت الدايرة)" maxLength={24} className="bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white" />
              <input value={adForm.subtitle || ''} onChange={(e) => setAdForm({ ...adForm, subtitle: e.target.value })} placeholder="سطر صغير جوه الدايرة" maxLength={14} className="bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white" />
              <input value={adForm.iconText || ''} onChange={(e) => setAdForm({ ...adForm, iconText: e.target.value })} placeholder="أيقونة / إيموجي" maxLength={6} className="bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white" />
              <input value={adForm.tag || ''} onChange={(e) => setAdForm({ ...adForm, tag: e.target.value })} placeholder="شارة (مثلاً إعلان)" maxLength={10} className="bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {AD_GRADIENTS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setAdForm({ ...adForm, colorGradient: g })}
                  className={`w-9 h-9 rounded-full bg-gradient-to-tr ${g} ${adForm.colorGradient === g ? 'ring-2 ring-white' : ''}`}
                  aria-label="لون"
                />
              ))}
            </div>
            <select value={adForm.actionType} onChange={(e) => setAdForm({ ...adForm, actionType: e.target.value as TopStoryAd['actionType'] })} className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white">
              <option value="modal">يفتح تفاصيل الإعلان (نص + اتصال وواتساب)</option>
              <option value="link">يفتح رابط أو واتساب مباشرة</option>
              <option value="fantasy">يفتح شاشة فانتازي</option>
              <option value="season">يفتح شاشة الترتيب والجدول</option>
            </select>
            {adForm.actionType === 'modal' && (
              <textarea value={adForm.detailsText || ''} onChange={(e) => setAdForm({ ...adForm, detailsText: e.target.value })} placeholder="تفاصيل الإعلان (عرض، عنوان المحل...)" rows={3} className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white" />
            )}
            {(adForm.actionType === 'modal' || adForm.actionType === 'link') && (
              <div className="grid grid-cols-2 gap-2">
                <input value={adForm.whatsapp || ''} onChange={(e) => setAdForm({ ...adForm, whatsapp: e.target.value })} placeholder="واتساب (مثال 01012345678)" inputMode="tel" dir="ltr" className="bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white" />
                <input value={adForm.phone || ''} onChange={(e) => setAdForm({ ...adForm, phone: e.target.value })} placeholder="رقم الاتصال" inputMode="tel" dir="ltr" className="bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white" />
              </div>
            )}
            {adForm.actionType === 'link' && (
              <input value={adForm.linkUrl || ''} onChange={(e) => setAdForm({ ...adForm, linkUrl: e.target.value })} placeholder="https://..." dir="ltr" className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white" />
            )}
            <div className="flex gap-2">
              <button type="button" disabled={adBusy} onClick={submitAd} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-black disabled:opacity-50">
                {adForm.id ? 'حفظ التعديل' : 'إضافة الإعلان'}
              </button>
              {adForm.id && (
                <button type="button" onClick={() => setAdForm(emptyAd)} className="px-4 rounded-xl bg-[#0a140f] text-emerald-300 font-bold">إلغاء</button>
              )}
            </div>
          </div>

          {/* رقم حجز الإعلانات */}
          <div className="border-t border-emerald-800/60 pt-3 space-y-2 text-xs">
            <div className="font-black text-emerald-300">زرار «أعلن معانا» للمعلنين</div>
            <p className="text-[11px] text-emerald-500">لو كتبت رقم، بيظهر للمشتركين زرار 📢 «أعلن معانا» آخر الدواير، وبيفتح تواصل معاك. سيبه فاضي لو مش عايزه.</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={adsWa} onChange={(e) => setAdsWa(e.target.value)} placeholder="واتساب" inputMode="tel" dir="ltr" className="bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white" />
              <input value={adsPh} onChange={(e) => setAdsPh(e.target.value)} placeholder="رقم الاتصال" inputMode="tel" dir="ltr" className="bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white" />
            </div>
            <button
              type="button"
              onClick={() => onUpdateConfig({ ...cfg, adsWhatsapp: intl(adsWa), adsPhone: digits(adsPh) })}
              className="w-full py-2.5 rounded-xl bg-amber-400 text-amber-950 font-black"
            >
              حفظ الأرقام
            </button>
          </div>
        </div>
      )}

      {/* SECTION: USERS */}
      {activeSection === 'users' && (
        <div className="bg-[#122218] border border-emerald-700/40 rounded-2xl p-4 shadow-xl space-y-3">
          <h3 className="font-black text-white text-base font-['Lalezar',sans-serif]">المستخدمون المسجّلون ({Object.keys(entries).length})</h3>
          {Object.keys(entries).length === 0 ? (
            <p className="text-emerald-300 text-xs font-bold">مفيش مشتركين لسه.</p>
          ) : (
            <div className="space-y-2">
              {Object.values(entries)
                .sort((a, b) => (b.joined || 0) - (a.joined || 0))
                .map((u) => (
                  <div key={u.id} className="bg-[#0a140f] border border-emerald-800/60 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-white text-sm">{u.name}</span>
                      <span className="text-emerald-400">{Object.keys(u.rounds || {}).length} جولة محفوظة</span>
                    </div>
                    {u.email && <div className="text-emerald-200 break-all" dir="ltr">{u.email}</div>}
                    {u.phone && <div className="text-emerald-200" dir="ltr">{u.phone}</div>}
                    {u.joined ? <div className="text-emerald-500">انضم: {new Date(u.joined).toLocaleDateString('ar-EG')}</div> : null}
                    <button
                      type="button"
                      onClick={() => setOpenUserId(openUserId === u.id ? null : u.id)}
                      className="mt-1 w-full bg-emerald-800/40 hover:bg-emerald-700/50 border border-emerald-700/60 text-emerald-100 font-bold rounded-lg py-1.5"
                    >
                      {openUserId === u.id ? 'اقفل التشكيلة ▲' : 'شوف التشكيلات ▼'}
                    </button>
                    {openUserId === u.id && (() => {
                      const roundKeys = Object.keys(u.rounds || {}).sort((a, b) => Number(a) - Number(b));
                      const options: { key: string; label: string; sq: SquadSelection | undefined }[] = [
                        ...roundKeys.map((k) => ({ key: k, label: `الجولة ${k}`, sq: u.rounds[Number(k)] })),
                        ...(u.bk ? [{ key: 'bk', label: 'الحجز', sq: u.bk }] : []),
                      ];
                      if (options.length === 0) return <p className="text-emerald-300 font-bold pt-1">المشترك ده لسه ما حفظش تشكيلة.</p>;
                      const selKey = options.some((o) => o.key === userRoundSel[u.id]) ? userRoundSel[u.id] : options[options.length - 1].key;
                      const cur = options.find((o) => o.key === selKey)!;
                      const sq = cur.sq;
                      const ids = sq?.ids ?? [];
                      const sorted = [...ids].sort((a, b) => POS_ORDER.indexOf(players[a]?.pos as Position) - POS_ORDER.indexOf(players[b]?.pos as Position));
                      const row = (pid: string) => {
                        const pl = players[pid];
                        return (
                          <div key={pid} className="flex items-center justify-between gap-2 bg-[#122218] rounded-lg px-2 py-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[10px] font-black text-amber-300 w-8 shrink-0">{pl ? POSITIONS_SHORT[pl.pos] : '؟'}</span>
                              <span className="text-white font-bold truncate">{pl ? pl.name : 'لاعب محذوف'}</span>
                              {sq?.cap === pid && <span className="bg-amber-400 text-black text-[10px] font-black rounded-full px-1.5">C</span>}
                            </div>
                            <span className="text-emerald-400 shrink-0">{pl ? (teams[pl.teamId]?.name ?? '') : ''}</span>
                          </div>
                        );
                      };
                      return (
                        <div className="pt-2 space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {options.map((o) => (
                              <button
                                key={o.key}
                                type="button"
                                onClick={() => setUserRoundSel({ ...userRoundSel, [u.id]: o.key })}
                                className={`px-2.5 py-1 rounded-full font-black border ${o.key === selKey ? 'bg-amber-400 text-black border-amber-400' : 'bg-[#122218] text-emerald-200 border-emerald-700/60'}`}
                              >
                                {o.label}
                              </button>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-emerald-300">
                            {sq?.form && <span>الخطة: <b className="text-white" dir="ltr">{sq.form}</b></span>}
                            {sq?.chip && <span>الكارت: <b className="text-white">{sq.chip === 'wildcard' ? 'Wildcard' : 'Free Hit'}</b></span>}
                            {sq?.tc ? <span>التحويلات: <b className="text-white">{sq.tc}</b></span> : null}
                            {sq?.pen ? <span>الخصم: <b className="text-red-300">-{sq.pen}</b></span> : null}
                          </div>
                          <div className="space-y-1">
                            <div className="text-emerald-400 font-black">التشكيلة الأساسية ({ids.length})</div>
                            {sorted.map(row)}
                          </div>
                          {sq?.bench && sq.bench.length > 0 && (
                            <div className="space-y-1">
                              <div className="text-emerald-400 font-black">الدكة ({sq.bench.length})</div>
                              {sq.bench.map(row)}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION: LIVE MATCH CONSOLE */}
      {activeSection === 'live' && (
        <LiveMatchConsole
          matches={matches}
          teams={teams}
          players={players}
          allRoundStats={allRoundStats}
          bookingStats={bookingStats}
          onLiveUpdate={onLiveUpdate}
          bookingActive={!!booking?.active}
          bookingMatchId={booking?.currentMatchId}
        />
      )}

      {/* SECTION: MATCHES SCHEDULE MANAGEMENT */}
      {activeSection === 'matches' && (
        <div className="space-y-4">
          {/* Add Match Form */}
          <form
            onSubmit={handleAddMatchSubmit}
            className="bg-[#122218] border border-emerald-700/40 rounded-2xl p-4 shadow-xl space-y-3"
          >
            <h3 className="font-black text-white text-base font-['Lalezar',sans-serif]">
              جدولة مباراة جديدة في الدورة
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-emerald-400 font-bold mb-1">الجولة</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={matchRound}
                  onChange={(e) => setMatchRound(Number(e.target.value))}
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-emerald-400 font-bold mb-1">الفريق الأول (صاحب الأرض)</label>
                <select
                  value={matchTeamA}
                  onChange={(e) => setMatchTeamA(e.target.value)}
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                >
                  {Object.values(teams).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-emerald-400 font-bold mb-1">الفريق الثاني (الضيف)</label>
                <select
                  value={matchTeamB}
                  onChange={(e) => setMatchTeamB(e.target.value)}
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                >
                  {Object.values(teams).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-emerald-400 font-bold mb-1">حالة اللقاء</label>
                <select
                  value={matchStatus}
                  onChange={(e) => setMatchStatus(e.target.value as any)}
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="upcoming">قادمة (لم تبدأ)</option>
                  <option value="live">مباشر الآن 🔴</option>
                  <option value="finished">انتهت</option>
                </select>
              </div>

              <div>
                <label className="block text-emerald-400 font-bold mb-1">تاريخ اللقاء</label>
                <input
                  type="date"
                  value={matchDate}
                  onChange={(e) => setMatchDate(e.target.value)}
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-emerald-400 font-bold mb-1">التوقيت</label>
                <input
                  type="time"
                  value={/^\d{2}:\d{2}$/.test(matchTime) ? matchTime : ''}
                  onChange={(e) => setMatchTime(e.target.value)}
                  placeholder="20:30"
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-emerald-400 font-bold mb-1">الملعب</label>
                <input
                  type="text"
                  value={matchPitch}
                  onChange={(e) => setMatchPitch(e.target.value)}
                  placeholder="الملعب الرئيسي"
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-emerald-400 font-bold mb-1">النتيجة (فريق أ - فريق ب)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="أ"
                    value={matchScoreA}
                    onChange={(e) => setMatchScoreA(e.target.value)}
                    className="w-1/2 bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white text-center focus:outline-none focus:border-amber-400"
                  />
                  <span>-</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="ب"
                    value={matchScoreB}
                    onChange={(e) => setMatchScoreB(e.target.value)}
                    className="w-1/2 bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white text-center focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-emerald-400 font-bold mb-1">هدافو الفريق الأول (مفصولين بفاصلة)</label>
                <input
                  type="text"
                  value={matchScorersAText}
                  onChange={(e) => setMatchScorersAText(e.target.value)}
                  placeholder="اسم اللاعب (2)، اسم لاعب تاني"
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-emerald-400 font-bold mb-1">هدافو الفريق الثاني (مفصولين بفاصلة)</label>
                <input
                  type="text"
                  value={matchScorersBText}
                  onChange={(e) => setMatchScorersBText(e.target.value)}
                  placeholder="عمر ميسي الشارع، هاني الهداف"
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-emerald-400 font-bold mb-1">رجل المباراة (اختياري)</label>
                <input
                  type="text"
                  value={matchMotm}
                  onChange={(e) => setMatchMotm(e.target.value)}
                  placeholder="اسم اللاعب المتميز"
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-emerald-400 font-bold mb-1">ملاحظات عن اللقاء</label>
                <input
                  type="text"
                  value={matchNotes}
                  onChange={(e) => setMatchNotes(e.target.value)}
                  placeholder="أجواء حماسية وحضور جماهيري غفير"
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                حفظ وجدولة اللقاء
              </button>
            </div>
          </form>

          {/* Matches List in Admin */}
          <div className="bg-[#122218] border border-emerald-700/40 rounded-2xl p-4 shadow-xl">
            <h3 className="font-black text-white text-base font-['Lalezar',sans-serif] mb-3">
              المباريات المجدولة ({Object.keys(matches).length})
            </h3>

            <div className="space-y-2">
              {Object.values(matches).map((m) => {
                const tA = teams[m.teamAId];
                const tB = teams[m.teamBId];

                return (
                  <div
                    key={m.id}
                    className="p-3 bg-[#0a140f] border border-emerald-800/60 rounded-xl flex items-center justify-between gap-3 text-xs flex-wrap"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-amber-400">ج{m.round}</span>
                      <span className="font-black text-white text-sm">
                        {tA?.name || 'فريق'} vs {tB?.name || 'فريق'}
                      </span>
                      <span className="text-emerald-400 font-mono">
                        {m.scoreA !== null && m.scoreA !== undefined ? `${m.scoreA} - ${m.scoreB}` : 'لم تلعب بعد'}
                      </span>
                      <span className="text-emerald-500 font-mono text-[11px]">
                        {m.date} • {m.time}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Status toggle buttons */}
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateMatch(m.id, {
                            status: m.status === 'live' ? 'finished' : m.status === 'upcoming' ? 'live' : 'upcoming',
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          m.status === 'live'
                            ? 'bg-red-600 text-white animate-pulse'
                            : m.status === 'finished'
                            ? 'bg-emerald-700 text-white'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {m.status === 'live' ? 'جارية الآن 🔴' : m.status === 'finished' ? 'انتهت ✓' : 'قادمة'}
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteMatch(m.id)}
                        className="p-1.5 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-950/40"
                        title="حذف اللقاء"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: Match Stats Recording (أهداف وإحصائيات اللاعبين) */}
      {activeSection === 'stats' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-sky-950/40 border border-sky-700/40 p-3 text-[11px] leading-relaxed text-sky-200">
            ⚙️ إحصائيات اللاعبين بتتحسب <b>تلقائي</b> من المباريات (الأهداف والصناعات والكروت ورجل الماتش والكلين شيت والمشاركة) كل ما تحفظ أو تسجل مباراة،
            ومنها بتتحسب نقاط الفانتازي والترتيب والهدافين. التعديل اليدوي هنا للتصحيح بس، وبيتحدّث تاني مع أول حفظ لمباراة في نفس الجولة.
          </div>

          <div className="bg-[#122218] border border-emerald-700/40 rounded-2xl p-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-emerald-800/40">
              {/* Round selector */}
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-white">اختر الجولة:</span>
                <div className="flex items-center gap-1 bg-[#0a140f] p-1 rounded-lg border border-emerald-800/60">
                  <button
                    type="button"
                    disabled={statsRound <= 1}
                    onClick={() => setStatsRound((r) => Math.max(1, r - 1))}
                    className="p-1 text-emerald-400 hover:text-white disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-amber-300 px-2 font-mono">
                    الجولة {statsRound}
                  </span>
                  <button
                    type="button"
                    disabled={statsRound >= cfg.round}
                    onClick={() => setStatsRound((r) => Math.min(cfg.round, r + 1))}
                    className="p-1 text-emerald-400 hover:text-white disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Team Selector Filter */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
                {Object.values(teams).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setStatsTeamId(t.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                      statsTeamId === t.id
                        ? 'bg-amber-400 text-amber-950 font-black shadow-sm'
                        : 'bg-[#0a140f] text-emerald-300 hover:text-white border border-emerald-800/60'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: t.c1 }}
                    />
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Players of the selected team */}
            <div className="divide-y divide-emerald-800/30">
              {Object.values(players)
                .filter((p) => p.teamId === statsTeamId)
                .map((player) => {
                  const pStats = currentRoundStatsDoc[player.id] || {};
                  const pts = calculatePlayerRoundPoints(player, pStats);
                  const isExpanded = expandedPlayerStatId === player.id;
                  const hasPlayed = !!pStats.pl;

                  return (
                    <div key={player.id} className="py-3 space-y-2">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <JerseyKit
                            c1={teams[player.teamId]?.c1}
                            c2={teams[player.teamId]?.c2}
                            pat={teams[player.teamId]?.pat}
                            num={player.num}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white truncate text-sm">
                                {player.name}
                              </span>
                              <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded font-black">
                                {POSITIONS_SHORT[player.pos]}
                              </span>
                            </div>
                            <div className="text-[11px] text-emerald-400/80">
                              نقاط الجولة: <strong className="text-amber-300 font-mono text-xs">{pts} ن</strong>
                            </div>
                          </div>
                        </div>

                        {/* Quick actions */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => modifyStat(player.id, 'pl', 0, true)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              hasPlayed
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[#0a140f] text-emerald-500 border border-emerald-800/60'
                            }`}
                          >
                            {hasPlayed ? 'شارك ✓' : 'لم يشارك'}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedPlayerStatId(isExpanded ? null : player.id)
                            }
                            className="px-3 py-1.5 bg-[#0e1a12] hover:bg-emerald-800/40 text-emerald-200 rounded-lg text-xs font-bold border border-emerald-700/50"
                          >
                            {isExpanded ? 'إغلاق التفاصيل' : 'تسجيل الأهداف'}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Stat Steppers */}
                      {isExpanded && (
                        <div className="p-3 bg-[#0a140f] rounded-xl border border-emerald-800/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          {/* Goals */}
                          <div className="bg-[#122218] p-2 rounded-lg flex items-center justify-between border border-emerald-800/40">
                            <span className="font-bold text-white">⚽ الأهداف:</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => modifyStat(player.id, 'g', -1)}
                                className="w-6 h-6 rounded bg-emerald-950 text-white font-bold"
                              >
                                -
                              </button>
                              <span className="font-mono font-black text-amber-300">
                                {pStats.g || 0}
                              </span>
                              <button
                                type="button"
                                onClick={() => modifyStat(player.id, 'g', 1)}
                                className="w-6 h-6 rounded bg-emerald-800 text-white font-bold"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Assists */}
                          <div className="bg-[#122218] p-2 rounded-lg flex items-center justify-between border border-emerald-800/40">
                            <span className="font-bold text-white">👟 صناعة:</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => modifyStat(player.id, 'a', -1)}
                                className="w-6 h-6 rounded bg-emerald-950 text-white font-bold"
                              >
                                -
                              </button>
                              <span className="font-mono font-black text-amber-300">
                                {pStats.a || 0}
                              </span>
                              <button
                                type="button"
                                onClick={() => modifyStat(player.id, 'a', 1)}
                                className="w-6 h-6 rounded bg-emerald-800 text-white font-bold"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Clean sheet (حارس ومدافع ووسط) */}
                          {player.pos !== 'FWD' && (
                            <button
                              type="button"
                              onClick={() => modifyStat(player.id, 'cs', 0, true)}
                              className={`p-2 rounded-lg text-center font-bold border transition-all ${
                                pStats.cs
                                  ? 'bg-emerald-600 text-white border-emerald-500'
                                  : 'bg-[#122218] text-emerald-400 border-emerald-800/40'
                              }`}
                            >
                              🧤 شباك نظيفة {pStats.cs ? '✓' : ''}
                            </button>
                          )}

                          {/* قطع كرات (مدافع) */}
                          {player.pos === 'DEF' && (
                            <div className="bg-[#122218] p-2 rounded-lg flex items-center justify-between border border-emerald-800/40">
                              <span className="font-bold text-white">🛡️ قطع كرات:</span>
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => modifyStat(player.id, 'tk', -1)} className="w-6 h-6 rounded bg-emerald-950 text-white font-bold">
                                  -
                                </button>
                                <span className="font-mono font-black text-amber-300">{pStats.tk || 0}</span>
                                <button type="button" onClick={() => modifyStat(player.id, 'tk', 1)} className="w-6 h-6 rounded bg-emerald-800 text-white font-bold">
                                  +
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Penalty saved (GK) */}
                          {player.pos === 'GK' && (
                            <div className="bg-[#122218] p-2 rounded-lg flex items-center justify-between border border-emerald-800/40">
                              <span className="font-bold text-white">🛡️ صد جزاء:</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => modifyStat(player.id, 'ps', -1)}
                                  className="w-6 h-6 rounded bg-emerald-950 text-white font-bold"
                                >
                                  -
                                </button>
                                <span className="font-mono font-black text-amber-300">
                                  {pStats.ps || 0}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => modifyStat(player.id, 'ps', 1)}
                                  className="w-6 h-6 rounded bg-emerald-800 text-white font-bold"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Man of match */}
                          <button
                            type="button"
                            onClick={() => modifyStat(player.id, 'mo', 0, true)}
                            className={`p-2 rounded-lg text-center font-bold border transition-all ${
                              pStats.mo
                                ? 'bg-amber-400 text-amber-950 font-black border-amber-300'
                                : 'bg-[#122218] text-emerald-400 border-emerald-800/40'
                            }`}
                          >
                            ⭐ رجل المباراة {pStats.mo ? '✓' : ''}
                          </button>

                          {/* Yellow Card */}
                          <div className="bg-[#122218] p-2 rounded-lg flex items-center justify-between border border-emerald-800/40">
                            <span className="font-bold text-yellow-300">🟨 إنذار (-1):</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => modifyStat(player.id, 'yc', -1)}
                                className="w-6 h-6 rounded bg-emerald-950 text-white font-bold"
                              >
                                -
                              </button>
                              <span className="font-mono font-black text-yellow-300">
                                {pStats.yc || 0}
                              </span>
                              <button
                                type="button"
                                onClick={() => modifyStat(player.id, 'yc', 1)}
                                className="w-6 h-6 rounded bg-emerald-800 text-white font-bold"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Red Card */}
                          <button
                            type="button"
                            onClick={() => modifyStat(player.id, 'rc', 0, true)}
                            className={`p-2 rounded-lg text-center font-bold border transition-all ${
                              pStats.rc
                                ? 'bg-red-600 text-white font-black border-red-500'
                                : 'bg-[#122218] text-red-300 border-emerald-800/40'
                            }`}
                          >
                            🟥 طرد (-3) {pStats.rc ? '✓' : ''}
                          </button>

                          {/* Penalty Missed */}
                          <div className="bg-[#122218] p-2 rounded-lg flex items-center justify-between border border-emerald-800/40">
                            <span className="font-bold text-red-300">❌ ضياع جزاء:</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => modifyStat(player.id, 'pm', -1)}
                                className="w-6 h-6 rounded bg-emerald-950 text-white font-bold"
                              >
                                -
                              </button>
                              <span className="font-mono font-black text-red-300">
                                {pStats.pm || 0}
                              </span>
                              <button
                                type="button"
                                onClick={() => modifyStat(player.id, 'pm', 1)}
                                className="w-6 h-6 rounded bg-emerald-800 text-white font-bold"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: Teams Management */}
      {activeSection === 'teams' && (
        <div className="space-y-4">
          {/* Add Team Card */}
          <form
            onSubmit={handleAddTeamSubmit}
            className="bg-[#122218] border border-emerald-700/40 rounded-2xl p-4 shadow-xl space-y-3"
          >
            <h3 className="font-black text-white text-base font-['Lalezar',sans-serif]">
              إضافة فريق شعبي جديد للدورة
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-emerald-400 font-bold mb-1">اسم الفريق</label>
                <input
                  type="text"
                  required
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="مثال: نسور ميت غمر"
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white placeholder-emerald-600 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-emerald-400 font-bold mb-1">اللون الأساسي للقميص</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newTeamC1}
                    onChange={(e) => setNewTeamC1(e.target.value)}
                    className="w-10 h-8 rounded border border-emerald-700/60 bg-transparent cursor-pointer"
                  />
                  <span className="font-mono text-emerald-300">{newTeamC1}</span>
                </div>
              </div>

              <div>
                <label className="block text-emerald-400 font-bold mb-1">اللون الثاني / الخطوط</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newTeamC2}
                    onChange={(e) => setNewTeamC2(e.target.value)}
                    className="w-10 h-8 rounded border border-emerald-700/60 bg-transparent cursor-pointer"
                  />
                  <span className="font-mono text-emerald-300">{newTeamC2}</span>
                </div>
              </div>

              <div>
                <label className="block text-emerald-400 font-bold mb-1">شكل القميص</label>
                <select
                  value={newTeamPat}
                  onChange={(e) => setNewTeamPat(e.target.value as any)}
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="plain">سادة</option>
                  <option value="stripes">خطوط طولية</option>
                  <option value="hoops">خطوط عرضية</option>
                  <option value="halves">نصفين</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                حفظ وإضافة الفريق
              </button>
            </div>
          </form>

          {/* Teams list */}
          <div className="bg-[#122218] border border-emerald-700/40 rounded-2xl p-4 shadow-xl">
            <h3 className="font-black text-white text-base font-['Lalezar',sans-serif] mb-3">
              فرق الدورة المسجلة ({Object.keys(teams).length})
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.values(teams).map((team) => {
                const teamPlayers = Object.values(players).filter((p) => p.teamId === team.id);

                return (
                  <div
                    key={team.id}
                    className="bg-[#0a140f] border border-emerald-800/60 rounded-xl p-3 flex items-center justify-between gap-3"
                  >
                    {editTeamId === team.id ? (
                      <div className="w-full space-y-2">
                        <input
                          value={editTeamName}
                          onChange={(e) => setEditTeamName(e.target.value)}
                          placeholder="اسم الفريق"
                          maxLength={40}
                          autoFocus
                          className="w-full bg-[#122218] border border-amber-400/60 rounded-lg p-2 text-sm text-white focus:outline-none"
                        />
                        <div className="flex items-center gap-3 text-[11px] text-emerald-300 font-bold">
                          <label className="flex items-center gap-1.5">
                            اللون الأساسي
                            <input type="color" value={editTeamC1} onChange={(e) => setEditTeamC1(e.target.value)} className="w-8 h-7 rounded bg-transparent" />
                          </label>
                          <label className="flex items-center gap-1.5">
                            الثاني
                            <input type="color" value={editTeamC2} onChange={(e) => setEditTeamC2(e.target.value)} className="w-8 h-7 rounded bg-transparent" />
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const name = editTeamName.trim();
                              if (!name) return window.alert('اكتب اسم الفريق');
                              if (Object.values(teams).some((t) => t.id !== team.id && t.name.trim() === name)) return window.alert('فيه فريق تاني بنفس الاسم');
                              onUpdateTeam(team.id, { name, c1: editTeamC1, c2: editTeamC2 });
                              setEditTeamId(null);
                            }}
                            className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-xs font-black"
                          >
                            حفظ
                          </button>
                          <button type="button" onClick={() => setEditTeamId(null)} className="px-4 py-2 rounded-lg bg-[#122218] text-emerald-300 text-xs font-bold">
                            إلغاء
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                    <div className="flex items-center gap-3">
                      <JerseyKit
                        c1={team.c1}
                        c2={team.c2}
                        pat={team.pat}
                        num={10}
                        kitUrl={team.kitUrl}
                        size="sm"
                      />
                      <div>
                        <span className="font-black text-white text-sm block">
                          {team.name}
                        </span>
                        <span className="text-[11px] text-emerald-400">
                          {teamPlayers.length} لاعب مسجل
                        </span>
                      </div>
                    </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditTeamId(team.id);
                              setEditTeamName(team.name);
                              setEditTeamC1(team.c1 || '#dc2626');
                              setEditTeamC2(team.c2 || '#0000ff');
                            }}
                            className="p-1.5 text-sky-400 hover:text-sky-300 hover:bg-sky-950/40 rounded-lg"
                            title="تعديل الفريق"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTeam(team.id)}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg"
                            title="حذف الفريق"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: Players Management */}
      {activeSection === 'players' && (
        <div className="space-y-4">
          {/* Add Single Player Card */}
          <form
            onSubmit={handleAddPlayerSubmit}
            className="bg-[#122218] border border-emerald-700/40 rounded-2xl p-4 shadow-xl space-y-3"
          >
            <h3 className="font-black text-white text-base font-['Lalezar',sans-serif]">
              إضافة لاعب فردي
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="block text-emerald-400 font-bold mb-1">اسم اللاعب</label>
                <input
                  type="text"
                  required
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="مثال: أحمد عبد الغني (زيكو)"
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white placeholder-emerald-600 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-emerald-400 font-bold mb-1">الفريق</label>
                <select
                  value={newPlayerTeamId}
                  onChange={(e) => setNewPlayerTeamId(e.target.value)}
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                >
                  {Object.values(teams).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-emerald-400 font-bold mb-1">المركز</label>
                <select
                  value={newPlayerPos}
                  onChange={(e) => setNewPlayerPos(e.target.value as any)}
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                >
                  {POS_ORDER.map((pos) => (
                    <option key={pos} value={pos}>
                      {POSITIONS_SHORT[pos]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-emerald-400 font-bold mb-1">السعر (مليون)</label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="15"
                  value={newPlayerPrice}
                  onChange={(e) => setNewPlayerPrice(e.target.value)}
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-emerald-400 font-bold mb-1">رقم القميص</label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={newPlayerNum}
                  onChange={(e) => setNewPlayerNum(e.target.value)}
                  placeholder="10"
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                إضافة اللاعب
              </button>
            </div>
          </form>

          {/* Bulk Import */}
          <form
            onSubmit={handleBulkSubmit}
            className="bg-[#122218] border border-emerald-700/40 rounded-2xl p-4 shadow-xl space-y-3"
          >
            <h3 className="font-black text-white text-base font-['Lalezar',sans-serif]">
              إضافة سريعة لمجموعة لاعبين (Bulk Import)
            </h3>
            <p className="text-xs text-emerald-300">
              اكتب كل لاعب في سطر بالصيغة: <code>الاسم | المركز | السعر | رقم القميص</code> (مثال: <code>اسم اللاعب | مهاجم | 8.5 | 10</code>)
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="sm:col-span-1">
                <label className="block text-emerald-400 font-bold mb-1">الفريق المستهدف</label>
                <select
                  value={bulkTeamId}
                  onChange={(e) => setBulkTeamId(e.target.value)}
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                >
                  {Object.values(teams).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-emerald-400 font-bold mb-1">قائمة اللاعبين</label>
                <textarea
                  rows={4}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`عمر الساحر | وسط | 7.5 | 8\nمحمد الشناوي | حارس | 6.0 | 1\nأحمد حجازي | مدافع | 6.5 | 4`}
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white font-mono text-xs placeholder-emerald-700 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                استيراد القائمة فوراً
              </button>
            </div>
          </form>

          {/* قائمة اللاعبين: تعديل / حذف */}
          <div className="bg-[#122218] border border-emerald-700/40 rounded-2xl p-4 shadow-xl space-y-3">
            <h3 className="font-black text-white text-base font-['Lalezar',sans-serif]">
              تعديل اللاعبين ({Object.keys(players).length})
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input
                value={playersQuery}
                onChange={(e) => setPlayersQuery(e.target.value)}
                placeholder="🔍 ابحث باسم اللاعب"
                className="bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
              />
              <select
                value={playersFilterTeam}
                onChange={(e) => setPlayersFilterTeam(e.target.value)}
                className="bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
              >
                <option value="all">كل الفرق</option>
                {Object.values(teams).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 max-h-[28rem] overflow-y-auto">
              {Object.values(players)
                .filter((pl) => playersFilterTeam === 'all' || pl.teamId === playersFilterTeam)
                .filter((pl) => !playersQuery.trim() || pl.name.includes(playersQuery.trim()))
                .sort((a, b) => a.teamId.localeCompare(b.teamId) || POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos))
                .map((pl) =>
                  editPlayerId === pl.id ? (
                    <div key={pl.id} className="bg-[#0a140f] border border-amber-400/50 rounded-xl p-3 space-y-2 text-xs">
                      <input
                        value={epName}
                        onChange={(e) => setEpName(e.target.value)}
                        placeholder="اسم اللاعب"
                        maxLength={40}
                        autoFocus
                        className="w-full bg-[#122218] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={epTeam}
                          onChange={(e) => setEpTeam(e.target.value)}
                          className="bg-[#122218] border border-emerald-700/60 rounded-lg p-2 text-white"
                        >
                          {Object.values(teams).map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={epPos}
                          onChange={(e) => setEpPos(e.target.value as Position)}
                          className="bg-[#122218] border border-emerald-700/60 rounded-lg p-2 text-white"
                        >
                          {POS_ORDER.map((k) => (
                            <option key={k} value={k}>
                              {POSITIONS_SHORT[k]}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.1"
                          min={1}
                          value={epPrice}
                          onChange={(e) => setEpPrice(e.target.value)}
                          placeholder="السعر"
                          className="bg-[#122218] border border-emerald-700/60 rounded-lg p-2 text-white"
                        />
                        <input
                          type="number"
                          min={0}
                          value={epNum}
                          onChange={(e) => setEpNum(e.target.value)}
                          placeholder="رقم القميص"
                          className="bg-[#122218] border border-emerald-700/60 rounded-lg p-2 text-white"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const name = epName.trim();
                            if (!name) return window.alert('اكتب اسم اللاعب');
                            onUpdatePlayer?.(pl.id, {
                              name,
                              teamId: epTeam,
                              pos: epPos,
                              price: Math.max(1, parseFloat(epPrice) || pl.price),
                              num: epNum ? parseInt(epNum, 10) : null,
                            });
                            setEditPlayerId(null);
                          }}
                          className="flex-1 py-2 rounded-lg bg-emerald-600 text-white font-black"
                        >
                          حفظ
                        </button>
                        <button type="button" onClick={() => setEditPlayerId(null)} className="px-4 py-2 rounded-lg bg-[#122218] text-emerald-300 font-bold">
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={pl.id} className="bg-[#0a140f] border border-emerald-800/60 rounded-xl p-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-black text-white text-sm block truncate">
                          {pl.num != null ? `${pl.num}. ` : ''}
                          {pl.name}
                        </span>
                        <span className="text-[11px] text-emerald-400">
                          {teams[pl.teamId]?.name || '—'} • {POSITIONS_SHORT[pl.pos]} • {Number(pl.price).toFixed(1)}م
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditPlayerId(pl.id);
                            setEpName(pl.name);
                            setEpTeam(pl.teamId);
                            setEpPos(pl.pos);
                            setEpPrice(String(pl.price));
                            setEpNum(pl.num != null ? String(pl.num) : '');
                          }}
                          className="p-1.5 text-sky-400 hover:text-sky-300 hover:bg-sky-950/40 rounded-lg"
                          title="تعديل اللاعب"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`حذف ${pl.name}؟`)) onDeletePlayer(pl.id);
                          }}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg"
                          title="حذف اللاعب"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: Tournament Settings */}
      {activeSection === 'settings' && (
        <div className="space-y-4">
          <div className="bg-[#122218] border border-emerald-700/40 rounded-2xl p-4 shadow-xl space-y-4">
            <h3 className="font-black text-white text-base font-['Lalezar',sans-serif]">
              إعدادات البطولة والجولات
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-emerald-400 font-bold mb-1">اسم الدورة</label>
                <input
                  type="text"
                  value={cfgName}
                  onChange={(e) => setCfgName(e.target.value)}
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-emerald-400 font-bold mb-1">الميزانية المتاحة (مليون)</label>
                <input
                  type="number"
                  value={cfgBudget}
                  onChange={(e) => setCfgBudget(Number(e.target.value))}
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-emerald-400 font-bold mb-1">الحد الأقصى لكل نادٍ</label>
                <input
                  type="number"
                  value={cfgMaxPerTeam}
                  onChange={(e) => setCfgMaxPerTeam(Number(e.target.value))}
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-emerald-400 font-bold mb-1">تحويلات مجانية كل جولة</label>
                <input
                  type="number"
                  min={0}
                  value={cfgFreeTransfers}
                  onChange={(e) => setCfgFreeTransfers(Number(e.target.value))}
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-emerald-400 font-bold mb-1">خصم كل تحويل زيادة (نقاط)</label>
                <input
                  type="number"
                  min={0}
                  value={cfgTransferPenalty}
                  onChange={(e) => setCfgTransferPenalty(Number(e.target.value))}
                  className="w-full bg-[#0a140f] border border-emerald-700/60 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveConfig}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                حفظ الإعدادات
              </button>
            </div>
          </div>

          {/* Round Controls */}
          <div className="bg-[#122218] border border-emerald-700/40 rounded-2xl p-4 shadow-xl space-y-3">
            <h3 className="font-black text-white text-base font-['Lalezar',sans-serif]">
              التحكم في بدء وقفل الجولة {cfg.round}
            </h3>
            <p className="text-xs text-emerald-300">
              عند بدء الجولة، تُقفل التشكيلات وتثبت نتائجها، وأي تعديل يُحسب للجولة القادمة.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-emerald-200 font-bold">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={cfg.autoLock !== false}
                  onChange={(e) => onUpdateConfig({ ...cfg, autoLock: e.target.checked })}
                />
                قفل تلقائي قبل أول ماتش في الجولة
              </label>
              <label className="flex items-center gap-2">
                قبلها بـ
                <input
                  type="number"
                  min={0}
                  max={600}
                  defaultValue={cfg.deadlineMinutes ?? 30}
                  onBlur={(e) => {
                    const v = Math.max(0, Math.min(600, Number(e.target.value) || 0));
                    if (v !== (cfg.deadlineMinutes ?? 30)) onUpdateConfig({ ...cfg, deadlineMinutes: v });
                  }}
                  className="w-16 bg-[#0a140f] border border-emerald-800/60 rounded-lg p-1 text-center text-white"
                />
                دقيقة (بتوقيت مصر، من تاريخ ووقت أول ماتش)
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onUpdateConfig({ ...cfg, locked: !cfg.locked })}
                className={`px-4 py-2 rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-2 ${
                  cfg.locked
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-amber-400 hover:bg-amber-300 text-amber-950'
                }`}
              >
                {cfg.locked ? (
                  <>
                    <Unlock className="w-4 h-4" />
                    إعادة فتح التشكيلات للجولة {cfg.round}
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    بدء وقفل الجولة {cfg.round} الآن
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateConfig({
                    ...cfg,
                    round: cfg.round + 1,
                    locked: false,
                  })
                }
                className="px-4 py-2 bg-[#0e1a12] hover:bg-emerald-800/40 text-emerald-200 border border-emerald-600/60 rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-2"
              >
                فتح الجولة التالية ({cfg.round + 1})
              </button>
            </div>
          </div>

          {/* Reset Demo Data */}
          <div className="bg-[#122218] border border-red-800/40 rounded-2xl p-4 shadow-xl space-y-3">
            <h3 className="font-black text-red-300 text-base font-['Lalezar',sans-serif]">
              استعادة البيانات التجريبية للدورة
            </h3>
            <p className="text-xs text-emerald-400/80">
              يمكنك إعادة تحميل دورة تجريبية متكاملة بفرقها ولاعبيها لتجربة النظام بالكامل.
            </p>

            <button
              type="button"
              onClick={onResetDemoData}
              className="px-4 py-2 bg-red-900/60 hover:bg-red-800 text-red-100 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-red-700/50"
            >
              <RotateCcw className="w-4 h-4" />
              🗑 مسح كل البيانات التجريبية (فرق ولاعبين ومباريات وإحصائيات وتشكيلات)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
