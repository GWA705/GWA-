import { getT } from '@/i18n/server';
import { LoginForm } from '@/app/(auth)/login/LoginForm';

/**
 * A full seasonal/occasion skin for the sign-in screen: a full-bleed background
 * image, a glass card, and a configurable accent colour. It reskins only the page
 * chrome and wraps the REAL <LoginForm>, so the sign-in action, validation,
 * errors, MFA and the EN/FR toggle all keep working. Every style is scoped to
 * `.seasonal-login`, so nothing leaks to the normal login.
 *
 * `bgSrc`  — background image URL (a public asset or the login-theme serving route).
 * `accent` — hex accent for the title word, input focus and the button (default
 *            Halloween orange). Darker button stop is derived with color-mix, so
 *            any single colour (Christmas green, a sale red, …) reads correctly.
 */
export function SeasonalLogin({ bgSrc, accent = '#ff7416' }: { bgSrc: string; accent?: string }) {
  const t = getT();
  const title = t('auth.portalTitle');
  const parts = title.split(' ');
  const lastWord = parts.length > 1 ? parts.pop()! : '';
  const head = parts.join(' ');

  return (
    <div className="seasonal-login" style={{ ['--sl-accent' as string]: accent }}>
      <div className="sl-overlay" aria-hidden />
      <div className="sl-container">
        <div className="sl-card">
          <div className="sl-head">
            <h1>
              {head} {lastWord && <span className="accent">{lastWord}</span>}
            </h1>
            <p>{t('auth.signInToContinue')}</p>
          </div>
          <LoginForm />
          <p className="sl-privacy">{t('auth.authorizedNotice')}</p>
        </div>
      </div>

      <style>{`
        .seasonal-login{position:relative;min-height:100dvh;width:100%;display:flex;align-items:center;justify-content:center;
          --sl-accent:#ff7416;
          padding:max(84px,env(safe-area-inset-top)) 24px max(56px,env(safe-area-inset-bottom));overflow:hidden;color:#fff;
          background:linear-gradient(rgba(2,6,18,.12),rgba(2,6,18,.22)),url('${bgSrc}');
          background-size:cover;background-position:center}
        .seasonal-login .sl-overlay{position:absolute;inset:0;pointer-events:none;
          background:radial-gradient(circle at center,transparent 25%,rgba(0,0,0,.18) 70%,rgba(0,0,0,.6) 115%)}
        .seasonal-login .sl-container{position:relative;z-index:10;width:min(520px,100%)}
        .seasonal-login .sl-card{position:relative;padding:44px 48px 30px;border-radius:24px;overflow:hidden;
          background:linear-gradient(145deg,rgba(13,27,55,.82),rgba(9,18,39,.86));
          border:1px solid rgba(149,187,255,.30);
          box-shadow:0 35px 90px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.08);
          backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px)}
        .seasonal-login .sl-head{text-align:center;margin-bottom:26px}
        .seasonal-login .sl-head h1{margin:0;font-size:clamp(32px,4vw,46px);line-height:1.03;font-weight:800;letter-spacing:-1.3px;color:#f5f7fb;text-wrap:balance}
        .seasonal-login .sl-head h1 .accent{color:var(--sl-accent)}
        .seasonal-login .sl-head p{margin-top:12px;color:#c8cfdf;font-size:17px}
        .seasonal-login .label{color:#fff;font-weight:600;font-size:15px}
        .seasonal-login .input{height:54px;padding:0 16px;border-radius:12px;border:1px solid rgba(177,193,222,.42);
          background:rgba(18,31,57,.6);color:#fff;font-size:16px}
        .seasonal-login .input::placeholder{color:#929db4}
        .seasonal-login .input:focus{border-color:var(--sl-accent);background:rgba(22,37,66,.72);outline:none;
          box-shadow:0 0 0 3px color-mix(in srgb,var(--sl-accent) 22%,transparent),0 0 20px color-mix(in srgb,var(--sl-accent) 16%,transparent)}
        .seasonal-login a{color:#7ab6ff}
        .seasonal-login a:hover{color:#a9d2ff}
        .seasonal-login .btn-primary{height:56px;border-radius:13px;border:1px solid color-mix(in srgb,var(--sl-accent) 60%,#fff);
          background:linear-gradient(110deg,var(--sl-accent),color-mix(in srgb,var(--sl-accent) 72%,#000) 92%);color:#fff;font-weight:700;font-size:17px;
          box-shadow:0 0 20px color-mix(in srgb,var(--sl-accent) 40%,transparent),0 11px 30px color-mix(in srgb,var(--sl-accent) 24%,transparent),inset 0 1px 0 rgba(255,255,255,.3);
          transition:transform .18s ease,box-shadow .18s ease}
        .seasonal-login .btn-primary:hover{transform:translateY(-2px)}
        .seasonal-login [role="alert"]{background:rgba(220,38,38,.2) !important;color:#ffd9d9 !important;border:1px solid rgba(248,113,113,.4)}
        .seasonal-login .sl-privacy{position:relative;z-index:2;max-width:430px;margin:22px auto 0;text-align:center;color:#cdd6e6;font-size:12px;line-height:1.55}
        @media (max-width:650px){.seasonal-login .sl-card{padding:32px 22px 26px;border-radius:20px}.seasonal-login .sl-head h1{font-size:32px}.seasonal-login .sl-head p{font-size:16px}}
        @media (prefers-reduced-motion:reduce){.seasonal-login *,.seasonal-login *::before,.seasonal-login *::after{transition:none !important}}
      `}</style>
    </div>
  );
}
