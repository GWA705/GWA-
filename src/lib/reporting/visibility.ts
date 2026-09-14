import 'server-only';
import type { SessionUser } from '@/lib/session';
import { isSuperAdmin } from '@/lib/rbac';
import { getSettings, setSetting } from '@/lib/settings';
import {
  canViewLeadershipSnapshot,
  canViewDealerSnapshot,
  canViewReportsArea,
  canViewAllLeads,
  canViewOwnerPricingReport,
  hasDealerReportAccess,
} from './access';

/**
 * Central, admin-configurable report visibility.
 *
 * Every report has a configurable LEVEL that decides who may open it. Defaults
 * replicate the hard-coded gating exactly, so nothing changes until an admin
 * flips a report on the Admin → Report visibility page. The chosen level is
 * enforced both in the tab list (hidden) and at the page (404) — real access
 * control, not just a hidden link.
 */

export type ReportLevel = 'superadmin' | 'leadership' | 'staff' | 'dealers' | 'grant' | 'off';

export const REPORT_LEVELS: { value: ReportLevel; label: string; who: string }[] = [
  { value: 'off', label: 'Off (hidden)', who: 'Nobody — the report is hidden from everyone.' },
  { value: 'superadmin', label: 'Super Admin only', who: 'Only super admins.' },
  { value: 'leadership', label: 'Leadership', who: 'Super admins, plus users with the Leadership grant.' },
  { value: 'staff', label: 'Staff (reports access)', who: 'Internal reviewers/admins who have reports access.' },
  { value: 'dealers', label: 'Dealers — own office', who: "Any office user with reports on (their own office's data), plus internal staff." },
  { value: 'grant', label: "By this report's grant (default)", who: "Only users holding this report's specific grant (e.g. Leads oversight, Owner reports)." },
];

export interface ReportDef {
  key: string;
  label: string;
  group: 'dealer' | 'staff';
  defaultLevel: ReportLevel;
  /** The report's inherent grant check — used for the 'grant' level. */
  grant?: (u: SessionUser) => Promise<boolean>;
  /** What the 'grant' level means in words, for the admin legend. */
  grantNote?: string;
}

export const REPORT_REGISTRY: ReportDef[] = [
  // Dealer-facing (own office)
  { key: 'digest', label: 'Snapshot', group: 'dealer', defaultLevel: 'dealers' },
  { key: 'monthly', label: 'Monthly', group: 'dealer', defaultLevel: 'dealers' },
  { key: 'weekly', label: 'Weekly', group: 'dealer', defaultLevel: 'dealers' },
  { key: 'overall', label: 'Overall sales', group: 'dealer', defaultLevel: 'dealers' },
  { key: 'funding', label: 'Funding', group: 'dealer', defaultLevel: 'dealers' },
  { key: 'products', label: 'Products & packages', group: 'dealer', defaultLevel: 'dealers' },
  { key: 'leaderboard', label: 'Salesperson leaderboard', group: 'dealer', defaultLevel: 'dealers' },
  { key: 'voc', label: 'VOC', group: 'dealer', defaultLevel: 'dealers' },
  { key: 'allLeads', label: 'All-office leads', group: 'dealer', defaultLevel: 'grant', grant: canViewAllLeads, grantNote: 'Leads-oversight grant' },
  { key: 'leadFunnel', label: 'Lead funnel', group: 'dealer', defaultLevel: 'grant', grant: canViewAllLeads, grantNote: 'Leads-oversight grant' },
  { key: 'pricing', label: 'Product pricing (owner)', group: 'dealer', defaultLevel: 'grant', grant: canViewOwnerPricingReport, grantNote: 'Office owner + reports enabled' },
  { key: 'reps', label: 'Sales reps (owner)', group: 'dealer', defaultLevel: 'grant', grant: canViewOwnerPricingReport, grantNote: 'Office owner + reports enabled' },
  { key: 'custom', label: 'Custom builder (owner)', group: 'dealer', defaultLevel: 'grant', grant: canViewOwnerPricingReport, grantNote: 'Office owner + reports enabled' },
  { key: 'forecast', label: 'Forecast (owner)', group: 'dealer', defaultLevel: 'grant', grant: canViewOwnerPricingReport, grantNote: 'Office owner + reports enabled' },
  { key: 'accounting', label: 'Accounting export (owner)', group: 'dealer', defaultLevel: 'grant', grant: canViewOwnerPricingReport, grantNote: 'Office owner + reports enabled' },
  // Staff
  { key: 'staffReports', label: 'Staff reports (Monthly, Weekly, Overall, Funding, Products, Leaderboard, VOC, Gift cards, Cycle times…)', group: 'staff', defaultLevel: 'staff', grant: canViewReportsArea, grantNote: 'Reports access' },
  { key: 'staffLeads', label: 'Leads report (staff)', group: 'staff', defaultLevel: 'grant', grant: canViewLeadershipSnapshot, grantNote: 'Leadership grant' },
  { key: 'staffDealerSnapshot', label: 'Dealer snapshot (staff)', group: 'staff', defaultLevel: 'grant', grant: canViewDealerSnapshot, grantNote: 'Dealer-snapshot grant' },
];

