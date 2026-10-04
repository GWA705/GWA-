/**
 * Canonical dashboard-hero time slots, shared by the server resolver and the
 * client HeroBackdrop so they never disagree about which hero shows when.
 * Each slot starts at `hour` and runs until the next slot's hour; the last wraps
 * overnight to the first (23 → 5). `night` marks the slots a NIGHT-scoped special
 * occasion takes over. (Safe to import on the client — no server-only code.)
 */
export interface HeroSlot {
  hour: number;
  label: string;
  night?: boolean;
}

export const HERO_SLOTS: HeroSlot[] = [
  { hour: 5, label: 'Morning' },
  { hour: 12, label: 'Midday' },
  { hour: 15, label: 'Afternoon' },
  { hour: 17, label: 'Early evening' },
  { hour: 19, label: 'Evening', night: true },
  { hour: 21, label: 'Dusk', night: true },
  { hour: 23, label: 'Night', night: true },
];

export const HERO_SLOT_HOURS: number[] = HERO_SLOTS.map((s) => s.hour);

/** Start hour of the slot a given clock hour falls in (before the first slot → the last, overnight). */
export function slotForHour(hour: number): number {
  let start = HERO_SLOT_HOURS[HERO_SLOT_HOURS.length - 1];
  for (const h of HERO_SLOT_HOURS) if (hour >= h) start = h;
  return start;
}

export function isNightSlot(hour: number): boolean {
  return HERO_SLOTS.find((s) => s.hour === hour)?.night ?? false;
}

export function heroSlotLabel(hour: number): string {
  return HERO_SLOTS.find((s) => s.hour === hour)?.label ?? `${hour}:00`;
}

/**
 * The slot hour a file-based hero path belongs to, read from its filename
 * (`/Hero-12.webp` → 12, `/hero-23.webp` → 23). Returns null when there's no
 * hour in the name.
 */
export function hourFromHeroPath(path: string): number | null {
  const stem = path.slice(path.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
  const nums = stem.match(/\d{1,2}/g);
  if (!nums) return null;
  const h = parseInt(nums[nums.length - 1], 10);
  return h >= 0 && h <= 23 ? h : null;
}
