import { getT } from '@/i18n/server';

// A small fixed banner shown only when NEXT_PUBLIC_APP_ENV=staging, so the
// staging environment is never mistaken for production. Renders nothing in
// production (the env var is unset there). Server component — no client JS.
export function StagingBanner() {
  if (process.env.NEXT_PUBLIC_APP_ENV !== 'staging') return null;
  const t = getT();
  return (
    <div
      role="status"
      className="sticky top-0 z-[100] w-full bg-amber-500 px-3 py-1 text-center text-xs font-semibold uppercase tracking-wide text-white"
    >
      {t('staffMisc.staging.banner')}
    </div>
  );
}
