import { LanguageToggle } from '@/components/LanguageToggle';
import { I18N_UI_ENABLED } from '@/i18n/config';

/**
 * Auth pages (login, forgot/reset password, MFA, 2FA setup) are pre-login, so the
 * only language signal is the saved cookie. This puts an EN/FR toggle in the
 * corner so someone can switch before signing in — the header toggle isn't
 * available until they're in.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {I18N_UI_ENABLED && (
        <div className="fixed right-4 top-4 z-10">
          <LanguageToggle />
        </div>
      )}
      {children}
    </>
  );
}
