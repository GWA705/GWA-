import { describe, it, expect } from 'vitest';
import {
  reminderDecision,
  awaitingDealer,
  DEFAULT_REMINDER_CONFIG,
  type ReminderConfig,
} from '@/lib/reminders';

// A UTC-based config makes the local hour equal to the UTC hour, so tests can
// place `now` at an exact hour without wrestling with DST.
const cfg: ReminderConfig = { ...DEFAULT_REMINDER_CONFIG, timezone: 'UTC' };

// now at a chosen UTC hour, awaitingSince = now minus ageHours.
function scenario(nowIso: string, ageHours: number, extra: { sentToday?: number; lastAgoHours?: number } = {}) {
  const now = new Date(nowIso);
  const awaitingSince = new Date(now.getTime() - ageHours * 3_600_000);
  const lastReminderAt =
    extra.lastAgoHours != null ? new Date(now.getTime() - extra.lastAgoHours * 3_600_000) : null;
  return reminderDecision({ now, awaitingSince, lastReminderAt, sentToday: extra.sentToday ?? 0, cfg });
}

describe('awaitingDealer predicate', () => {
  it('is true for the dealer-court statuses', () => {
    expect(awaitingDealer({ status: 'APPROVED' })).toBe(true);
    expect(awaitingDealer({ status: 'CONDITIONAL' })).toBe(true);
    expect(awaitingDealer({ status: 'PROBLEM' })).toBe(true);
  });
  it('is false for reviewer-court / terminal statuses', () => {
    for (const s of ['SUBMITTED', 'UNDER_REVIEW', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED', 'DECLINED', 'WITHDRAWN', 'DRAFT'] as const) {
      expect(awaitingDealer({ status: s })).toBe(false);
    }
  });
});

describe('reminder cadence', () => {
  it('sends nothing during the first-day grace period', () => {
    expect(scenario('2026-03-10T09:00:00Z', 10).due).toBe(false); // 10h old
    expect(scenario('2026-03-10T09:00:00Z', 23).reason).toBe('grace');
  });

  it('does not send outside 8am–9pm', () => {
    expect(scenario('2026-03-10T06:00:00Z', 30).reason).toBe('quiet-hours'); // 6am
    expect(scenario('2026-03-10T21:00:00Z', 30).reason).toBe('quiet-hours'); // 9pm (exclusive)
    expect(scenario('2026-03-10T22:00:00Z', 30).due).toBe(false);
  });

  it('sends twice on day 1 — a morning and an afternoon', () => {
    // Morning: sentToday 0, hour 9.
    const morning = scenario('2026-03-10T09:00:00Z', 25, { sentToday: 0 });
    expect(morning.due).toBe(true);
    expect(morning.reason).toBe('morning');
    expect(morning.dayNumber).toBe(1);
    expect(morning.priority).toBe(false);

    // Afternoon: sentToday 1, hour 16 (>=15).
    const pm = scenario('2026-03-10T16:00:00Z', 25, { sentToday: 1 });
    expect(pm.due).toBe(true);
    expect(pm.reason).toBe('afternoon');

    // The afternoon send holds until ~3pm.
    expect(scenario('2026-03-10T10:00:00Z', 25, { sentToday: 1 }).due).toBe(false);

    // Never a third on day 1.
    expect(scenario('2026-03-10T18:00:00Z', 25, { sentToday: 2 }).due).toBe(false);
  });

  it('sends once on day 2', () => {
    const d2 = scenario('2026-03-10T09:00:00Z', 49, { sentToday: 0 });
    expect(d2.due).toBe(true);
    expect(d2.dayNumber).toBe(2);
    // Only one on day 2.
    expect(scenario('2026-03-10T16:00:00Z', 49, { sentToday: 1 }).due).toBe(false);
  });

  it('sends every other day on days 3 and 5, skipping day 4', () => {
    expect(scenario('2026-03-10T09:00:00Z', 73, { sentToday: 0 }).due).toBe(true); // day 3
    expect(scenario('2026-03-10T09:00:00Z', 97, { sentToday: 0 }).due).toBe(false); // day 4
    expect(scenario('2026-03-10T09:00:00Z', 97, { sentToday: 0 }).reason).toBe('not-send-day');
    expect(scenario('2026-03-10T09:00:00Z', 121, { sentToday: 0 }).due).toBe(true); // day 5
  });

  it('after 5 days sends about twice a week as a priority message', () => {
    // Day 7, last reminder 4 days (96h) ago → past the 84h gap.
    const wk = scenario('2026-03-10T09:00:00Z', 24 * 7 + 1, { sentToday: 0, lastAgoHours: 96 });
    expect(wk.due).toBe(true);
    expect(wk.priority).toBe(true);
    expect(wk.phase).toBe('weekly');

    // Too soon since the last one → hold.
    const soon = scenario('2026-03-10T09:00:00Z', 24 * 7 + 1, { sentToday: 0, lastAgoHours: 20 });
    expect(soon.due).toBe(false);
    expect(soon.reason).toBe('within-weekly-gap');
  });

  it('never exceeds the per-day cap', () => {
    expect(scenario('2026-03-10T16:00:00Z', 25, { sentToday: 2 }).reason).toBe('daily-cap');
  });

  it('sends nothing when disabled', () => {
    const off = reminderDecision({
      now: new Date('2026-03-10T09:00:00Z'),
      awaitingSince: new Date('2026-03-08T09:00:00Z'),
      lastReminderAt: null,
      sentToday: 0,
      cfg: { ...cfg, enabled: false },
    });
    expect(off.due).toBe(false);
    expect(off.reason).toBe('disabled');
  });
});
