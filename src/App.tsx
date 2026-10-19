import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TournamentConfig,
  Team,
  Player,
  Entry,
  Match,
  Position,
  PlayerMatchStats,
  ChipType,
  TopStoryAd,
} from './types';
import { PLScreenLatest } from './components/PLScreenLatest';
import { PLScreenFantasy } from './components/PLScreenFantasy';
import { PLScreenSeason } from './components/PLScreenSeason';
import { isRoundLocked } from './utils/deadline';
import { BookingState, advanceBooking, bookingDeadlineMs, createBooking, isBookingLocked, makeBookingMatch, undoBooking } from './utils/booking';
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
import { chipUsedRound, effectiveBudget, findBaseSquad } from './utils/transfers';
import { deriveBookingStats, deriveRoundStats } from './utils/deriveStats';
import { RegistrationModal } from './components/RegistrationModal';
import {
  calculateSquadRoundPoints,
  validateSquad,
  isValidFormation,
  parseFormation,
  POSITIONS_SHORT,
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
  const isAdminPath = () =>
    /^\/admin(\/|$)/i.test(window.location.pathname) || /admin/i.test(window.location.hash) || /(^|[?&])admin(=|&|$)/i.test(window.location.search);
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(isAdminPath);
  useEffect(() => {
    const on = () => setIsAdminRoute(isAdminPath());
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  const [isBookingAdOpen, setIsBookingAdOpen] = useState(false);

  // Tournament Data from Server
  const [cfgRaw, setCfg] = useState<TournamentConfig>({
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
  // وضع الحجز عالم منفصل تمامًا عن الوضع الأساسي (زي تابات Fantasy / Challenge في تطبيق الدوري الإنجليزي):
  // المشترك هو اللي يبدّل بين "فانتازي الدورة" و"فانتازي الحجز" وكل واحد له مباريات وإحصائيات وتشكيلة.
  const bookingActive = cfgRaw.mode === 'booking';
  const [viewMode, setViewMode] = useState<'main' | 'booking'>('main');
  const viewRef = useRef<'main' | 'booking'>('main');
  const initialViewDone = useRef(false); // أول تحميل بس: لو الحجز جاهز نفتح فانتازي الحجز علطول
  const isBookingMode = bookingActive && viewMode === 'booking';
  const mainMatches = useMemo(
    () => Object.fromEntries(Object.entries(matches).filter(([, m]) => !m.booking)) as Record<string, Match>,
    [matches]
  );
  const vMatches = useMemo(
    () => (isBookingMode ? (Object.fromEntries(Object.entries(matches).filter(([, m]) => !!m.booking)) as Record<string, Match>) : mainMatches),
    [matches, mainMatches, isBookingMode]
  );
  // الديدلاين التلقائي: الجولة بتتقفل قبل أول ماتش بنص ساعة (أو لو المنظم قفلها يدوي)
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const cfgBase = useMemo<TournamentConfig>(() => ({ ...cfgRaw, locked: isRoundLocked(cfgRaw, mainMatches, nowTick) }), [cfgRaw, mainMatches, nowTick]);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [allRoundStats, setAllRoundStats] = useState<
    Record<number, { p: Record<string, PlayerMatchStats> }>
  >({});

  // إحصائيات لاعبين وضع الحجز (منفصلة عن إحصائيات الجولات)
  const [bookingStats, setBookingStats] = useState<{ p: Record<string, PlayerMatchStats> }>({ p: {} });

  // Current user info
  const [userId, setUserId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userPhone, setUserPhone] = useState<string>('');

  // Draft squad state
  const [squadIds, setSquadIds] = useState<string[]>([]);
  const [captainId, setCaptainId] = useState<string>('');
  const [benchIds, setBenchIds] = useState<string[]>([]);
  const [benchPickPos, setBenchPickPos] = useState<Position | null>(null);
  const [formation, setFormation] = useState<string>('2-2-2');
  const [isDraftDirty, setIsDraftDirty] = useState<boolean>(false);
  const [booking, setBooking] = useState<BookingState | null>(null);

  // ديدلاين تشكيلة الحجز: ربع ساعة قبل أول ماتش في الحجز
  const bookingLocked = isBookingMode && isBookingLocked(booking, matches, nowTick);
  const bookingDl = bookingDeadlineMs(booking);
  const blockIfBookingLocked = () => {
    if (!bookingLocked) return false;
    showToast('🔒 تشكيلة الحجز اتقفلت (قبل أول ماتش بربع ساعة)');
    return true;
  };

  // ===== عدسة الوضع (اللي المشترك بيشوفه) =====
  const bkRound = booking?.round ?? cfgRaw.round;
  const vStats = useMemo<Record<number, { p: Record<string, PlayerMatchStats> }>>(
    () => (isBookingMode ? { [bkRound]: bookingStats } : allRoundStats),
    [isBookingMode, bkRound, bookingStats, allRoundStats]
  );
  const vEntries = useMemo<Record<string, Entry>>(() => {
    if (!isBookingMode) return entries;
    const out: Record<string, Entry> = {};
    for (const [id, e] of Object.entries(entries)) out[id] = { ...e, rounds: e.bk ? { [bkRound]: e.bk } : {} };
    return out;
  }, [isBookingMode, bkRound, entries]);
  // الميزانية الفعلية: لو أسعار لاعبين تشكيلتك زادت، تكلفتها الجديدة هي الحد (زي الفانتازي)
  const cfg = useMemo<TournamentConfig>(() => {
    const c: TournamentConfig = isBookingMode ? { ...cfgBase, round: bkRound, locked: false, autoLock: false } : cfgBase;
    const editR = c.locked ? c.round + 1 : c.round;
    const base = findBaseSquad(vEntries[userId]?.rounds, editR);
    return { ...c, budget: effectiveBudget(c.budget, base, players) };
  }, [cfgBase, isBookingMode, bkRound, vEntries, userId, players]);
  const [topStories, setTopStories] = useState<Record<string, TopStoryAd>>({});

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
      setBookingStats(data.bstats?.p ? data.bstats : { p: {} });
      setBooking(data.booking?.teamIds ? data.booking : null);
      if (data.topStories) setTopStories(data.topStories);

      // أول دخول: لو الحجز جاهز، ادخل على فانتازي الحجز علطول (مش فانتازي الدورة)
      if (!initialViewDone.current) {
        initialViewDone.current = true;
        if (data.cfg?.mode === 'booking' && data.booking?.teamIds && !isAdminPath()) {
          viewRef.current = 'booking';
          setViewMode('booking');
          setCurrentTab('fantasy');
        }
      }

      // Auto-populate user squad if found
      const uid = localStorage.getItem('fantasy_dawra_uid');
      if (uid && data.entries && data.entries[uid]) {
        const uEntry = data.entries[uid];
        setUserName(uEntry.name || localStorage.getItem('fantasy_dawra_name') || '');
        const bkMode = viewRef.current === 'booking' && data.cfg?.mode === 'booking';
        if (bkMode) {
          // وضع الحجز: تشكيلة منفصلة (entry.bk)، من غير كروت
          const sq = uEntry.bk;
          setActiveChip(null);
          if (sq && sq.ids) {
            setSquadIds(sq.ids);
            setBenchIds(sq.bench || []);
            setCaptainId(sq.cap || sq.ids[0] || '');
            setFormation(sq.form || '2-2-2');
          } else {
            setSquadIds([]);
            setBenchIds([]);
            setCaptainId('');
          }
        } else {
          const mainMatches = Object.fromEntries(Object.entries((data.matches || {}) as Record<string, Match>).filter(([, m]) => !m.booking));
          const activeR = isRoundLocked(data.cfg, mainMatches) ? data.cfg.round + 1 : data.cfg.round;
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
            setBenchIds(sq.bench || []);
            setCaptainId(sq.cap || sq.ids[0] || '');
            if (sq.form) setFormation(sq.form);
          } else {
            setSquadIds([]);
            setBenchIds([]);
            setCaptainId('');
          }
        }
      } else {
        // حساب جديد: تشكيلة فاضية، المشترك هو اللي يختار لاعبينه
        setSquadIds([]);
        setBenchIds([]);
        setCaptainId('');
      }
    } catch (err) {
      console.error('Data fetch error:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // تبديل الوجهة (فانتازي الدورة ⇄ فانتازي الحجز): كل وجهة ليها تشكيلتها
  const switchView = (v: 'main' | 'booking') => {
    if (v === viewRef.current) return;
    if (isDraftDirty && !window.confirm('عندك تعديلات مش محفوظة في التشكيلة دي، هتتمسح لو بدّلت. تكمّل؟')) return;
    viewRef.current = v;
    setViewMode(v);
    setIsDraftDirty(false);
    setPlayerToReplaceId(null);
    setIsPickerOpen(false);
    setIsTransfersPageOpen(false);
    setIsStandingsOpen(false);
    fetchData();
  };
  // لو وضع الحجز خلص وإحنا واقفين فيه: نرجع للأساسي
  useEffect(() => {
    if (!bookingActive && viewRef.current === 'booking') {
      viewRef.current = 'main';
      setViewMode('main');
      setIsDraftDirty(false);
      fetchData();
    }
  }, [bookingActive]);

  // ---- التسجيل المباشر للمباراة ----
  const matchesRef = useRef(matches);
  const statsRef = useRef(allRoundStats);
  const bstatsRef = useRef(bookingStats);
  const bookingRef = useRef<BookingState | null>(booking);
  matchesRef.current = matches;
  statsRef.current = allRoundStats;
  bstatsRef.current = bookingStats;
  bookingRef.current = booking;
  const livePending = useRef(0);
  const liveQueue = useRef<Promise<void>>(Promise.resolve());

  const handleLiveUpdate = (matchId: string, fn: (s: LiveState) => LiveState) => {
    const m = matchesRef.current[matchId];
    if (!m) return;
    const isBk = !!m.booking;
    const roundDoc = isBk ? bstatsRef.current : statsRef.current[m.round] || { p: {} };
    const r = fn({ match: m, stats: roundDoc.p || {} });
    let newMatches: Record<string, Match> = { ...matchesRef.current, [matchId]: r.match };

    // وضع الحجز: لما المباراة تخلص الفايز يفضل والمهزوم يطلع ويدخل اللي مستني، وتتعمل المباراة الجاية تلقائيًا
    let newBooking = bookingRef.current;
    if (m.booking && newBooking?.active) {
      if (m.status !== 'finished' && r.match.status === 'finished') {
        const adv = advanceBooking(newBooking, r.match, `m_${Date.now()}`);
        newBooking = adv.booking;
        newMatches[adv.match.id] = adv.match;
        const t = (id: string) => teams[id]?.name || '';
        showToast(`🔁 المباراة الجاية: ${t(adv.match.teamAId)} × ${t(adv.match.teamBId)}`);
      } else if (m.status === 'finished' && r.match.status !== 'finished') {
        const und = undoBooking(newBooking, newMatches, matchId);
        if (!und) {
          showToast('⚠️ مينفعش تعيد فتح المباراة بعد ما اللي بعدها بدأت');
          return;
        }
        newBooking = und.booking;
        newMatches = und.matches;
      }
    }
    const bookingChanged = newBooking !== bookingRef.current;
    if (bookingChanged) {
      bookingRef.current = newBooking;
      setBooking(newBooking);
    }
    matchesRef.current = newMatches;
    setMatches(newMatches);
    if (isBk) {
      // إحصائيات الحجز في مكان منفصل عن إحصائيات الجولات
      const newB = { p: deriveBookingStats(newMatches, players) };
      bstatsRef.current = newB;
      setBookingStats(newB);
    } else {
      const derived = deriveRoundStats(m.round, newMatches, players, r.stats);
      const newStats = { ...statsRef.current, [m.round]: { ...roundDoc, p: derived } };
      statsRef.current = newStats;
      setAllRoundStats(newStats);
    }

    livePending.current++;
    liveQueue.current = liveQueue.current.then(async () => {
      try {
        const res = await fetch('/api/tournament/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify({ matches: matchesRef.current, stats: statsRef.current, bstats: bstatsRef.current, ...(bookingRef.current ? { booking: bookingRef.current } : {}) }),
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
        setBookingStats(data.bstats?.p ? data.bstats : { p: {} });
        if (data.cfg) setCfg(data.cfg);
        setBooking(data.booking?.teamIds ? data.booking : null);
        if (data.topStories) setTopStories(data.topStories);
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
          showToast(`⚠️ تعذر الحفظ على السيرفر${json.detail ? `: ${json.detail}` : ''}`);
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
        setBookingStats(json.data.bstats?.p ? json.data.bstats : { p: {} });
        setBooking(json.data.booking?.teamIds ? json.data.booking : null);
        if (json.data.topStories) setTopStories(json.data.topStories);
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
    if (blockIfBookingLocked()) return;
    const check = validateSquad(squadIds, captainId, players, cfg, formation, benchIds);
    if (!check.isValid) {
      showToast(`⚠️ ${check.errors[0]}`);
      return;
    }
    const activeEditingRound = cfg.locked ? cfg.round + 1 : cfg.round;
    const baseEntry = {
      id: userId,
      name: userName || localStorage.getItem('fantasy_dawra_name') || '',
      ...(userPhone ? { phone: userPhone } : {}),
      joined: entries[userId]?.joined || Date.now(),
    };
    // وضع الحجز: بنحفظ في تشكيلة الحجز المنفصلة (bk) ومنلمسش تشكيلات الجولات
    const updatedUserEntry: Entry = isBookingMode
      ? { ...baseEntry, rounds: {}, bk: { ids: [...squadIds], ...(benchIds.length ? { bench: [...benchIds] } : {}), cap: captainId, form: formation } }
      : {
          ...baseEntry,
          rounds: {
            ...(entries[userId]?.rounds || {}),
            [activeEditingRound]: {
              ids: [...squadIds],
              ...(benchIds.length ? { bench: [...benchIds] } : {}),
              cap: captainId,
              form: formation,
              ...(activeChip ? { chip: activeChip } : {}),
            },
          },
        };

    const success = await syncServerData({ entry: updatedUserEntry });
    if (success) {
      setIsDraftDirty(false);
      showToast(isBookingMode ? '✅ تم حفظ تشكيلة الحجز بنجاح!' : `✅ تم حفظ تشكيلة الجولة ${activeEditingRound} بنجاح!`);
    }
  };

  // المشترك يغيّر اسم فريقه (بيتحفظ على السيرفر من غير ما يلمس التشكيلة)
  const handleRenameTeam = async (newName: string): Promise<boolean> => {
    const name = newName.trim().slice(0, 40);
    if (!name) {
      showToast('⚠️ اكتب اسم الفريق');
      return false;
    }
    if (!userId) {
      showToast('⚠️ سجّل دخول الأول');
      return false;
    }
    const ok = await syncServerData({
      entry: {
        id: userId,
        name,
        ...(userPhone ? { phone: userPhone } : {}),
        joined: entries[userId]?.joined || Date.now(),
        rounds: {},
      },
    });
    if (ok) {
      setUserName(name);
      localStorage.setItem('fantasy_dawra_name', name);
      showToast('✅ تم تغيير اسم الفريق');
    }
    return ok;
  };

  const handleSelectPlayer = (player: Player) => {
    if (blockIfBookingLocked()) return;
    // اختيار لاعب للدكة: بيحل محل لاعب نفس المركز في الدكة (لو موجود)
    if (benchPickPos) {
      if (player.pos !== benchPickPos || squadIds.includes(player.id)) return;
      setBenchIds((prev) => [...prev.filter((id) => players[id]?.pos !== benchPickPos), player.id]);
      setBenchPickPos(null);
      setPlayerToReplaceId(null);
      setIsDraftDirty(true);
      showToast(`✅ تم إضافة ${player.name} للاحتياطي`);
      return;
    }
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
    if (blockIfBookingLocked()) return;
    const nextSquad = squadIds.filter((id) => id !== pid);
    setSquadIds(nextSquad);
    if (captainId === pid) {
      setCaptainId(nextSquad[0] || '');
    }
    setIsDraftDirty(true);
  };

  // تغيير الخطة: لازم عدد اللاعبين الحاليين في كل مركز ميزيدش عن الخطة الجديدة
  const handleFormationChange = (f: string) => {
    if (blockIfBookingLocked()) return;
    if (!isValidFormation(f)) return;
    const need = parseFormation(f);
    const have: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    squadIds.forEach((id) => {
      const p = players[id];
      if (p) have[p.pos] += 1;
    });
    for (const pos of ['DEF', 'MID', 'FWD'] as Position[]) {
      if (have[pos] > need[pos]) {
        showToast(`⚠️ عندك ${have[pos]} ${POSITIONS_SHORT[pos]} والخطة ${f} فيها ${need[pos]} بس. شيل لاعب الأول`);
        return;
      }
    }
    setFormation(f);
    setIsDraftDirty(true);
  };

  const handleRemoveBench = (pid: string) => {
    if (blockIfBookingLocked()) return;
    setBenchIds((prev) => prev.filter((id) => id !== pid));
    setIsDraftDirty(true);
  };

  const handleBenchSlotClick = (pos: Position, replacingId?: string) => {
    if (blockIfBookingLocked()) return;
    setPlayerToReplaceId(replacingId || null);
    setBenchPickPos(pos);
    setPickerTargetPos(pos);
    setIsPickerOpen(true);
  };

  const handleSetCaptain = (pid: string) => {
    if (blockIfBookingLocked()) return;
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
    if (await syncServerData({ matches: updated })) showToast('✅ تم إضافة اللقاء إلى جدول المباريات');
  };

  const handleUpdateMatch = async (id: string, updates: Partial<Match>) => {
    const updated = {
      ...matches,
      [id]: { ...matches[id], ...updates },
    };
    if (await syncServerData({ matches: updated })) showToast('✅ تم تحديث بيانات اللقاء');
  };

  const handleDeleteMatch = async (id: string) => {
    const updated = { ...matches };
    delete updated[id];
    if (await syncServerData({ matches: updated })) showToast('تم حذف اللقاء');
  };

  // وضع الحجز
  const handleStartBooking = async (teamIds: string[], first: string, second: string, startAt?: number): Promise<boolean> => {
    const nb = createBooking(teamIds, first, second, cfg.round, startAt);
    if (typeof nb === 'string') {
      showToast(`⚠️ ${nb}`);
      return false;
    }
    const id = `m_${Date.now()}`;
    nb.currentMatchId = id;
    const ok = await syncServerData({ booking: nb, matches: { ...matches, [id]: makeBookingMatch(nb, id) }, cfg: { ...cfgRaw, mode: 'booking' } });
    if (ok) showToast('✅ بدأ وضع الحجز، المباراة الأولى جاهزة في المباراة المباشرة');
    return ok;
  };

  // إنهاء وضع الحجز: بيرجّع الوضع الأساسي، وبيصفّر كل حاجة في الحجز (المباريات، إجماليات الفرق، ونقاط اللاعبين)
  const handleEndBooking = async () => {
    if (!booking) return;
    const rest = Object.fromEntries(Object.entries(matches).filter(([, m]) => !m.booking)) as Record<string, Match>;
    const ok = await syncServerData({
      booking: { active: false },
      matches: rest,
      bstats: { p: {} },
      cfg: { ...cfgRaw, mode: 'tournament' },
    });
    if (ok) showToast('تم إنهاء وضع الحجز وتصفير الإجماليات والنقاط');
  };

  const handleSaveTopStories = async (next: Record<string, TopStoryAd>): Promise<boolean> => {
    const ok = await syncServerData({ topStories: next });
    if (ok) showToast('✅ تم حفظ الإعلانات');
    return ok;
  };

  // Admin CRUD
  const handleUpdateConfig = async (newCfg: TournamentConfig) => {
    if (await syncServerData({ cfg: newCfg })) showToast('✅ تم حفظ إعدادات الدورة');
  };

  const handleAddTeam = async (newTeam: Omit<Team, 'id'>) => {
    const id = `t_${Date.now()}`;
    const updatedTeams = {
      ...teams,
      [id]: { ...newTeam, id },
    };
    if (await syncServerData({ teams: updatedTeams })) showToast(`✅ تم إضافة فريق ${newTeam.name}`);
  };

  const handleUpdateTeam = async (id: string, updates: Partial<Team>) => {
    const updated = {
      ...teams,
      [id]: { ...teams[id], ...updates },
    };
    if (await syncServerData({ teams: updated })) showToast('✅ تم تحديث بيانات الفريق');
  };

  const handleDeleteTeam = async (id: string) => {
    const updated = { ...teams };
    delete updated[id];
    if (await syncServerData({ teams: updated })) showToast('تم حذف الفريق');
  };

  const handleAddPlayer = async (newP: Omit<Player, 'id'>) => {
    const id = `p_${Date.now()}`;
    const updated = {
      ...players,
      [id]: { ...newP, id },
    };
    if (await syncServerData({ players: updated })) showToast(`✅ تم إضافة ${newP.name}`);
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
      if (await syncServerData({ players: updated })) showToast(`✅ تم استيراد ${addedCount} لاعباً بنجاح!`);
    }
  };

  // تعديل بيانات لاعب (الاسم / الفريق / المركز / السعر / الرقم) - للمنظم
  const handleUpdatePlayer = async (id: string, updates: Partial<Player>) => {
    if (!players[id]) return;
    const updated = { ...players, [id]: { ...players[id], ...updates, id } };
    if (await syncServerData({ players: updated })) showToast('✅ تم تعديل بيانات اللاعب');
  };

  const handleDeletePlayer = async (id: string) => {
    const updated = { ...players };
    delete updated[id];
    if (await syncServerData({ players: updated })) showToast('تم حذف اللاعب');
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
            topStories={topStories}
            onSaveTopStories={handleSaveTopStories}
            booking={booking}
            onStartBooking={handleStartBooking}
            onEndBooking={handleEndBooking}
            entries={entries}
            cfg={cfgRaw}
            teams={teams}
            players={players}
            matches={matches}
            allRoundStats={allRoundStats}
            bookingStats={bookingStats}
            onUpdateConfig={handleUpdateConfig}
            onAddTeam={handleAddTeam}
            onUpdateTeam={handleUpdateTeam}
            onDeleteTeam={handleDeleteTeam}
            onAddPlayer={handleAddPlayer}
            onBulkAddPlayers={handleBulkAddPlayers}
            onDeletePlayer={handleDeletePlayer}
            onUpdatePlayer={handleUpdatePlayer}
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
          matches={vMatches}
          allRoundStats={vStats}
          squadIds={squadIds}
          benchIds={benchIds}
          captainId={captainId}
          formation={formation}
          entries={vEntries}
          editRound={cfg.locked ? cfg.round + 1 : cfg.round}
          baseIds={findBaseSquad(vEntries[userId]?.rounds, cfg.locked ? cfg.round + 1 : cfg.round)}
          activeChip={activeChip}
          chipsUsed={{
            wildcard: chipUsedRound(vEntries[userId]?.rounds, 'wildcard', cfg.locked ? cfg.round + 1 : cfg.round),
            freehit: chipUsedRound(vEntries[userId]?.rounds, 'freehit', cfg.locked ? cfg.round + 1 : cfg.round),
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
          entries={vEntries}
          players={players}
          cfg={cfg}
          allRoundStats={vStats}
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
                cfg={cfgBase}
                topStories={topStories}
                onOpenAdBooking={cfgBase.adsWhatsapp || cfgBase.adsPhone ? () => setIsBookingAdOpen(true) : undefined}
                onNavigateToFantasy={() => setCurrentTab('fantasy')}
                onNavigateToSeason={() => setCurrentTab('season')}
                onSelectMatch={(m) => {
                  setCurrentTab('season');
                }}
              />
            )}

            {/* SCREEN 2: FANTASY (فانتازي الدورة - As in Screenshot 2) */}
            {currentTab === 'fantasy' && bookingActive && (
              <div className="flex p-1 mb-3 rounded-2xl bg-gray-200/80 dark:bg-emerald-950/80 border border-emerald-900/30" dir="rtl">
                {([
                  ['main', '🏆 فانتازي الدورة'],
                  ['booking', '⚽ فانتازي الحجز'],
                ] as const).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => switchView(k)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${
                      viewMode === k ? 'bg-white text-emerald-900 shadow' : 'text-gray-600 dark:text-emerald-300 hover:text-emerald-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {currentTab === 'fantasy' && (
              <PLScreenFantasy
                cfg={cfg}
                teams={teams}
                players={players}
                entries={vEntries}
                allRoundStats={vStats}
                currentUserId={userId}
                userName={userName}
                matches={vMatches}
                squadIds={squadIds}
                benchIds={benchIds}
                onBenchSlotClick={handleBenchSlotClick}
                onFormationChange={handleFormationChange}
                onRemoveBench={handleRemoveBench}
                captainId={captainId}
                formation={formation}
                isDraftDirty={isDraftDirty}
                onOpenPickTeamModal={() => {
                  if (blockIfBookingLocked()) return;
                  setPlayerToReplaceId(null);
                  setPickerTargetPos('ALL');
                  setIsPickerOpen(true);
                }}
                onOpenTransfersModal={() => {
                  if (blockIfBookingLocked()) return;
                  setIsTransfersPageOpen(true);
                }}
                onOpenTransfersPage={() => {
                  if (blockIfBookingLocked()) return;
                  setIsTransfersPageOpen(true);
                }}
                onOpenStandings={() => setIsStandingsOpen(true)}
                myStanding={(() => {
                  const st = computeStandings(vEntries, players, vStats, cfg);
                  const me = st.rows.find((r) => r.entry.id === userId);
                  return me ? { rank: me.rank, total: me.total, participants: st.rows.length } : null;
                })()}
                onSaveSquad={handleSaveSquad}
                onSetCaptain={handleSetCaptain}
                onRemovePlayer={handleRemovePlayer}
                onReplacePlayer={(pid) => {
                  if (blockIfBookingLocked()) return;
                  setPlayerToReplaceId(pid);
                  setPickerTargetPos(players[pid]?.pos || 'ALL');
                  setIsPickerOpen(true);
                }}
                onSlotClick={(pos) => {
                  if (blockIfBookingLocked()) return;
                  setPlayerToReplaceId(null);
                  setPickerTargetPos(pos);
                  setIsPickerOpen(true);
                }}
                onNavigateToMatches={() => setCurrentTab('season')}
                onRenameTeam={handleRenameTeam}
                bookingMode={isBookingMode}
                bookingLocked={bookingLocked}
                bookingDeadline={bookingDl}
              />
            )}

            {/* SCREEN 3: SEASON (جدول المباريات والترتيب والإحصائيات - As in Screenshot 3) */}
            {currentTab === 'season' && (
              <PLScreenSeason
                matches={matches}
                teams={teams}
                players={players}
                cfg={cfgBase}
                allRoundStats={allRoundStats}
                entries={entries}
                currentUserId={userId}
                booking={booking}
              />
            )}

          </div>

          {/* Official Premier League App Bottom Navigation with Ads Banner */}
          <PLBottomNav
            currentTab={currentTab}
            onChangeTab={setCurrentTab}
            userName={userName}
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
                {cfg.adsWhatsapp && (
                <a
                  href={`https://wa.me/${cfg.adsWhatsapp}?text=${encodeURIComponent('مرحباً، أود حجز مساحة إعلانية في تطبيق فانتازي الدورة الشعبية')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>تواصل عبر واتساب مع اللجنة المنظمة</span>
                </a>
                )}

                {cfg.adsPhone && (
                <a
                  href={`tel:${cfg.adsPhone}`}
                  className="w-full py-2.5 px-4 bg-white hover:bg-gray-100 text-gray-950 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95"
                >
                  <Phone className="w-4 h-4 text-emerald-700" />
                  <span>اتصال هاتفي مباشر ({cfg.adsPhone})</span>
                </a>
                )}
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
        onClose={() => {
          setIsPickerOpen(false);
          setPlayerToReplaceId(null);
          setBenchPickPos(null);
        }}
        replacingId={playerToReplaceId}
        benchIds={benchIds}
        benchMode={!!benchPickPos}
        onSelectPlayer={handleSelectPlayer}
        targetPos={pickerTargetPos}
        squadIds={squadIds}
        players={players}
        teams={teams}
        cfg={cfg}
        formation={formation}
        allRoundStats={vStats}
        matches={vMatches}
        entries={vEntries}
      />

      {/* Rules Modal */}
      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
        budget={cfgBase.budget}
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
