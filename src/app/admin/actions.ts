'use server';

import { redirect } from 'next/navigation';
import { checkAiHealth, getAiConfigStatus } from '@/lib/ai';
import { getCurrentUserWithProfile, isAdmin } from '@/lib/auth';

export async function testAiService() {
  const { profile } = await getCurrentUserWithProfile();

  if (!isAdmin(profile)) {
    redirect('/app/dashboard');
  }

  const status = getAiConfigStatus();

  if (!status.configured) {
    redirect('/admin?ia=config');
  }

  const result = await checkAiHealth();

  redirect(`/admin?ia=${result.ok ? 'ok' : 'ko'}&latence=${result.latencyMs}`);
}