const settingKey = (key: string) => `report.visibility.${key}`;
const isLevel = (v: string | null): v is ReportLevel =>
  v === 'superadmin' || v === 'leadership' || v === 'staff' || v === 'dealers' || v === 'grant' || v === 'off';

/** Resolve which of the given report keys (default: all) the user may see. Batches
 * the settings read and memoizes each access check, so it's cheap to call for a
 * whole tab strip. */
export async function visibleReports(user: SessionUser, keys?: string[]): Promise<Set<string>> {
  const defs = REPORT_REGISTRY.filter((r) => !keys || keys.includes(r.key));
  const settings = await getSettings(defs.map((r) => settingKey(r.key)));
  const memo = new Map<string, Promise<boolean>>();
  const once = (k: string, fn: () => Promise<boolean>) => {
    if (!memo.has(k)) memo.set(k, fn());
    return memo.get(k)!;
  };
  const out = new Set<string>();
  for (const def of defs) {
    const raw = settings[settingKey(def.key)];
    const level = isLevel(raw) ? raw : def.defaultLevel;
    let ok = false;
    switch (level) {
      case 'off':
        ok = false;
        break;
      case 'superadmin':
        ok = isSuperAdmin(user);
        break;
      case 'leadership':
        ok = await once('leadership', () => canViewLeadershipSnapshot(user));
        break;
      case 'staff':
        ok = await once('staff', () => canViewReportsArea(user));
        break;
      case 'dealers':
        ok = await once('dealers', () => hasDealerReportAccess(user));
        break;
      case 'grant':
        ok = def.grant ? await once(`grant:${def.key}`, () => def.grant!(user)) : await once('dealers', () => hasDealerReportAccess(user));
        break;
    }
    if (ok) out.add(def.key);
  }
  return out;
}

/** Can this user open one report? (Convenience wrapper over visibleReports.) */
export async function canViewReport(user: SessionUser, key: string): Promise<boolean> {
  return (await visibleReports(user, [key])).has(key);
}

/** The full matrix for the admin page. */
export async function reportVisibilityMatrix(): Promise<
  { key: string; label: string; group: 'dealer' | 'staff'; defaultLevel: ReportLevel; level: ReportLevel; grantNote?: string }[]
> {
  const settings = await getSettings(REPORT_REGISTRY.map((r) => settingKey(r.key)));
  return REPORT_REGISTRY.map((r) => {
    const raw = settings[settingKey(r.key)];
    return {
      key: r.key,
      label: r.label,
      group: r.group,
      defaultLevel: r.defaultLevel,
      level: isLevel(raw) ? raw : r.defaultLevel,
      grantNote: r.grantNote,
    };
  });
}

/** Persist a report's visibility level (admin action). */
export async function setReportLevel(key: string, level: ReportLevel): Promise<void> {
  if (!REPORT_REGISTRY.some((r) => r.key === key)) return;
  await setSetting(settingKey(key), level);
}
