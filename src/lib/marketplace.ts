import 'server-only';
import { getSettings, setSetting, MARKETPLACE_SETTING_KEYS } from './settings';
import { SPOTLIGHT_DEFAULTS, type SpotlightConfig } from './marketplaceSpotlight';

/**
 * Server-side load/save for the marketplace "New Arrivals" auto-rotation config.
 * Pure rotation logic lives in ./marketplaceSpotlight (unit-tested); this just
 * reads/writes the AppSetting values around it.
 */

const K = MARKETPLACE_SETTING_KEYS;

export async function getSpotlightConfig(): Promise<SpotlightConfig> {
  const s = await getSettings([K.spotlightEnabled, K.spotlightCount, K.spotlightFreshDays]);
  const count = Number(s[K.spotlightCount]);
  const fresh = Number(s[K.spotlightFreshDays]);
  return {
    // On by default — the whole point is that it runs without anyone minding it.
    enabled: s[K.spotlightEnabled] !== 'false',
    targetCount: Number.isFinite(count) && count >= 1 ? Math.floor(count) : SPOTLIGHT_DEFAULTS.targetCount,
    freshDays: Number.isFinite(fresh) && fresh >= 0 ? Math.floor(fresh) : SPOTLIGHT_DEFAULTS.freshDays,
  };
}

export async function saveSpotlightConfig(cfg: SpotlightConfig): Promise<void> {
  await setSetting(K.spotlightEnabled, cfg.enabled ? 'true' : 'false');
  await setSetting(K.spotlightCount, String(Math.max(1, Math.floor(cfg.targetCount))));
  await setSetting(K.spotlightFreshDays, String(Math.max(0, Math.floor(cfg.freshDays))));
}
