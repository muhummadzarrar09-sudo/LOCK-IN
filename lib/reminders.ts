/**
 * Reminders layer (client-side)
 * -----------------------------
 * This module wraps the browser Notifications API for in-session reminders.
 * Persistence is via localStorage so user preferences survive reloads.
 *
 * Production-grade push notifications would require:
 *   1. A service worker
 *   2. VAPID keys + push subscription
 *   3. A server-side cron / queue
 * For demo purposes (and for the "did the user see this" question),
 * client-side scheduling via setTimeout is the right move.
 */

export type ReminderType = 'check_in' | 'new_report' | 'team_update' | 'daily_start';

export type ReminderPrefs = {
  enabled: boolean;        // master toggle
  permission: NotificationPermission; // browser permission
  checkIn: boolean;        // notify when a time block starts
  dailyStart: boolean;     // notify at the start of the day
  newReport: boolean;      // notify when admin posts a report
  teamUpdate: boolean;     // notify when team posts an update
  minutesBefore: number;   // minutes before block start
};

const STORAGE_KEY = 'discipline.reminderPrefs.v1';

export const DEFAULT_PREFS: ReminderPrefs = {
  enabled: true,
  permission: 'default',
  checkIn: true,
  dailyStart: true,
  newReport: true,
  teamUpdate: true,
  minutesBefore: 5,
};

export function loadPrefs(): ReminderPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFS, ...parsed, permission: typeof Notification !== 'undefined' ? Notification.permission : 'default' };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: ReminderPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function notify(title: string, body: string, tag?: string): void {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, tag, icon: '/icon-192.png', badge: '/icon-192.png' });
  } catch {
    // ignore — some browsers throw on missing service worker
  }
}

type Block = { start: string; end: string; label: string; block_type: string };
type Timers = { [k: string]: ReturnType<typeof setTimeout> };

const activeTimers: Timers = {};

/** Schedule a notification for a time block (reschedule on cancel). */
export function scheduleBlockReminder(block: Block, prefs: ReminderPrefs): void {
  if (typeof window === 'undefined') return;
  if (!prefs.enabled || !prefs.checkIn) return;
  cancelBlockReminder(block.label);
  if (Notification.permission !== 'granted') return;

  const [hh, mm] = block.start.split(':').map(Number);
  const blockStart = new Date();
  blockStart.setHours(hh || 0, mm || 0, 0, 0);
  const fireAt = new Date(blockStart.getTime() - prefs.minutesBefore * 60_000);
  const ms = fireAt.getTime() - Date.now();
  if (ms <= 0) return; // already past

  const id = setTimeout(() => {
    notify(
      `Time block starting${prefs.minutesBefore > 0 ? ` in ${prefs.minutesBefore}m` : ''}`,
      `${block.label} · ${block.start}–${block.end}`,
      `block-${block.label}`,
    );
    delete activeTimers[block.label];
  }, ms);
  activeTimers[block.label] = id;
}

export function cancelBlockReminder(label: string): void {
  const id = activeTimers[label];
  if (id) {
    clearTimeout(id);
    delete activeTimers[label];
  }
}

export function scheduleAllBlockReminders(blocks: Block[], prefs: ReminderPrefs): void {
  blocks.forEach(b => scheduleBlockReminder(b, prefs));
}

export function cancelAllBlockReminders(): void {
  Object.keys(activeTimers).forEach(cancelBlockReminder);
}

/** Schedule a single daily-start reminder for the user's earliest block. */
export function scheduleDailyStart(blocks: Block[], prefs: ReminderPrefs): void {
  if (typeof window === 'undefined') return;
  if (!prefs.enabled || !prefs.dailyStart) return;
  if (blocks.length === 0) return;
  if (Notification.permission !== 'granted') return;

  const earliest = [...blocks].sort((a, b) => a.start.localeCompare(b.start))[0];
  if (!earliest) return;
  cancelBlockReminder('__daily_start__');
  const [hh, mm] = earliest.start.split(':').map(Number);
  const dayStart = new Date();
  dayStart.setHours(hh || 0, mm || 0, 0, 0);
  const ms = dayStart.getTime() - Date.now();
  if (ms <= 0) return;

  const id = setTimeout(() => {
    notify('Day 1 of the cohort', `Your first block — ${earliest.label} — starts now. Let's go.`, '__daily_start__');
    delete activeTimers['__daily_start__'];
  }, ms);
  activeTimers['__daily_start__'] = id;
}

// ─── Server sync (Supabase) ──────────────────────────────────────────────
// Persist reminder prefs to profiles.reminder_prefs (JSONB) so they follow
// the user across devices. Falls back gracefully if the column doesn't exist.

import { supabase } from './supabase';

const SYNC_FIELDS: (keyof ReminderPrefs)[] = [
  'enabled', 'checkIn', 'dailyStart', 'newReport', 'teamUpdate', 'minutesBefore',
];

/** Strip browser-only fields before sending to the server. */
function toServerPayload(p: ReminderPrefs) {
  const out: Record<string, any> = {};
  SYNC_FIELDS.forEach((k) => { out[k] = p[k]; });
  return out;
}

/** Merge server payload into the runtime prefs (preserving local-only fields). */
function fromServerPayload(server: Record<string, any> | null | undefined): Partial<ReminderPrefs> {
  if (!server) return {};
  return {
    enabled: !!server.enabled,
    checkIn: server.checkIn !== false,
    dailyStart: server.dailyStart !== false,
    newReport: server.newReport !== false,
    teamUpdate: server.teamUpdate !== false,
    minutesBefore: typeof server.minutesBefore === 'number' ? server.minutesBefore : 5,
  };
}

export async function syncPrefsToServer(prefs: ReminderPrefs): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    const { error } = await supabase
      .from('profiles')
      .update({ reminder_prefs: toServerPayload(prefs) } as any)
      .eq('id', session.user.id);
    return !error;
  } catch {
    return false;
  }
}

export async function syncPrefsFromServer(): Promise<Partial<ReminderPrefs> | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('reminder_prefs')
      .eq('id', session.user.id)
      .maybeSingle();
    if (error || !data) return null;
    return fromServerPayload((data as any).reminder_prefs);
  } catch {
    return null;
  }
}
