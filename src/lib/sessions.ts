// ============================================================
// TRADING SESSION TRACKER
// Defines the 4 major forex sessions in UTC, with overlap detection,
// countdown to next session, and currency activity mapping.
// ============================================================

export type SessionName = 'Sydney' | 'Tokyo' | 'London' | 'New York';

export interface SessionInfo {
  name: SessionName;
  openHour: number;   // UTC
  closeHour: number;  // UTC
  currencies: string[];
  color: string;
  bgColor: string;
  borderColor: string;
}

export interface SessionStatus extends SessionInfo {
  isOpen: boolean;
  minutesUntilOpen: number;   // 0 if open
  minutesUntilClose: number;  // 0 if closed
  hoursOpen: number;          // hours session has been open (0 if closed)
  progressPct: number;        // 0–100 how far through the session
}

export interface OverlapInfo {
  sessions: SessionName[];
  label: string;
  description: string;
  volatility: 'highest' | 'high' | 'moderate' | 'low';
}

// ─────────────────────────────────────────────────────────────
// SESSION DEFINITIONS (all times in UTC)
// ─────────────────────────────────────────────────────────────
export const SESSIONS: SessionInfo[] = [
  {
    name: 'Sydney',
    openHour: 21,   // 21:00 UTC (prev day) — displayed as 9pm–6am UTC
    closeHour: 6,
    currencies: ['AUD', 'NZD'],
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/15',
    borderColor: 'border-teal-500/30',
  },
  {
    name: 'Tokyo',
    openHour: 0,    // 00:00 UTC — midnight to 9am
    closeHour: 9,
    currencies: ['JPY', 'AUD', 'NZD'],
    color: 'text-red-400',
    bgColor: 'bg-red-500/15',
    borderColor: 'border-red-500/30',
  },
  {
    name: 'London',
    openHour: 7,    // 07:00 UTC — highest volume session
    closeHour: 16,
    currencies: ['EUR', 'GBP', 'CHF'],
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/15',
    borderColor: 'border-sky-500/30',
  },
  {
    name: 'New York',
    openHour: 12,   // 12:00 UTC
    closeHour: 21,
    currencies: ['USD', 'CAD'],
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
    borderColor: 'border-amber-500/30',
  },
];

// ─────────────────────────────────────────────────────────────
// IS A SESSION OPEN RIGHT NOW?
// Sydney wraps midnight (21:00–06:00), others are within the same day
// ─────────────────────────────────────────────────────────────
function isSessionOpen(session: SessionInfo, utcHour: number): boolean {
  if (session.openHour < session.closeHour) {
    // Normal (same day): e.g. Tokyo 0–9, London 7–16, NY 12–21
    return utcHour >= session.openHour && utcHour < session.closeHour;
  } else {
    // Wraps midnight: Sydney 21–6
    return utcHour >= session.openHour || utcHour < session.closeHour;
  }
}

// ─────────────────────────────────────────────────────────────
// GET FULL SESSION STATUS
// ─────────────────────────────────────────────────────────────
export function getAllSessionStatuses(): SessionStatus[] {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const totalMinutesUTC = utcHour * 60 + utcMinutes;

  return SESSIONS.map(session => {
    const open = isSessionOpen(session, utcHour);
    const openMin = session.openHour * 60;
    const closeMin = session.closeHour * 60;

    let minutesUntilOpen = 0;
    let minutesUntilClose = 0;
    let progressPct = 0;
    let hoursOpen = 0;

    if (open) {
      // How long until close?
      if (session.openHour < session.closeHour) {
        minutesUntilClose = closeMin - totalMinutesUTC;
        const duration = closeMin - openMin;
        hoursOpen = (totalMinutesUTC - openMin) / 60;
        progressPct = ((totalMinutesUTC - openMin) / duration) * 100;
      } else {
        // Wraps midnight
        const durationWrapped = (24 * 60 - openMin) + closeMin;
        const elapsed = totalMinutesUTC >= openMin
          ? totalMinutesUTC - openMin
          : (24 * 60 - openMin) + totalMinutesUTC;
        minutesUntilClose = durationWrapped - elapsed;
        hoursOpen = elapsed / 60;
        progressPct = (elapsed / durationWrapped) * 100;
      }
    } else {
      // Minutes until open
      if (totalMinutesUTC < openMin) {
        minutesUntilOpen = openMin - totalMinutesUTC;
      } else {
        minutesUntilOpen = (24 * 60 - totalMinutesUTC) + openMin;
      }
    }

    return {
      ...session,
      isOpen: open,
      minutesUntilOpen: Math.round(minutesUntilOpen),
      minutesUntilClose: Math.round(minutesUntilClose),
      hoursOpen: Math.round(hoursOpen * 10) / 10,
      progressPct: Math.min(100, Math.max(0, Math.round(progressPct))),
    };
  });
}

// ─────────────────────────────────────────────────────────────
// GET CURRENT OVERLAPS
// ─────────────────────────────────────────────────────────────
export function getCurrentOverlap(): OverlapInfo | null {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const open = SESSIONS.filter(s => isSessionOpen(s, utcHour)).map(s => s.name);

  if (open.includes('London') && open.includes('New York')) {
    return {
      sessions: ['London', 'New York'],
      label: 'London–NY Overlap',
      description: 'Highest liquidity window (12:00–16:00 UTC). Best for EUR, GBP, USD pairs.',
      volatility: 'highest',
    };
  }
  if (open.includes('Tokyo') && open.includes('London')) {
    return {
      sessions: ['Tokyo', 'London'],
      label: 'Tokyo–London Overlap',
      description: 'Moderate volume (07:00–09:00 UTC). EUR/JPY and GBP/JPY most active.',
      volatility: 'moderate',
    };
  }
  if (open.includes('Sydney') && open.includes('Tokyo')) {
    return {
      sessions: ['Sydney', 'Tokyo'],
      label: 'Sydney–Tokyo Overlap',
      description: 'Low-moderate volume (00:00–06:00 UTC). AUD, NZD, JPY pairs most active.',
      volatility: 'low',
    };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// VOLATILITY LABEL
// ─────────────────────────────────────────────────────────────
export function getSessionVolatility(statuses: SessionStatus[]): {
  label: string;
  color: string;
  openCount: number;
} {
  const openSessions = statuses.filter(s => s.isOpen);
  const overlap = getCurrentOverlap();

  if (overlap?.volatility === 'highest') {
    return { label: 'Peak Volatility', color: 'text-rose-400', openCount: openSessions.length };
  }
  if (openSessions.length >= 2) {
    return { label: 'High Activity', color: 'text-amber-400', openCount: openSessions.length };
  }
  if (openSessions.length === 1) {
    return { label: `${openSessions[0].name} Session`, color: 'text-sky-400', openCount: 1 };
  }
  return { label: 'Low Activity', color: 'text-slate-500', openCount: 0 };
}

// ─────────────────────────────────────────────────────────────
// FORMAT COUNTDOWN
// ─────────────────────────────────────────────────────────────
export function formatCountdown(minutes: number): string {
  if (minutes <= 0) return 'Now';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
