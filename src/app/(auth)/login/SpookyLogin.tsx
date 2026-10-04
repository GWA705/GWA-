import { SeasonalLogin } from '@/components/auth/SeasonalLogin';

/**
 * The built-in Halloween sign-in skin — a preset of the generic <SeasonalLogin>
 * with the bundled night background and an orange accent. Shown automatically
 * during the spooky season (see isSpookySeason) when no admin login theme is live.
 */
export function SpookyLogin() {
  return <SeasonalLogin bgSrc="/halloween-login-bg.webp" accent="#ff7416" />;
}
