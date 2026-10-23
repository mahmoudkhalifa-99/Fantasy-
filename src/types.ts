export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

export type KitPattern = 'plain' | 'stripes' | 'hoops' | 'halves';

export interface Team {
  id: string;
  name: string;
  c1: string; // primary jersey color
  c2: string; // secondary jersey color
  pat: KitPattern;
  kitUrl?: string;
  demo?: boolean;
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  pos: Position;
  price: number;
  num?: number | null;
  demo?: boolean;
}

export interface PlayerMatchStats {
  pl?: number; // played (1 or 0)
  g?: number;  // goals
  a?: number;  // assists
  yc?: number; // yellow cards (max 2)
  rc?: number; // red card (1 or 0)
  og?: number; // own goal
  pm?: number; // penalty missed
  ps?: number; // penalty saved (GK only)
  tk?: number; // قطع كرات (مدافع بس)
  cs?: number; // clean sheet
  mo?: number; // man of the match
}

export interface RoundStatsDoc {
  p: Record<string, PlayerMatchStats>;
}

export type ChipType = 'wildcard' | 'freehit';

export interface SquadSelection {
  ids: string[];
  bench?: string[]; // الدكة الاحتياطي: مدافع + وسط + مهاجم (اختيارية)
  cap: string;
  vice?: string; // نائب الكابتن: لو الكابتن مالعبش، نقاطه x2 بتروح للنائب لو لعب
  form?: string; // e.g. "2-2-2", "3-2-1"
  chip?: ChipType; // كارت اتلعب في الجولة دي (السيرفر هو اللي بيحدده)
  tc?: number; // عدد التحويلات اللي اتعملت في الجولة (السيرفر)
  pen?: number; // النقاط المخصومة بسبب التحويلات الزايدة (السيرفر)
  auto?: boolean; // نسخة تلقائية بعد Free Hit (رجوع للتشكيلة القديمة)
}

export interface Entry {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  rounds: Record<number, SquadSelection>;
  bk?: SquadSelection; // تشكيلة وضع الحجز (منفصلة عن تشكيلات الجولات)
  bkNext?: SquadSelection; // تجهيز تشكيلة الحجز الجاي (بيتحفظ بعد ما الحجز يخلص، من غير ما يغيّر نقاط الحجز اللي خلص)
  joined: number;
}

export interface TournamentConfig {
  name: string;
  budget: number;
  maxPerTeam: number;
  mode?: 'tournament' | 'booking';
  adsWhatsapp?: string; // رقم واتساب لحجز الإعلانات (بكود الدولة)
  adsPhone?: string;
  autoLock?: boolean; // قفل تلقائي قبل أول ماتش (الافتراضي شغال)
  deadlineMinutes?: number; // دقايق القفل قبل أول ماتش (الافتراضي 30)
  round: number;
  locked: boolean;
  location?: string;
  freeTransfers?: number; // تحويلات مجانية كل جولة (الافتراضي 1)
  transferPenalty?: number; // خصم كل تحويل زيادة (الافتراضي 4 نقاط)
}

export type MatchEventType = 'goal' | 'og' | 'assist' | 'yc' | 'rc' | 'pm' | 'ps' | 'tk';

export interface MatchEvent {
  id: string;
  type: MatchEventType;
  playerId: string;
  side?: 'A' | 'B'; // الفريق اللي اتحسبله الهدف (للأهداف والأهداف العكسية)
  ts: number;
}

export interface Match {
  id: string;
  round: number;
  teamAId: string;
  teamBId: string;
  scoreA?: number | null;
  scoreB?: number | null;
  date?: string;
  time?: string;
  pitch?: string;
  status: 'upcoming' | 'live' | 'finished';
  scorersA?: string[];
  scorersB?: string[];
  motm?: string;
  motmId?: string;
  notes?: string;
  startedAt?: number;
  events?: MatchEvent[];
  playedA?: string[]; // مين لعب من فريق أ (لو فاضية واتخلص الماتش: كل الفريق)
  playedB?: string[];
  booking?: boolean; // مباراة من وضع الحجز
  stayerId?: string; // لو التعادل في الحجز: الفريق اللي كمّل
  createdAt?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  thinking?: string;
  timestamp: number;
  persona?: 'tactical' | 'scout' | 'commentator';
  modelUsed?: string;
  imageUrl?: string;
}

export interface SponsorAd {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  phone?: string;
  whatsapp?: string;
  actionText?: string;
  bgGradient?: string;
  icon?: string;
}

export interface TopStoryAd {
  id: string;
  title: string;
  subtitle?: string;
  tag?: string;
  iconText?: string;
  colorGradient?: string;
  innerBg?: string;
  actionType: 'live' | 'season' | 'fantasy' | 'modal' | 'link';
  detailsText?: string;
  phone?: string;
  whatsapp?: string;
  linkUrl?: string;
  active: boolean;
}
