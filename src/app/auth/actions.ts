'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === 'string' ? value : '';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/app/dashboard';
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = safeNext(formData.get('next'));

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent('Email et mot de passe requis.')}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const message =
      error.code === 'email_not_confirmed'
        ? 'Confirmez votre adresse e-mail depuis le lien reçu avant de vous connecter.'
        : error.code === 'invalid_credentials'
          ? 'Adresse e-mail ou mot de passe incorrect. Vérifiez aussi que le compte a bien été créé.'
          : 'Connexion impossible pour le moment. Réessayez et vérifiez la configuration Auth de Supabase.';

    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  redirect(next);
}

export async function signupAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('fullName') ?? '').trim();

  if (!email || password.length < 6) {
    redirect(
      `/signup?error=${encodeURIComponent('Email valide et mot de passe de 6 caractères minimum requis.')}`
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName || null } },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  if (!data.session) {
    redirect(
      `/login?message=${encodeURIComponent('Inscription reçue. Ouvrez le lien de confirmation envoyé par e-mail avant de vous connecter. Vérifiez aussi vos courriers indésirables.')}`
    );
  }

  redirect('/app/dashboard');
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
