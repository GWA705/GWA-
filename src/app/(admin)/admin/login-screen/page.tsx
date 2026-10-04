import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { isSpookySeason } from '@/lib/seasonal';
import { loginThemeIsLive, activeLoginTheme } from '@/lib/loginTheme';
import { LoginThemeForm } from './LoginThemeForm';
import { toggleLoginThemeActiveAction, deleteLoginThemeAction } from '@/app/(admin)/actions';

export const dynamic = 'force-dynamic';

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '';
}

export default async function LoginScreenPage() {
  await requireAdminSection('login-screen');
  const [rows, current] = await Promise.all([
    prisma.loginTheme.findMany({ orderBy: { createdAt: 'desc' } }),
    activeLoginTheme(),
  ]);

  // Which row is actually showing right now (the resolver picks one winner).
  const liveId = current?.id ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Login screen</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Set the background (and accent colour) of the sign-in page. Schedule one for an occasion and it comes and goes on
          its own, or switch one on now and leave it. When nothing is live here, the sign-in page uses its built-in look.
        </p>
      </div>

      {/* What's showing now */}
      <section className="card p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-gray-700">Showing right now:</span>
          {current ? (
            <>
              <span className="badge bg-green-100 text-green-800">{current.name}</span>
              <span className="text-gray-500">(an admin login look)</span>
            </>
          ) : isSpookySeason() ? (
            <span className="badge bg-orange-100 text-orange-800">Built-in Halloween skin</span>
          ) : (
            <span className="badge bg-gray-100 text-gray-600">Built-in normal sign-in</span>
          )}
        </div>
      </section>

      {/* Add a look */}
      <section className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Add a login look</h2>
        <p className="mb-4 text-sm text-gray-500">Christmas, a sale, a company milestone — upload a background and (optionally) pick dates.</p>
        <LoginThemeForm />
      </section>

      {/* Existing looks */}
      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Saved looks</h2>
        <div className="space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">No login looks saved yet.</div>
          ) : (
            rows.map((t) => {
              const showing = t.id === liveId;
              const inWindow = t.active && loginThemeIsLive(t);
              return (
                <div key={t.id} className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/login-theme/${t.id}/image?v=${t.updatedAt.getTime()}`} alt="" className="h-14 w-24 flex-none rounded border border-gray-200 object-cover" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900">{t.name}</span>
                        {showing && <span className="badge bg-green-100 text-green-800">Showing now</span>}
                        {!showing && inWindow && <span className="badge bg-amber-100 text-amber-800">In window (another look wins)</span>}
                        {!t.active && <span className="badge bg-gray-100 text-gray-600">Off</span>}
                        {t.accentColor && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                            <span className="inline-block h-3 w-3 rounded-full border border-gray-300" style={{ background: t.accentColor }} />
                            {t.accentColor}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs tabular-nums text-gray-500">
                        {t.startsOn && t.endsOn ? `${fmtDate(t.startsOn)} → ${fmtDate(t.endsOn)}` : 'Always on (manual)'}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-none flex-col gap-2">
                    <form action={toggleLoginThemeActiveAction.bind(null, t.id)}>
                      <button type="submit" className="btn-secondary w-full text-xs">{t.active ? 'Turn off' : 'Turn on'}</button>
                    </form>
                    <form action={deleteLoginThemeAction.bind(null, t.id)}>
                      <button type="submit" className="btn-danger w-full text-xs">Delete</button>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
