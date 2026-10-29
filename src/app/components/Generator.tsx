'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { BlurText } from '@/app/components/ui/BlurText';
import { SpotlightCard } from '@/app/components/ui/SpotlightCard';

// --- Types du formulaire de génération ---
type SkillLevel = 'debutant' | 'intermediaire' | 'avance';
type TimeFrequency = 'jour' | 'semaine';
type DurationUnit = 'jours' | 'semaines';

export interface LearningPathFormValues {
  topic: string;
  level: SkillLevel;
  goal: string;
  timeAmount: string;
  timeFrequency: TimeFrequency;
  durationAmount: string;
  durationUnit: DurationUnit;
}

interface LevelOption {
  value: SkillLevel;
  label: string;
  helper: string;
}

const LEVEL_OPTIONS: LevelOption[] = [
  {
    value: 'debutant',
    label: 'Débutant',
    helper: 'Découverte des fondamentaux pas à pas',
  },
  {
    value: 'intermediaire',
    label: 'Intermédiaire',
    helper: 'Consolidation et cas pratiques ciblés',
  },
  {
    value: 'avance',
    label: 'Avancé',
    helper: 'Approfondissement technique et maîtrise',
  },
];

const TOPIC_SUGGESTIONS = [
  'Architecture Next.js & Server Actions',
  'Accessibilité Web (RGAA / WCAG)',
  'TypeScript avancé & Design Patterns',
  'Éco-conception front-end',
];

