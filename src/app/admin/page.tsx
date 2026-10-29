import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { logoutAction } from '@/app/auth/actions';
import { testAiService } from '@/app/admin/actions';
import { getAiConfigStatus } from '@/lib/ai';
import { getCurrentUserWithProfile, isAdmin } from '@/lib/auth';
import { getRateLimitConfig } from '@/lib/rate-limit';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

interface ProfileRow {
  user_id: string;
  email: string;
  full_name: string | null;
  role: 'user' | 'admin';
  created_at: string;
}

interface RequestRow {
  user_id: string;
  created_at: string;
}

interface ProfileEmailRow {
  user_id: string;
  email: string;
}

interface PathRow {
  id: string;
  title: string;
  user_id: string;
  created_at: string;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function hostOf(value: string | null) {
  if (!value) return 'non configuré';

  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ServiceCard({
  title,
  status,
  statusLabel,
  children,
}: {
  title: string;
  status: 'ok' | 'error' | 'warning';
  statusLabel: string;
  children: React.ReactNode;
}) {
  const dot = {
    ok: 'bg-emerald-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
  }[status];

  const badge = {
    ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
  }[status];

  return (
    <article className="rounded-2xl border border-gray-200 bg-white/80 p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-[#1B4332]">{title}</h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${badge}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
          {statusLabel}
        </span>
      </div>
      <dl className="space-y-1.5 text-xs text-slate-600">{children}</dl>
    </article>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-700 break-all">{children}</dd>
    </div>
  );
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function AdminContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const params = await searchParams;
  const { supabase, user, profile } = await getCurrentUserWithProfile();

  if (!user) {
    redirect('/login?next=/admin');
  }

  if (!isAdmin(profile)) {
    redirect('/app/dashboard');
  }

  const since = hoursAgo(24);
  const aiConfig = getAiConfigStatus();
  const rateLimit = getRateLimitConfig();

  const [
    profilesCount,
    pathsCount,
    requests24h,
    recentUsers,
    recentRequests,
    allProfiles,
    recentPaths,
  ] = await Promise.all([
    supabase.from('profiles').select('user_id', { count: 'exact', head: true }),
    supabase.from('learning_paths').select('id', { count: 'exact', head: true }),
    supabase
      .from('ai_requests')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since),
    supabase
      .from('profiles')
      .select('user_id, email, full_name, role, created_at')
      .order('created_at', { ascending: false })
      .limit(8)
      .returns<ProfileRow[]>(),
    supabase
      .from('ai_requests')
      .select('user_id, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200)
      .returns<RequestRow[]>(),
    supabase.from('profiles').select('user_id, email').limit(1000).returns<ProfileEmailRow[]>(),
    supabase
      .from('learning_paths')
      .select('id, title, user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5)
      .returns<PathRow[]>(),
  ]);

  const dbError =
    profilesCount.error ??
    pathsCount.error ??
    requests24h.error ??
    recentUsers.error ??
    recentRequests.error ??
    allProfiles.error ??
    recentPaths.error;

  const emailByUser = new Map((allProfiles.data ?? []).map((row) => [row.user_id, row.email]));

  const usageByUser = new Map<string, number>();
  (recentRequests.data ?? []).forEach((row) => {
    usageByUser.set(row.user_id, (usageByUser.get(row.user_id) ?? 0) + 1);
  });

  const topUsage = [...usageByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const lastRequestAt = recentRequests.data?.[0]?.created_at ?? null;
  const aiQueryResult = first(params.ia);
  const aiLatency = first(params.latence);

  return (
    <main className="min-h-screen bg-[#F3F4F6] text-slate-800 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
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
            Connecté en tant que <span className="font-medium">{profile?.email}</span>. Cette page est
            réservée aux administrateurs (rôle <code className="text-xs">admin</code>).
          </p>
        </section>

        {aiQueryResult && (
          <p
            role="status"
            className={`rounded-xl border px-4 py-3 text-xs font-medium ${
              aiQueryResult === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {aiQueryResult === 'ok'
              ? `Test IA réussi : réponse reçue en ${aiLatency ?? '?'} ms.`
              : aiQueryResult === 'config'
                ? 'Le service IA n’est pas configuré : renseignez AI_BASE_URL, AI_API_KEY et AI_MODEL.'
                : 'Le test IA a échoué. Vérifiez la configuration du fournisseur et les logs serveur.'}
          </p>
        )}

        {dbError && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
            Erreur Supabase : {dbError.message}. Vérifiez que le script{' '}
            <code>supabase/schema.sql</code> a bien été exécuté.
          </p>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <ServiceCard
            title="Base de données"
            status={dbError ? 'error' : 'ok'}
            statusLabel={dbError ? 'Erreur' : 'Connectée'}
          >
            <Row label="Fournisseur">Supabase (PostgreSQL)</Row>
            <Row label="Hôte">{hostOf(process.env.NEXT_PUBLIC_SUPABASE_URL ?? null)}</Row>
            <Row label="Profils">{profilesCount.count ?? 0}</Row>
            <Row label="Parcours">{pathsCount.count ?? 0}</Row>
            <Row label="RLS">Activée sur toutes les tables</Row>
          </ServiceCard>

          <ServiceCard
            title="Modèle d’IA"
            status={aiConfig.configured ? 'ok' : 'warning'}
            statusLabel={aiConfig.configured ? 'Configuré' : 'À configurer'}
          >
            <Row label="Fournisseur">{hostOf(aiConfig.baseUrl)}</Row>
            <Row label="Modèle">{aiConfig.model ?? 'non défini'}</Row>
            <Row label="Clé API">{aiConfig.hasApiKey ? 'présente' : 'absente'}</Row>
            <Row label="Appels (24 h)">{requests24h.count ?? 0}</Row>
            <Row label="Dernier appel">{lastRequestAt ? formatDate(lastRequestAt) : '—'}</Row>
          </ServiceCard>

          <ServiceCard
            title="Authentification"
            status={dbError ? 'error' : 'ok'}
            statusLabel={dbError ? 'Erreur' : 'Opérationnelle'}
          >
            <Row label="Méthode">Email + mot de passe</Row>
            <Row label="Utilisateurs">{profilesCount.count ?? 0}</Row>
            <Row label="Session">Cookie sécurisé (proxy)</Row>
            <Row label="Rôle courant">admin</Row>
          </ServiceCard>

          <ServiceCard title="Limitation de débit" status="ok" statusLabel="Active">
            <Row label="Quota">{rateLimit.limit} appels / utilisateur</Row>
            <Row label="Fenêtre">{rateLimit.windowMinutes} minutes</Row>
            <Row label="Stockage">Table ai_requests</Row>
            <Row label="Dépassement">HTTP 429 + message</Row>
          </ServiceCard>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white/80 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#1B4332]">Contrôle du modèle d’IA</h2>
              <p className="mt-1 text-xs text-slate-500">
                Envoie une requête minimale au fournisseur configuré et vérifie la latence.
              </p>
            </div>
            <form action={testAiService}>
              <button
                type="submit"
                className="bg-[#1B4332] text-[#FAF9F6] text-xs font-medium px-4 py-2.5 rounded-xl hover:bg-[#2D6A4F] transition-colors"
              >
                Tester la connexion IA
              </button>
            </form>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-gray-200 bg-white/80 p-5">
            <h2 className="text-sm font-semibold text-[#1B4332]">Derniers utilisateurs</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-slate-500">
                  <tr className="border-b border-gray-200">
                    <th className="pb-2 font-medium">Email</th>
                    <th className="pb-2 font-medium">Rôle</th>
                    <th className="pb-2 font-medium">Inscription</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(recentUsers.data ?? []).map((row) => (
                    <tr key={row.user_id}>
                      <td className="py-2 pr-3 text-slate-700">{row.email}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            row.role === 'admin'
                              ? 'bg-[#1B4332] text-[#FAF9F6]'
                              : 'bg-gray-100 text-slate-600'
                          }`}
                        >
                          {row.role}
                        </span>
                      </td>
                      <td className="py-2 text-slate-500">{formatDate(row.created_at)}</td>
                    </tr>
                  ))}
                  {(recentUsers.data ?? []).length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-3 text-slate-500">
                        Aucun utilisateur.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white/80 p-5">
            <h2 className="text-sm font-semibold text-[#1B4332]">Appels IA (24 h) par utilisateur</h2>
            <ul className="mt-4 space-y-2 text-xs">
              {topUsage.map(([userId, count]) => (
                <li
                  key={userId}
                  className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2"
                >
                  <span className="text-slate-600 break-all">{emailByUser.get(userId) ?? userId}</span>
                  <span className="font-medium text-[#1B4332]">
                    {count} / {rateLimit.limit}
                  </span>
                </li>
              ))}
              {topUsage.length === 0 && (
                <li className="text-slate-500">Aucun appel au modèle sur les dernières 24 heures.</li>
              )}
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white/80 p-5">
          <h2 className="text-sm font-semibold text-[#1B4332]">Derniers parcours générés</h2>
          <ul className="mt-4 divide-y divide-gray-100 text-xs">
            {(recentPaths.data ?? []).map((row) => (
              <li key={row.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium text-slate-700">{row.title}</span>
                <span className="text-slate-500">
                  {emailByUser.get(row.user_id) ?? row.user_id} · {formatDate(row.created_at)}
                </span>
              </li>
            ))}
            {(recentPaths.data ?? []).length === 0 && (
              <li className="py-2 text-slate-500">Aucun parcours généré.</li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}

export default function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F3F4F6] p-10 text-sm text-slate-500">
          Vérification des accès…
        </div>
      }
    >
      <AdminContent searchParams={searchParams} />
    </Suspense>
  );
}
