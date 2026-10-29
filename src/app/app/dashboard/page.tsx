import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { BlurText } from '@/app/components/ui/BlurText';
import { SpotlightCard } from '@/app/components/ui/SpotlightCard';
import UserHeader from '@/app/components/UserHeader';
import { learningPathSchema } from '@/lib/ai';
import { getCurrentUserWithProfile, isAdmin } from '@/lib/auth';

interface StoredPath {
  id: string;
  title: string;
  summary: string;
  topic: string;
  level: string;
  content: unknown;
  created_at: string;
}

const LEVEL_LABELS: Record<string, string> = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé',
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

async function DashboardContent() {
  await connection();
  const { supabase, user, profile } = await getCurrentUserWithProfile();

  if (!user) {
    redirect('/login');
  }

  const { data: paths, error } = await supabase
    .from('learning_paths')
    .select('id, title, summary, topic, level, content, created_at')
    .order('created_at', { ascending: false })
    .returns<StoredPath[]>();

  const firstName =
    profile?.full_name?.trim().split(' ')[0] || user.email?.split('@')[0] || 'apprenant';
  const admin = isAdmin(profile);

  return (
    <main className="min-h-screen bg-[#F3F4F6] text-slate-800 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <UserHeader currentPage="dashboard" isAdmin={admin} />

        <section className="relative overflow-hidden rounded-3xl bg-[#FAF9F6] border border-gray-200/90 p-8 md:p-10 shadow-xs">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage: 'radial-gradient(#74A18E 0.75px, transparent 0.75px)',
              backgroundSize: '24px 24px',
              maskImage: 'linear-gradient(to bottom right, black, transparent 75%)',
              WebkitMaskImage: 'linear-gradient(to bottom right, black, transparent 75%)',
            }}
          />

          <div className="relative z-10 max-w-2xl space-y-3">
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-[#1B4332] bg-[#74A18E]/15 px-3 py-1 rounded-full">
              Espace d’apprentissage
            </span>

            <BlurText
              className="text-2xl md:text-3xl font-semibold text-[#1B4332] tracking-tight"
              delayStep={55}
              text={`Bonjour ${firstName}, prêt à reprendre votre progression ?`}
            />

            <p className="text-sm md:text-base text-slate-600 leading-relaxed">
              {paths && paths.length > 0
                ? `Vous avez ${paths.length} parcours enregistré${paths.length > 1 ? 's' : ''}. Tous vos programmes sont stockés dans votre espace personnel.`
                : 'Votre espace est prêt. Générez votre premier parcours pour le retrouver ici.'}
            </p>

            <Link
              href="/"
              className="inline-flex items-center gap-2 mt-2 bg-[#1B4332] text-[#FAF9F6] text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-[#2D6A4F] transition-colors"
            >
              Créer un parcours
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-medium text-[#1B4332]">Vos parcours</h2>
            {paths && paths.length > 0 && (
              <span className="text-xs text-slate-500">
                Compte : {profile?.email ?? user.email}
              </span>
            )}
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-medium text-red-700">
              Impossible de charger vos parcours : {error.message}
            </p>
          )}

          {!error && (!paths || paths.length === 0) && (
            <div className="rounded-3xl border border-dashed border-gray-300 bg-white/60 p-10 text-center">
              <p className="text-sm font-medium text-slate-700">Aucun parcours pour le moment.</p>
              <p className="mt-1 text-xs text-slate-500">
                Décrivez votre objectif dans le générateur, l’IA structurera votre programme.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {paths?.map((path) => {
              const parsed = learningPathSchema.safeParse(path.content);
              const weeks = parsed.success ? parsed.data.weeks : [];

              return (
                <SpotlightCard key={path.id} className="p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 mb-3">
                      <span className="font-medium text-[#1B4332]/80 bg-gray-200/60 px-2.5 py-0.5 rounded-md">
                        {path.topic}
                      </span>
                      <span>{LEVEL_LABELS[path.level] ?? path.level}</span>
                    </div>

                    <h3 className="text-base font-semibold text-slate-900">{path.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">{path.summary}</p>

                    <p className="mt-3 text-[11px] text-slate-400">
                      {weeks.length} semaine{weeks.length > 1 ? 's' : ''} · créé le{' '}
                      {formatDate(path.created_at)}
                    </p>

                    {weeks.length > 0 && (
                      <details className="mt-4 rounded-xl border border-gray-200 bg-white/70 p-3">
                        <summary className="cursor-pointer text-xs font-medium text-[#1B4332]">
                          Voir le programme détaillé
                        </summary>
                        <ol className="mt-3 space-y-3">
                          {weeks.map((week) => (
                            <li key={`${path.id}-${week.week}`} className="text-xs">
                              <p className="font-semibold text-slate-800">
                                Semaine {week.week} — {week.theme}
                              </p>
                              <ul className="mt-1 list-disc pl-4 space-y-0.5 text-slate-600">
                                {week.objectives.map((objective) => (
                                  <li key={objective}>{objective}</li>
                                ))}
                              </ul>
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}
                  </div>
                </SpotlightCard>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F3F4F6] p-10 text-sm text-slate-500">Chargement de votre espace…</div>}>
      <DashboardContent />
    </Suspense>
  );
}