export default function HomePage() {
  // --- États du formulaire ---
  const [formData, setFormData] = useState<LearningPathFormValues>({
    topic: '',
    level: 'debutant',
    goal: '',
    timeAmount: '45',
    timeFrequency: 'jour',
    durationAmount: '4',
    durationUnit: 'semaines',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<'success' | 'error' | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Calcul subtil du taux de remplissage pour guider l'utilisateur en douceur
  const completionPercentage = useMemo(() => {
    let filled = 0;
    if (formData.topic.trim().length > 2) filled += 1;
    if (formData.level) filled += 1;
    if (formData.goal.trim().length > 5) filled += 1;
    if (Number(formData.timeAmount) > 0) filled += 1;
    if (Number(formData.durationAmount) > 0) filled += 1;
    return Math.round((filled / 5) * 100);
  }, [formData]);

  const isFormValid =
    formData.topic.trim().length > 2 &&
    formData.goal.trim().length > 5 &&
    Number(formData.timeAmount) > 0 &&
    Number(formData.durationAmount) > 0;

  // --- Gestionnaires d'événements ---
  const handleChange = <K extends keyof LearningPathFormValues>(
    field: K,
    value: LearningPathFormValues[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (statusMessage) {
      setStatusMessage(null);
      setStatusKind(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setStatusMessage(null);
    setStatusKind(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: formData.topic.trim(),
          level: formData.level,
          goal: formData.goal.trim(),
          timeAmount: Number(formData.timeAmount),
          timeFrequency: formData.timeFrequency,
          durationAmount: Number(formData.durationAmount),
          durationUnit: formData.durationUnit,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { path?: { title?: string }; error?: string; remaining?: number }
        | null;

      if (!response.ok) {
        setStatusKind('error');
        setStatusMessage(
          payload?.error ?? 'La génération a échoué. Merci de réessayer dans un instant.'
        );
        return;
      }

      const remaining =
        typeof payload?.remaining === 'number'
          ? ` ${payload.remaining} génération${payload.remaining > 1 ? 's' : ''} restante${payload.remaining > 1 ? 's' : ''} sur la période.`
          : '';

      setStatusKind('success');
      setStatusMessage(
        `Parcours « ${payload?.path?.title ?? formData.topic.trim()} » créé et enregistré.${remaining}`
      );
    } catch {
      setStatusKind('error');
      setStatusMessage('Impossible de contacter le serveur. Vérifiez votre connexion.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-slate-800 selection:bg-[#74A18E]/30 selection:text-[#1B4332]">
      {/* Contenu principal centré sur la création de parcours */}
      <main className="max-w-5xl mx-auto px-6 py-8 md:py-12">
        <section
          aria-labelledby="generator-heading"
          className="relative overflow-hidden rounded-3xl bg-[#FAF9F6] border border-gray-200/90 p-6 sm:p-10 md:p-12 shadow-xs"
        >
          {/* Halo d'ambiance très discret (respecte prefers-reduced-motion) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-28 -right-28 w-96 h-96 rounded-full bg-[#74A18E]/15 blur-3xl motion-safe:animate-pulse"
            style={{ animationDuration: '9s' }}
          />

          {/* Trame géométrique subtile en vert sauge */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-35"
            style={{
              backgroundImage: `radial-gradient(#74A18E 0.85px, transparent 0.85px)`,
              backgroundSize: '24px 24px',
              maskImage: 'linear-gradient(to bottom right, black 5%, transparent 70%)',
              WebkitMaskImage:
                'linear-gradient(to bottom right, black 5%, transparent 70%)',
            }}
          />

          {/* En-tête de la section d'accueil */}
          <div className="relative z-10 max-w-2xl space-y-3 mb-8">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-[#1B4332] bg-[#74A18E]/15 border border-[#74A18E]/30 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1B4332]" />
              <span>Apprentissage sur mesure</span>
            </div>

            <BlurText
              text="Concevez votre prochain parcours d'apprentissage"
              delayStep={50}
              className="text-2xl sm:text-3xl md:text-4xl font-semibold text-[#1B4332] tracking-tight leading-snug"
            />

            <p className="text-sm md:text-base text-slate-600 leading-relaxed">
              Définissez votre sujet, votre niveau actuel et le rythme qui vous convient
              pour structurer un programme d&apos;étude adapté à vos objectifs.
            </p>
          </div>

          {/* Conteneur du formulaire enrichi avec SpotlightCard (React Bits) */}
          <SpotlightCard
            spotlightColor="rgba(116, 161, 142, 0.10)"
            className="relative z-10 bg-white/80 backdrop-blur-xs border-gray-200/90 p-6 sm:p-8 md:p-10 hover:translate-y-0"
          >
            {/* Barre supérieure d'indication de complétion du formulaire */}
            <div className="flex items-center justify-between gap-4 pb-6 mb-6 border-b border-gray-200/70">
              <div>
                <h2 className="text-base font-semibold text-[#1B4332]">
                  Paramètres du parcours
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Renseignez les étapes ci-dessous pour structurer vos chapitres.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-medium text-slate-500">
                  Configuration
                </span>
                <div
                  role="progressbar"
                  aria-valuenow={completionPercentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Complétion du formulaire"
                  className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full bg-[#1B4332] rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-[#1B4332] w-8 text-right">
                  {completionPercentage}%
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8" noValidate>
              {/* 1. Sujet à apprendre */}
              <div className="space-y-2.5">
                <label
                  htmlFor="topic"
                  className="block text-sm font-medium text-[#1B4332]"
                >
                  1. Que souhaitez-vous apprendre ?
                </label>
                <div className="relative">
                  <input
                    id="topic"
                    name="topic"
                    type="text"
                    required
                    value={formData.topic}
                    onFocus={() => setFocusedField('topic')}
                    onBlur={() => setFocusedField(null)}
                    onChange={(e) => handleChange('topic', e.target.value)}
                    placeholder="Ex. : Architecture Front-End accessible, Rust pour le Web, Conception d'API..."
                    className="w-full rounded-xl bg-[#FAF9F6] border border-gray-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 transition-all duration-200 focus:bg-white focus:border-[#1B4332] focus:ring-2 focus:ring-[#74A18E]/25 focus:outline-none"
                  />
                </div>

                {/* Suggestions rapides interactives */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-xs text-slate-400 mr-1">Exemples :</span>
                  {TOPIC_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleChange('topic', suggestion)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all duration-200 active:scale-[0.98] ${
                        formData.topic === suggestion
                          ? 'bg-[#1B4332]/10 border-[#1B4332]/40 text-[#1B4332] font-medium'
                          : 'bg-[#F3F4F6]/80 border-gray-200/80 text-slate-600 hover:border-[#74A18E] hover:text-[#1B4332]'
                      }`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Niveau actuel (Sélecteur par cartes interactives) */}
              <div className="space-y-2.5">
                <span className="block text-sm font-medium text-[#1B4332]">
                  2. Quel est votre niveau actuel sur ce sujet ?
                </span>
                <div
                  role="radiogroup"
                  aria-label="Niveau actuel"
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                >
                  {LEVEL_OPTIONS.map((option) => {
                    const isSelected = formData.level === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => handleChange('level', option.value)}
                        className={`text-left p-4 rounded-xl border transition-all duration-200 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4332] ${
                          isSelected
                            ? 'bg-[#1B4332] text-[#FAF9F6] border-[#1B4332] shadow-xs'
                            : 'bg-[#FAF9F6] text-slate-700 border-gray-200/90 hover:border-[#74A18E] hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold">
                            {option.label}
                          </span>
                          <span
                            aria-hidden="true"
                            className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'border-[#FAF9F6] bg-[#FAF9F6]'
                                : 'border-gray-300'
                            }`}
                          >
                            {isSelected && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#1B4332]" />
                            )}
                          </span>
                        </div>
                        <p
                          className={`text-xs leading-relaxed ${
                            isSelected ? 'text-[#FAF9F6]/85' : 'text-slate-500'
                          }`}
                        >
                          {option.helper}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Objectif d'apprentissage */}
              <div className="space-y-2.5">
                <div className="flex items-baseline justify-between">
                  <label
                    htmlFor="goal"
                    className="block text-sm font-medium text-[#1B4332]"
                  >
                    3. Quel est votre objectif concret à la fin du parcours ?
                  </label>
                  <span className="text-xs text-slate-400">
                    Ce que vous souhaitez savoir réaliser
                  </span>
                </div>
                <textarea
                  id="goal"
                  name="goal"
                  rows={3}
                  required
                  value={formData.goal}
                  onFocus={() => setFocusedField('goal')}
                  onBlur={() => setFocusedField(null)}
                  onChange={(e) => handleChange('goal', e.target.value)}
                  placeholder="Ex. : Être capable d'auditer une interface existante, corriger les problèmes de navigation au clavier et structurer des composants réutilisables..."
                  className="w-full rounded-xl bg-[#FAF9F6] border border-gray-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 transition-all duration-200 focus:bg-white focus:border-[#1B4332] focus:ring-2 focus:ring-[#74A18E]/25 focus:outline-none resize-y"
                />
              </div>

              {/* 4. Temps disponible & 5. Durée souhaitée */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                {/* Temps consacré */}
                <div className="space-y-2.5 bg-[#FAF9F6] p-4 rounded-2xl border border-gray-200/80">
                  <label
                    htmlFor="timeAmount"
                    className="block text-sm font-medium text-[#1B4332]"
                  >
                    4. Temps disponible
                  </label>
                  <p className="text-xs text-slate-500">
                    Rythme régulier que vous pouvez consacrer à l&apos;étude.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <div className="relative flex-1">
                      <input
                        id="timeAmount"
                        name="timeAmount"
                        type="number"
                        min={5}
                        max={600}
                        step={5}
                        required
                        value={formData.timeAmount}
                        onChange={(e) => handleChange('timeAmount', e.target.value)}
                        className="w-full rounded-xl bg-white border border-gray-200 pr-14 pl-3.5 py-2.5 text-sm font-medium text-slate-800 focus:border-[#1B4332] focus:ring-2 focus:ring-[#74A18E]/25 focus:outline-none"
                      />
                      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                        min
                      </span>
                    </div>

                    <div
                      role="group"
                      aria-label="Fréquence du temps disponible"
                      className="inline-flex bg-[#F3F4F6] p-1 rounded-xl border border-gray-200/80"
                    >
                      {(['jour', 'semaine'] as TimeFrequency[]).map((freq) => {
                        const active = formData.timeFrequency === freq;
                        return (
                          <button
                            key={freq}
                            type="button"
                            onClick={() => handleChange('timeFrequency', freq)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                              active
                                ? 'bg-[#1B4332] text-[#FAF9F6] shadow-2xs'
                                : 'text-slate-600 hover:text-[#1B4332]'
                            }`}
                          >
                            / {freq}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Durée totale souhaitée */}
                <div className="space-y-2.5 bg-[#FAF9F6] p-4 rounded-2xl border border-gray-200/80">
                  <label
                    htmlFor="durationAmount"
                    className="block text-sm font-medium text-[#1B4332]"
                  >
                    5. Durée totale souhaitée
                  </label>
                  <p className="text-xs text-slate-500">
                    Horizon cible pour atteindre votre objectif d&apos;apprentissage.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      id="durationAmount"
                      name="durationAmount"
                      type="number"
                      min={1}
                      max={52}
                      required
                      value={formData.durationAmount}
                      onChange={(e) =>
                        handleChange('durationAmount', e.target.value)
                      }
                      className="w-full flex-1 rounded-xl bg-white border border-gray-200 px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:border-[#1B4332] focus:ring-2 focus:ring-[#74A18E]/25 focus:outline-none"
                    />

                    <div
                      role="group"
                      aria-label="Unité de durée"
                      className="inline-flex bg-[#F3F4F6] p-1 rounded-xl border border-gray-200/80"
                    >
                      {(['jours', 'semaines'] as DurationUnit[]).map((unit) => {
                        const active = formData.durationUnit === unit;
                        return (
                          <button
                            key={unit}
                            type="button"
                            onClick={() => handleChange('durationUnit', unit)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all duration-150 ${
                              active
                                ? 'bg-[#1B4332] text-[#FAF9F6] shadow-2xs'
                                : 'text-slate-600 hover:text-[#1B4332]'
                            }`}
                          >
                            {unit}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Récapitulatif dynamique & Bouton de soumission */}
              <div className="pt-4 border-t border-gray-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-xs text-slate-500 leading-relaxed">
                  {formData.topic.trim() ? (
                    <span>
                      Parcours <strong className="text-[#1B4332]">{formData.level}</strong>{' '}
                      sur <strong className="text-[#1B4332]">{formData.topic}</strong> •{' '}
                      {formData.timeAmount} min/{formData.timeFrequency} pendant{' '}
                      {formData.durationAmount} {formData.durationUnit}.
                    </span>
                  ) : (
                    <span className="transition-opacity duration-200">
                      {focusedField
                        ? 'Complétez les champs pour prévisualiser votre rythme.'
                        : 'Tous les paramètres pourront être ajustés une fois le parcours créé.'}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  className="group relative inline-flex items-center justify-center gap-2.5 bg-[#1B4332] text-[#FAF9F6] text-sm font-medium px-6 py-3.5 rounded-xl shadow-xs hover:bg-[#2D6A4F] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4332] shrink-0"
                >
                  {isSubmitting ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="w-4 h-4 rounded-full border-2 border-[#FAF9F6]/30 border-t-[#FAF9F6] animate-spin"
                      />
                      <span>Structuration du parcours...</span>
                    </>
                  ) : (
                    <>
                      <span>Générer mon parcours</span>
                      <span
                        aria-hidden="true"
                        className="inline-block transition-transform duration-200 motion-safe:group-hover:translate-x-1"
                      >
                        →
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Retour visuel discret après validation */}
              {statusMessage && (
                <div
                  role={statusKind === 'error' ? 'alert' : 'status'}
                  aria-live="polite"
                  className={`rounded-xl border px-4 py-3 text-xs font-medium flex items-center justify-between gap-3 transition-all duration-300 ${
                    statusKind === 'error'
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-[#74A18E]/15 border-[#74A18E]/40 text-[#1B4332]'
                  }`}
                >
                  <span>{statusMessage}</span>
                  <span className="flex items-center gap-3 shrink-0">
                    {statusKind === 'success' && (
                      <Link href="/app/dashboard" className="underline text-[11px] whitespace-nowrap">
                        Mon espace →
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setStatusMessage(null);
                        setStatusKind(null);
                      }}
                      className="underline text-[11px] opacity-70 hover:opacity-100"
                    >
                      Fermer
                    </button>
                  </span>
                </div>
              )}
            </form>
          </SpotlightCard>
        </section>
      </main>
    </div>
  );
}