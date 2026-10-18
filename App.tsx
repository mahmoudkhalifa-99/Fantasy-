import React, { useState, useEffect, useRef } from 'react';
import {
  TournamentConfig,
  Team,
  Player,
  Entry,
  Match,
  Position,
  PlayerMatchStats,
  ChipType,
} from './types';
import { PLScreenLatest } from './components/PLScreenLatest';
import { PLScreenFantasy } from './components/PLScreenFantasy';
import { PLScreenSeason } from './components/PLScreenSeason';
import { PLTransfersView } from './components/PLTransfersView';
import { PlayersMarketView } from './components/PlayersMarketView';
import { AdminPanel } from './components/AdminPanel';
import { AdminLoginPage } from './components/AdminLoginPage';
import { UserLoginPage } from './components/UserLoginPage';
import { PLStandingsView } from './components/PLStandingsView';
import { computeStandings } from './utils/standings';
import { getAdminHeaders, adminReasonMessage, hasAdminSession, hasFirebaseSession, firebaseEnabled, adminSignOut, userSignOut, localSignOut, isLocalRegistered, currentUid } from './utils/adminAuth';
import { PLBottomNav, MainTab } from './components/PLBottomNav';
import { PlayerPickerModal } from './components/PlayerPickerModal';
import { RulesModal } from './components/RulesModal';
import type { LiveState } from './utils/liveMatch';
import { chipUsedRound, findBaseSquad } from './utils/transfers';
import { deriveRoundStats } from './utils/deriveStats';
import { RegistrationModal } from './components/RegistrationModal';
import {
  calculateSquadRoundPoints,
  validateSquad,
} from './utils/fantasyScoring';
import {
  Sparkles,
  X,
  HelpCircle,
  Megaphone,
  Phone,
  MessageCircle,
  Trophy,
} from 'lucide-react';

const USER_TOKEN_STORAGE = 'fantasy_dawra_token';

// توكن سري خاص بالجهاز: السيرفر بيستخدمه عشان محدش يعدل تشكيلة غيره
function getUserToken(): string {
  let t = localStorage.getItem(USER_TOKEN_STORAGE);
  if (!t) {
    const rnd = () =>
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    t = `${rnd()}${rnd()}`.replace(/-/g, '');
    localStorage.setItem(USER_TOKEN_STORAGE, t);
  }
  return t;
}

