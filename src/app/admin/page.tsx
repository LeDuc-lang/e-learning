import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import AdminPanel from './AdminPanel';
import { logoutAction } from '@/app/auth/actions';
import { getCurrentUserWithProfile, isAdmin } from '@/lib/auth';

async function AdminContent() {
  await connection();

  const { user, profile } = await getCurrentUserWithProfile();

  if (!user) {
    redirect('/login?next=/admin');
  }

  if (!isAdmin(profile)) {
    redirect('/app/dashboard');
  }

  return (
    <main className="min-h-screen bg-[#F3F4F6] text-slate-800 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/app/dashboard" className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#1B4332] flex items-center justify-center text-[#FAF9F6] font-semibold text-sm">
                S
              </span>
              <span className="font-semibold text-[#1B4332] tracking-tight text-base">
                Sylva<span className="text-[#74A18E] font-normal">Learn</span>
              </span>
            </Link>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#1B4332] bg-[#74A18E]/15 px-3 py-1 rounded-full">
              Administration
            </span>
          </div>

          <nav className="flex items-center gap-3 text-sm font-medium" aria-label="Navigation administrateur">
            <Link
              href="/app/dashboard"
              className="px-3 py-2 rounded-lg text-slate-600 hover:text-[#1B4332] hover:bg-white/70 transition-colors"
            >
              Tableau de bord
            </Link>
            <Link
              href="/"
              className="px-3 py-2 rounded-lg text-slate-600 hover:text-[#1B4332] hover:bg-white/70 transition-colors"
            >
              Générateur
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="px-3 py-2 rounded-lg text-slate-600 hover:text-[#1B4332] hover:bg-white/70 transition-colors"
              >
                Déconnexion
              </button>
            </form>
          </nav>
        </header>

        <section className="space-y-2">
          <h1 className="text-2xl font-semibold text-[#1B4332] tracking-tight">
            Supervision des services
          </h1>
          <p className="text-sm text-slate-600">
            Connecté en tant que <span className="font-medium">{profile?.email}</span>. Cette page
            vérifie en direct Groq, Supabase Database, Supabase Auth, Sentry et UptimeRobot.
            Le contrôle Vercel apparaît automatiquement une fois l’application déployée.
          </p>
        </section>

        <AdminPanel />
      </div>
    </main>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F3F4F6] p-10 text-sm text-slate-500">
          Vérification des accès…
        </div>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
