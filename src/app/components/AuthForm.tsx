import Link from 'next/link';
import { loginAction, signupAction } from '@/app/auth/actions';

interface AuthFormProps {
  mode: 'login' | 'signup';
  error?: string;
  message?: string;
  next?: string;
}

export function AuthForm({ mode, error, message, next }: AuthFormProps) {
  const isLogin = mode === 'login';

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-slate-800 flex flex-col">
      <header className="sticky top-0 z-30 bg-[#FAF9F6]/85 backdrop-blur-md border-b border-gray-200/80">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[#1B4332] flex items-center justify-center text-[#FAF9F6] font-semibold text-sm">
              S
            </span>
            <span className="font-semibold text-[#1B4332] tracking-tight text-base">
              Sylva<span className="text-[#74A18E] font-normal">Learn</span>
            </span>
          </Link>
          <span className="text-xs text-slate-500">Espace sécurisé</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <section className="w-full max-w-md bg-[#FAF9F6] border border-gray-200/90 rounded-3xl p-8 shadow-xs">
          <h1 className="text-2xl font-semibold text-[#1B4332] tracking-tight">
            {isLogin ? 'Connexion' : 'Créer un compte'}
          </h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            {isLogin
              ? 'Accédez à vos parcours d’apprentissage et générez-en de nouveaux.'
              : 'Quelques secondes suffisent pour commencer votre premier parcours.'}
          </p>

          {error && (
            <p
              role="alert"
              className="mt-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-medium text-red-700"
            >
              {error}
            </p>
          )}

          {message && (
            <p
              role="status"
              className="mt-5 rounded-xl bg-[#74A18E]/15 border border-[#74A18E]/40 px-4 py-3 text-xs font-medium text-[#1B4332]"
            >
              {message}
            </p>
          )}

          <form action={isLogin ? loginAction : signupAction} className="mt-6 space-y-4">
            {isLogin && next && <input type="hidden" name="next" value={next} />}

            {!isLogin && (
              <div className="space-y-1.5">
                <label htmlFor="fullName" className="block text-xs font-medium text-slate-600">
                  Nom complet <span className="text-slate-400">(facultatif)</span>
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#1B4332] focus:ring-2 focus:ring-[#74A18E]/30"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-medium text-slate-600">
                Adresse email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#1B4332] focus:ring-2 focus:ring-[#74A18E]/30"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-medium text-slate-600">
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
                minLength={isLogin ? undefined : 6}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#1B4332] focus:ring-2 focus:ring-[#74A18E]/30"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl text-sm font-medium bg-[#1B4332] text-[#FAF9F6] hover:bg-[#2D6A4F] active:scale-[0.99] transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4332]"
            >
              {isLogin ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            {isLogin ? (
              <>
                Pas encore de compte ?{' '}
                <Link href="/signup" className="font-medium text-[#1B4332] underline">
                  S’inscrire
                </Link>
              </>
            ) : (
              <>
                Déjà inscrit ?{' '}
                <Link href="/login" className="font-medium text-[#1B4332] underline">
                  Se connecter
                </Link>
              </>
            )}
          </p>
        </section>
      </main>
    </div>
  );
}