async function authHeaders(): Promise<Record<string, string>> {
  return { 'x-user-token': getUserToken(), ...(await getAdminHeaders()) };
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<MainTab>('latest');
  const [activeChip, setActiveChip] = useState<ChipType | null>(null);
  const isAdminPath = () => window.location.pathname.replace(/\/+$/, '') === '/admin';
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(isAdminPath);
  useEffect(() => {
    const on = () => setIsAdminRoute(isAdminPath());
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  const [isBookingAdOpen, setIsBookingAdOpen] = useState(false);

  // Tournament Data from Server
  const [cfg, setCfg] = useState<TournamentConfig>({
    name: 'دورة المنوفية الكبرى للشعبية والرمضانية',
    location: 'ملعب الساحة الشعبية',
    budget: 50,
    maxPerTeam: 2,
    round: 1,
    locked: false,
  });
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [matches, setMatches] = useState<Record<string, Match>>({});
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [allRoundStats, setAllRoundStats] = useState<
    Record<number, { p: Record<string, PlayerMatchStats> }>
  >({});

  // Current user info
  const [userId, setUserId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userPhone, setUserPhone] = useState<string>('');

  // Draft squad state
  const [squadIds, setSquadIds] = useState<string[]>([]);
  const [captainId, setCaptainId] = useState<string>('');
  const [formation, setFormation] = useState<string>('2-2-2');
  const [isDraftDirty, setIsDraftDirty] = useState<boolean>(false);

  // Modals state
  const [isTransfersPageOpen, setIsTransfersPageOpen] = useState(false);
  const [isStandingsOpen, setIsStandingsOpen] = useState(false);
  const [playerToReplaceId, setPlayerToReplaceId] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerTargetPos, setPickerTargetPos] = useState<Position | 'ALL'>('ALL');
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1500);
    return () => clearTimeout(t);
  }, []);
  const [isAdminAuthed, setIsAdminAuthed] = useState<boolean>(() => (firebaseEnabled ? false : hasAdminSession()));
  // مع Firebase: أي مشترك مسجّل دخول ممكن يفتح /admin، فلازم السيرفر يأكد إنه منظم فعلًا
  const [adminChecking, setAdminChecking] = useState<boolean>(() => firebaseEnabled && hasFirebaseSession());
  const [adminNotice, setAdminNotice] = useState('');
  useEffect(() => {
    if (!firebaseEnabled || !hasFirebaseSession()) {
      setAdminChecking(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/tournament/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await getAdminHeaders()) },
          body: '{}',
        });
        const json = await res.json().catch(() => ({} as any));
        setIsAdminAuthed(res.ok && !!json.ok);
        if (!(res.ok && json.ok)) setAdminNotice(adminReasonMessage(json));
      } catch {
        setIsAdminAuthed(false);
        setAdminNotice('تعذر الاتصال بالسيرفر للتحقق من صلاحية المنظم، جرّب تاني.');
      } finally {
        setAdminChecking(false);
      }
    })();
  }, []);

  // Initial setup
  useEffect(() => {
    const fbUid = currentUid();
    if (fbUid) localStorage.setItem('fantasy_dawra_uid', fbUid);
    let uid = localStorage.getItem('fantasy_dawra_uid');
    if (!uid) {
      uid = `coach_${Date.now()}`;
      localStorage.setItem('fantasy_dawra_uid', uid);
    }
    setUserId(uid);

    const savedName = localStorage.getItem('fantasy_dawra_name');
    if (savedName) setUserName(savedName);

    const savedPhone = localStorage.getItem('fantasy_dawra_phone');
    if (savedPhone) setUserPhone(savedPhone);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3200);
  };

  // Fetch tournament data from backend
  const fetchData = async () => {
    try {
      const res = await fetch('/api/tournament/data', { headers: await authHeaders() });
      if (!res.ok) throw new Error('فشل جلب البيانات');
      const data = await res.json();
      if (data.cfg) setCfg(data.cfg);
      if (data.teams) setTeams(data.teams);
      if (data.players) setPlayers(data.players);
      if (data.matches) setMatches(data.matches);
      if (data.entries) setEntries(data.entries);
      if (data.stats) setAllRoundStats(data.stats);

      // Auto-populate user squad if found
      const uid = localStorage.getItem('fantasy_dawra_uid');
      if (uid && data.entries && data.entries[uid]) {
        const uEntry = data.entries[uid];
        setUserName(uEntry.name || localStorage.getItem('fantasy_dawra_name') || '');
        const activeR = data.cfg.locked ? data.cfg.round + 1 : data.cfg.round;
        let sq = uEntry.rounds[activeR];
        if (!sq) {
          for (let i = activeR - 1; i >= 1; i--) {
            if (uEntry.rounds[i]) {
              sq = uEntry.rounds[i];
              break;
            }
          }
        }
        setActiveChip(uEntry.rounds[activeR]?.chip || null);
        if (sq && sq.ids) {
          setSquadIds(sq.ids);
          setCaptainId(sq.cap || sq.ids[0] || '');
          if (sq.form) setFormation(sq.form);
        }
      } else {
        // حساب جديد: تشكيلة فاضية، المشترك هو اللي يختار لاعبينه
        setSquadIds([]);
        setCaptainId('');
      }
    } catch (err) {
      console.error('Data fetch error:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ---- التسجيل المباشر للمباراة ----
  const matchesRef = useRef(matches);
  const statsRef = useRef(allRoundStats);
  matchesRef.current = matches;
  statsRef.current = allRoundStats;
  const livePending = useRef(0);
  const liveQueue = useRef<Promise<void>>(Promise.resolve());

  const handleLiveUpdate = (matchId: string, fn: (s: LiveState) => LiveState) => {
    const m = matchesRef.current[matchId];
    if (!m) return;
    const roundDoc = statsRef.current[m.round] || { p: {} };
    const r = fn({ match: m, stats: roundDoc.p || {} });
    const newMatches = { ...matchesRef.current, [matchId]: r.match };
    const derived = deriveRoundStats(m.round, newMatches, players, r.stats);
    const newStats = { ...statsRef.current, [m.round]: { ...roundDoc, p: derived } };
    matchesRef.current = newMatches;
    statsRef.current = newStats;
    setMatches(newMatches);
    setAllRoundStats(newStats);

    livePending.current++;
    liveQueue.current = liveQueue.current.then(async () => {
      try {
        const res = await fetch('/api/tournament/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify({ matches: matchesRef.current, stats: statsRef.current }),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        showToast('⚠️ فشل حفظ آخر حدث، اتأكد من النت');
        livePending.current = 1; // هتتصفّر تحت
        await fetchData();
      } finally {
        livePending.current = Math.max(0, livePending.current - 1);
      }
    });
  };

  // تحديث تلقائي للمباريات والإحصائيات (عشان المشتركين يشوفوا الجول وهو بيحصل)
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden || livePending.current > 0) return;
      try {
        const res = await fetch('/api/tournament/data', { headers: await authHeaders() });
        if (!res.ok || livePending.current > 0) return;
        const data = await res.json();
        if (data.matches) setMatches(data.matches);
        if (data.stats) setAllRoundStats(data.stats);
        if (data.cfg) setCfg(data.cfg);
      } catch {
        /* تجاهل أخطاء الشبكة المؤقتة */
      }
    }, 10000);
    return () => clearInterval(t);
  }, []);

  const logoutAdmin = () => {
    adminSignOut();
    setIsAdminAuthed(false);
  };

  // Sync state to backend
  const syncServerData = async (payload: any) => {
    try {
      const res = await fetch('/api/tournament/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        if (res.status === 403 && json.error === 'admin_required') {
          logoutAdmin();
          showToast('⚠️ مفتاح المنظم غير صالح، سجّل الدخول تاني');
        } else if (json.error === 'login_required') {
          showToast('⚠️ انتهت جلسة الدخول، سجّل دخول تاني');
          userSignOut();
          setTimeout(() => window.location.replace('/'), 1200);
        } else if (json.error === 'not_owner') {
          showToast('⚠️ التشكيلة دي مسجلة من حساب تاني');
        } else if (res.status < 500 && json.error) {
          showToast(`⚠️ ${json.error}`);
        } else {
          showToast('⚠️ تعذر الحفظ على السيرفر');
        }
        return false;
      }
      if (json.data) {
        if (json.data.cfg) setCfg(json.data.cfg);
        if (json.data.teams) setTeams(json.data.teams);
        if (json.data.players) setPlayers(json.data.players);
        if (json.data.matches) setMatches(json.data.matches);
        if (json.data.entries) setEntries(json.data.entries);
        if (json.data.stats) setAllRoundStats(json.data.stats);
      }
      return true;
    } catch (err) {
      console.error(err);
      showToast('⚠️ تعذر الحفظ على السيرفر');
      return false;
    }
  };

  // Squad actions
  const handleSaveSquad = async () => {
    const check = validateSquad(squadIds, captainId, players, cfg, formation);
    if (!check.isValid) {
      showToast(`⚠️ ${check.errors[0]}`);
      return;
    }
    const activeEditingRound = cfg.locked ? cfg.round + 1 : cfg.round;
    const updatedUserEntry: Entry = {
      id: userId,
      name: userName,
      ...(userPhone ? { phone: userPhone } : {}),
      joined: entries[userId]?.joined || Date.now(),
      rounds: {
        ...(entries[userId]?.rounds || {}),
        [activeEditingRound]: {
          ids: [...squadIds],
          cap: captainId,
          form: formation,
          ...(activeChip ? { chip: activeChip } : {}),
        },
      },
    };

    const success = await syncServerData({ entry: updatedUserEntry });
    if (success) {
      setIsDraftDirty(false);
      showToast(`✅ تم حفظ تشكيلة الجولة ${activeEditingRound} بنجاح!`);
    }
  };

  const handleSelectPlayer = (player: Player) => {
    if (playerToReplaceId) {
      const nextSquad = squadIds.map((id) => (id === playerToReplaceId ? player.id : id));
      setSquadIds(nextSquad);
      if (captainId === playerToReplaceId) {
        setCaptainId(player.id);
      }
      setPlayerToReplaceId(null);
      setIsDraftDirty(true);
      showToast(`✅ تم استبدال اللاعب بـ ${player.name}`);
      return;
    }
    if (squadIds.includes(player.id)) return;
    const nextSquad = [...squadIds, player.id];
    setSquadIds(nextSquad);
    if (!captainId) setCaptainId(player.id);
    setIsDraftDirty(true);
  };

  const handleRemovePlayer = (pid: string) => {
    const nextSquad = squadIds.filter((id) => id !== pid);
    setSquadIds(nextSquad);
    if (captainId === pid) {
      setCaptainId(nextSquad[0] || '');
    }
    setIsDraftDirty(true);
  };

  const handleSetCaptain = (pid: string) => {
    setCaptainId(pid);
    setIsDraftDirty(true);
    showToast(`⭐ تم اختيار ${players[pid]?.name || 'اللاعب'} كابتن (x2)!`);
  };

  // Matches actions
  const handleAddMatch = async (newMatch: Omit<Match, 'id'>) => {
    const id = `m_${Date.now()}`;
    const updated = {
      ...matches,
      [id]: { ...newMatch, id },
    };
    await syncServerData({ matches: updated });
    showToast('✅ تم إضافة اللقاء إلى جدول المباريات');
  };

  const handleUpdateMatch = async (id: string, updates: Partial<Match>) => {
    const updated = {
      ...matches,
      [id]: { ...matches[id], ...updates },
    };
    await syncServerData({ matches: updated });
    showToast('✅ تم تحديث بيانات اللقاء');
  };

  const handleDeleteMatch = async (id: string) => {
    const updated = { ...matches };
    delete updated[id];
    await syncServerData({ matches: updated });
    showToast('تم حذف اللقاء');
  };

  // Admin CRUD
  const handleUpdateConfig = async (newCfg: TournamentConfig) => {
    await syncServerData({ cfg: newCfg });
    showToast('✅ تم حفظ إعدادات الدورة');
  };

  const handleAddTeam = async (newTeam: Omit<Team, 'id'>) => {
    const id = `t_${Date.now()}`;
    const updatedTeams = {
      ...teams,
      [id]: { ...newTeam, id },
    };
    await syncServerData({ teams: updatedTeams });
    showToast(`✅ تم إضافة فريق ${newTeam.name}`);
  };

  const handleUpdateTeam = async (id: string, updates: Partial<Team>) => {
    const updated = {
      ...teams,
      [id]: { ...teams[id], ...updates },
    };
    await syncServerData({ teams: updated });
    showToast('✅ تم تحديث بيانات الفريق');
  };

  const handleDeleteTeam = async (id: string) => {
    const updated = { ...teams };
    delete updated[id];
    await syncServerData({ teams: updated });
    showToast('تم حذف الفريق');
  };

  const handleAddPlayer = async (newP: Omit<Player, 'id'>) => {
    const id = `p_${Date.now()}`;
    const updated = {
      ...players,
      [id]: { ...newP, id },
    };
    await syncServerData({ players: updated });
    showToast(`✅ تم إضافة ${newP.name}`);
  };

  const handleBulkAddPlayers = async (teamId: string, lines: string) => {
    const newEntries: Record<string, Player> = {};
    let addedCount = 0;

    lines.split('\n').forEach((line) => {
      const parts = line.split(/[|،,]/).map((s) => s.trim());
      if (parts.length >= 2) {
        const name = parts[0];
        const posRaw = (parts[1] || '').toLowerCase();
        const posDict: any = {
          حارس: 'GK', جول: 'GK', gk: 'GK',
          مدافع: 'DEF', دفاع: 'DEF', def: 'DEF',
          وسط: 'MID', خط: 'MID', mid: 'MID',
          مهاجم: 'FWD', هجوم: 'FWD', fwd: 'FWD',
        };
        const pos = posDict[posRaw] || 'FWD';
        const price = Math.max(1, parseFloat(parts[2]) || 6.0);
        const num = parts[3] ? parseInt(parts[3], 10) : undefined;

        if (name) {
          const id = `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          newEntries[id] = { id, name, teamId, pos, price, num };
          addedCount++;
        }
      }
    });

    if (addedCount > 0) {
      const updated = { ...players, ...newEntries };
      await syncServerData({ players: updated });
      showToast(`✅ تم استيراد ${addedCount} لاعباً بنجاح!`);
    }
  };

  const handleDeletePlayer = async (id: string) => {
    const updated = { ...players };
    delete updated[id];
    await syncServerData({ players: updated });
    showToast('تم حذف اللاعب');
  };

  const handleUpdatePlayerStats = async (
    round: number,
    playerId: string,
    pStats: PlayerMatchStats
  ) => {
    const roundDoc = allRoundStats[round] || { p: {} };
    const updatedRoundDoc = {
      ...roundDoc,
      p: {
        ...roundDoc.p,
        [playerId]: pStats,
      },
    };
    const updatedAll = {
      ...allRoundStats,
      [round]: updatedRoundDoc,
    };
    await syncServerData({ stats: updatedAll });
  };

  // مسح كل البيانات التجريبية: فرق ولاعبين ومباريات وإحصائيات وتشكيلات المشتركين
  const handleResetDemoData = async () => {
    if (
      !window.confirm(
        'هتمسح كل الفرق واللاعبين والمباريات والإحصائيات وتشكيلات المشتركين. الحسابات نفسها هتفضل. مفيش رجوع. تكمّل؟'
      )
    )
      return;
    const ok = await syncServerData({ wipe: true });
    if (!ok) return;
    setSquadIds([]);
    setCaptainId('');
    setActiveChip(null);
    await fetchData();
    showToast('✅ تم مسح كل البيانات التجريبية');
  };

  // شاشة دخول المشتركين (Firebase): بتظهر لو مفيش حساب مسجّل دخول
  if (!isAdminRoute && (firebaseEnabled ? !hasFirebaseSession() : !isLocalRegistered())) {
    return <UserLoginPage />;
  }

  if (isAdminRoute && adminChecking) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-[#04100c] text-emerald-300 text-sm font-bold">
        لحظة...
      </div>
    );
  }

  if (isAdminRoute) {
    if (!isAdminAuthed) {
      return (
        <AdminLoginPage
          notice={adminNotice}
          onSignOut={() => {
            adminSignOut();
            setAdminNotice('');
            window.location.replace('/admin');
          }}
          onSuccess={() => {
            setIsAdminAuthed(true);
            fetchData();
          }}
        />
      );
    }
    return (
      <div dir="rtl" className="min-h-screen bg-[#04100c] text-[#e8f1ea] pb-16 font-['Cairo',sans-serif]">
        {toastMessage && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-950 text-white px-5 py-2.5 rounded-full font-bold shadow-2xl text-xs sm:text-sm flex items-center gap-2 border border-purple-500/40">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{toastMessage}</span>
          </div>
        )}
        <div className="max-w-3xl mx-auto px-3.5 pt-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <a href="/" className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl">
              ← الموقع
            </a>
            <button
              type="button"
              onClick={() => {
                logoutAdmin();
                fetchData();
              }}
              className="px-3 py-2 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/50 font-bold text-xs rounded-xl cursor-pointer"
            >
              تسجيل خروج
            </button>
          </div>
          <AdminPanel
            cfg={cfg}
            teams={teams}
            players={players}
            matches={matches}
            allRoundStats={allRoundStats}
            onUpdateConfig={handleUpdateConfig}
            onAddTeam={handleAddTeam}
            onUpdateTeam={handleUpdateTeam}
            onDeleteTeam={handleDeleteTeam}
            onAddPlayer={handleAddPlayer}
            onBulkAddPlayers={handleBulkAddPlayers}
            onDeletePlayer={handleDeletePlayer}
            onUpdatePlayerStats={handleUpdatePlayerStats}
            onAddMatch={handleAddMatch}
            onUpdateMatch={handleUpdateMatch}
            onDeleteMatch={handleDeleteMatch}
            onResetDemoData={handleResetDemoData}
            onLiveUpdate={handleLiveUpdate}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f7f4] dark:bg-[#04100c] text-gray-900 dark:text-[#e8f1ea] pb-28 selection:bg-purple-600 selection:text-white font-['Cairo',sans-serif]">
      {/* شاشة البداية: Tahway League */}
      <div
        aria-hidden={!showSplash}
        className={`fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-[radial-gradient(ellipse_at_50%_35%,#0e4a2e,#04100c_70%)] transition-opacity duration-500 ${
          showSplash ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <img src="/crest.png" alt="Tahway League" className="brand-pop w-60 max-w-[70vw]" />
        <div className="w-36 h-1.5 rounded-full bg-emerald-950 overflow-hidden">
          <div className="brand-load h-full w-full rounded-full bg-emerald-500" />
        </div>
        <p className="text-lg font-black text-amber-400">الدوري يبدأ من هنا</p>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-950 text-white px-5 py-2.5 rounded-full font-bold shadow-2xl animate-in fade-in slide-in-from-top-4 text-xs sm:text-sm flex items-center gap-2 border border-purple-500/40">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* FULL PAGE: TRANSFERS VIEW (As in the 2 user screenshots) */}
      {isTransfersPageOpen ? (
        <PLTransfersView
          cfg={cfg}
          teams={teams}
          players={players}
          matches={matches}
          allRoundStats={allRoundStats}
          squadIds={squadIds}
          captainId={captainId}
          formation={formation}
          entries={entries}
          editRound={cfg.locked ? cfg.round + 1 : cfg.round}
          baseIds={findBaseSquad(entries[userId]?.rounds, cfg.locked ? cfg.round + 1 : cfg.round)}
          activeChip={activeChip}
          chipsUsed={{
            wildcard: chipUsedRound(entries[userId]?.rounds, 'wildcard', cfg.locked ? cfg.round + 1 : cfg.round),
            freehit: chipUsedRound(entries[userId]?.rounds, 'freehit', cfg.locked ? cfg.round + 1 : cfg.round),
          }}
          onChipChange={(c) => {
            setActiveChip(c);
            setIsDraftDirty(true);
          }}
          onBack={() => setIsTransfersPageOpen(false)}
          onSelectPlayerToReplace={(pid) => {
            setPlayerToReplaceId(pid);
            const p = players[pid];
            setPickerTargetPos(p ? p.pos : 'ALL');
            setIsPickerOpen(true);
          }}
          onRemovePlayer={handleRemovePlayer}
          onOpenAddPlayerModal={(pos) => {
            setPlayerToReplaceId(null);
            setPickerTargetPos(pos || 'ALL');
            setIsPickerOpen(true);
          }}
          onConfirmTransfers={() => {
            handleSaveSquad();
            setIsTransfersPageOpen(false);
          }}
        />
      ) : isStandingsOpen ? (
        <PLStandingsView
          entries={entries}
          players={players}
          cfg={cfg}
          allRoundStats={allRoundStats}
          currentUserId={userId}
          onBack={() => setIsStandingsOpen(false)}
        />
      ) : (
        <>
          {/* Main Container */}
          <div className="max-w-md mx-auto px-3.5 pt-3 space-y-4">
            {/* Top Bar with Tournament Title and Organizer Quick Gear */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-emerald-900/40" dir="rtl">
              <div className="flex items-center gap-2">
                <img src="/crest.png" alt="Tahway League" className="h-12 w-auto shrink-0 drop-shadow-[0_0_8px_rgba(239,187,81,0.35)]" />
                <div>
                  <h1 className="text-sm font-black text-gray-900 dark:text-white font-['Lalezar',sans-serif] leading-tight truncate max-w-[200px] sm:max-w-[260px]">
                    {cfg.name || 'فانتازي الدورات الشعبية'}
                  </h1>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block truncate max-w-[200px]">
                    {cfg.location || 'الساحة الشعبية'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsRulesOpen(true)}
                  className="p-1.5 rounded-xl bg-gray-100 dark:bg-emerald-950/80 hover:bg-gray-200 dark:hover:bg-emerald-900 text-gray-700 dark:text-emerald-300 transition-colors"
                  title="قواعد الفانتازي"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
                {(
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('تسجّل خروج من حسابك؟')) {
                        if (firebaseEnabled) userSignOut();
                        else localSignOut();
                        window.location.replace('/');
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-gray-100 dark:bg-emerald-950/80 hover:bg-gray-200 dark:hover:bg-emerald-900 text-gray-700 dark:text-emerald-300 text-[11px] font-bold transition-colors"
                    title="تسجيل خروج"
                  >
                    خروج
                  </button>
                )}

              </div>
            </div>

            {/* SCREEN 1: LATEST (المباريات والتغطية المباشرة - As in Screenshot 1) */}
            {currentTab === 'latest' && (
              <PLScreenLatest
                matches={matches}
                teams={teams}
                cfg={cfg}
                onNavigateToFantasy={() => setCurrentTab('fantasy')}
                onNavigateToSeason={() => setCurrentTab('season')}
                onSelectMatch={(m) => {
                  setCurrentTab('season');
                }}
              />
            )}

            {/* SCREEN 2: FANTASY (فانتازي الدورة - As in Screenshot 2) */}
            {currentTab === 'fantasy' && (
              <PLScreenFantasy
                cfg={cfg}
                teams={teams}
                players={players}
                entries={entries}
                allRoundStats={allRoundStats}
                currentUserId={userId}
                userName={userName}
                matches={matches}
                squadIds={squadIds}
                captainId={captainId}
                formation={formation}
                isDraftDirty={isDraftDirty}
                onOpenPickTeamModal={() => {
                  setPickerTargetPos('ALL');
                  setIsPickerOpen(true);
                }}
                onOpenTransfersModal={() => {
                  setIsTransfersPageOpen(true);
                }}
                onOpenTransfersPage={() => {
                  setIsTransfersPageOpen(true);
                }}
                onOpenStandings={() => setIsStandingsOpen(true)}
                myStanding={(() => {
                  const st = computeStandings(entries, players, allRoundStats, cfg);
                  const me = st.rows.find((r) => r.entry.id === userId);
                  return me ? { rank: me.rank, total: me.total, participants: st.rows.length } : null;
                })()}
                onSaveSquad={handleSaveSquad}
                onSetCaptain={handleSetCaptain}
                onRemovePlayer={handleRemovePlayer}
                onSlotClick={(pos) => {
                  setPickerTargetPos(pos);
                  setIsPickerOpen(true);
                }}
                onNavigateToMatches={() => setCurrentTab('season')}
              />
            )}

            {/* SCREEN 3: SEASON (جدول المباريات والترتيب والإحصائيات - As in Screenshot 3) */}
            {currentTab === 'season' && (
              <PLScreenSeason
                matches={matches}
                teams={teams}
                players={players}
                cfg={cfg}
                allRoundStats={allRoundStats}
                entries={entries}
                currentUserId={userId}
              />
            )}

          </div>

          {/* Official Premier League App Bottom Navigation with Ads Banner */}
          <PLBottomNav
            currentTab={currentTab}
            onChangeTab={setCurrentTab}
            userName={userName}
            onOpenBookingAdModal={() => setIsBookingAdOpen(true)}
          />
        </>
      )}

      {/* Booking Ad Modal for Sponsors */}
      {isBookingAdOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsBookingAdOpen(false)}
          dir="rtl"
        >
          <div
            className="bg-[#122218] border border-amber-500/50 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 text-white bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 border-b border-white/20 relative">
              <button
                type="button"
                onClick={() => setIsBookingAdOpen(false)}
                className="absolute top-3 left-3 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-1">
                <Megaphone className="w-5 h-5 text-amber-200" />
                <span className="text-xs font-black bg-black/30 text-amber-200 px-2 py-0.5 rounded-full">
                  رعاية وإعلانات الدورة
                </span>
              </div>
              <h3 className="text-xl font-black font-['Lalezar',sans-serif]">
                احجز إعلانك في تطبيق الدورة الشعبية
              </h3>
            </div>

            <div className="p-5 space-y-4 text-emerald-100">
              <p className="text-xs leading-relaxed text-white/90 font-medium">
                اجعل علامتك التجارية، محلك، أو نشاطك التجاري يظهر لآلاف اللاعبين والمتابعين في شريط إعلانات الدورة الرسمي وأسفل جميع شاشات التطبيق.
              </p>

              <div className="space-y-2 bg-[#04100c] p-3 rounded-2xl border border-emerald-900/60 text-xs">
                <div className="font-bold text-amber-300">مزايا الإعلان:</div>
                <ul className="space-y-1 text-emerald-200/90 text-[11px] list-disc list-inside">
                  <li>ظهور في شريط الفوتر الدائم بكل الشاشات</li>
                  <li>رابط مباشر للاتصال وواتساب لمتجرك</li>
                  <li>نسبة وصول تتجاوز 100% من المشاركين</li>
                </ul>
              </div>

              <div className="space-y-2 pt-1">
                <a
                  href={`https://wa.me/201012345678?text=${encodeURIComponent('مرحباً، أود حجز مساحة إعلانية في تطبيق فانتازي الدورة الشعبية')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>تواصل عبر واتساب مع اللجنة المنظمة</span>
                </a>

                <a
                  href="tel:01012345678"
                  className="w-full py-2.5 px-4 bg-white hover:bg-gray-100 text-gray-950 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95"
                >
                  <Phone className="w-4 h-4 text-emerald-700" />
                  <span>اتصال هاتفي مباشر (01012345678)</span>
                </a>
              </div>
            </div>

            <div className="p-3 bg-[#0a140e] border-t border-emerald-900/60 text-center">
              <button
                type="button"
                onClick={() => setIsBookingAdOpen(false)}
                className="text-xs text-emerald-400 hover:underline font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Player Picker / Transfers Drawer Modal */}
      <PlayerPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelectPlayer={handleSelectPlayer}
        targetPos={pickerTargetPos}
        squadIds={squadIds}
        players={players}
        teams={teams}
        cfg={cfg}
        formation={formation}
        allRoundStats={allRoundStats}
        matches={matches}
        entries={entries}
      />

      {/* Rules Modal */}
      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
        budget={cfg.budget}
        maxPerTeam={cfg.maxPerTeam}
        freeTransfers={cfg.freeTransfers}
        transferPenalty={cfg.transferPenalty}
      />

      {/* Registration Modal */}
      <RegistrationModal
        isOpen={isRegistrationOpen}
        onClose={() => setIsRegistrationOpen(false)}
        onRegister={(name, phone) => {
          setUserName(name);
          setUserPhone(phone);
          localStorage.setItem('fantasy_dawra_name', name);
          localStorage.setItem('fantasy_dawra_phone', phone);
          showToast(`أهلاً بك يا كابتن ${name}!`);
        }}
        initialName={userName}
        initialPhone={userPhone}
      />
    </div>
  );
}
