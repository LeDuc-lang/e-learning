'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ResultatControle, Statut } from '@/lib/statut';

type ReponseStatut = {
  verifieLe: string;
  statutGlobal: Statut;
  services: ResultatControle[];
};

const INTERVALLE_MS = 30_000;

const AFFICHAGE: Record<
  Statut,
  { libelle: string; badge: string; point: string; bandeau: string }
> = {
  operationnel: {
    libelle: 'Opérationnel',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    point: 'bg-emerald-500',
    bandeau: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  degrade: {
    libelle: 'Dégradé',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    point: 'bg-amber-500',
    bandeau: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  en_panne: {
    libelle: 'En panne',
    badge: 'bg-red-50 text-red-700 border-red-200',
    point: 'bg-red-500',
    bandeau: 'border-red-200 bg-red-50 text-red-800',
  },
};

const MESSAGE_GLOBAL: Record<Statut, string> = {
  operationnel: 'Tous les services sont opérationnels.',
  degrade: 'Au moins un service répond lentement.',
  en_panne: 'Au moins un service est en panne.',
};

async function recupererStatut(): Promise<ReponseStatut> {
  const reponse = await fetch('/api/admin/statut', { cache: 'no-store' });

  if (!reponse.ok) {
    if (reponse.status === 401) {
      throw new Error('Votre session a expiré. Reconnectez-vous pour relancer les contrôles.');
    }

    if (reponse.status === 403) {
      throw new Error('Accès refusé : cette page est réservée aux administrateurs.');
    }

    throw new Error(`La route de statut a répondu avec le code ${reponse.status}.`);
  }

  return reponse.json();
}

export default function AdminPanel() {
  const [donnees, setDonnees] = useState<ReponseStatut | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const actualiser = useCallback(async (manuel = false) => {
    if (manuel) {
      setChargement(true);
    }

    try {
      const resultat = await recupererStatut();
      setDonnees(resultat);
      setErreur('');
    } catch (error) {
      setErreur(
        error instanceof Error ? error.message : 'Impossible de joindre la route de statut.'
      );
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    const demarrer = setTimeout(() => {
      void actualiser();
    }, 0);

    const intervalle = setInterval(() => {
      void actualiser();
    }, INTERVALLE_MS);

    return () => {
      clearTimeout(demarrer);
      clearInterval(intervalle);
    };
  }, [actualiser]);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white/80 p-5 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-[#1B4332]">État des services</h2>
          <p className="text-xs text-slate-500">
            Contrôles exécutés côté serveur, actualisés automatiquement toutes les 30 secondes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void actualiser(true)}
          disabled={chargement}
          className="shrink-0 bg-[#1B4332] text-[#FAF9F6] text-xs font-medium px-4 py-2.5 rounded-xl hover:bg-[#2D6A4F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {chargement ? 'Vérification…' : 'Relancer les tests'}
        </button>
      </div>

      {erreur && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
        >
          {erreur}
        </p>
      )}

      {!donnees && chargement && !erreur && (
        <p className="mt-5 text-xs text-slate-500">Vérification des services en cours…</p>
      )}

      {donnees && (
        <>
          <div
            role="status"
            aria-live="polite"
            className={`mt-5 flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
              AFFICHAGE[donnees.statutGlobal].bandeau
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span
                className={`h-2 w-2 rounded-full ${AFFICHAGE[donnees.statutGlobal].point}`}
              />
              {MESSAGE_GLOBAL[donnees.statutGlobal]}
            </span>
            <span className="text-xs font-medium uppercase tracking-wide">
              {AFFICHAGE[donnees.statutGlobal].libelle}
            </span>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <caption className="sr-only">
                État des services externes dont dépend l’application
              </caption>
              <thead>
                <tr className="border-b border-gray-200 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="pb-3 pr-4 font-medium">Service</th>
                  <th className="pb-3 pr-4 font-medium">Statut</th>
                  <th className="pb-3 pr-4 font-medium">Temps de réponse</th>
                  <th className="pb-3 font-medium">Détail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {donnees.services.map((service) => (
                  <tr key={service.service} className="align-top">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-slate-700">{service.service}</p>
                      <p className="text-xs text-slate-500">{service.description}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                          AFFICHAGE[service.statut].badge
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${AFFICHAGE[service.statut].point}`}
                        />
                        {AFFICHAGE[service.statut].libelle}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-xs text-slate-600">
                      {service.latenceMs} ms
                    </td>
                    <td className="py-3 text-xs text-slate-600 break-words">{service.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-1 border-t border-gray-100 pt-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Dernière vérification : {new Date(donnees.verifieLe).toLocaleString('fr-FR')}
            </p>
            <p>Seuils : plus de 2 s = dégradé · plus de 5 s = en panne.</p>
          </div>
        </>
      )}
    </section>
  );
}
