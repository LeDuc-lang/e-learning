import { Suspense } from 'react';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { getCurrentUserWithProfile, isAdmin } from '@/lib/auth';
import UserHeader from '@/app/components/UserHeader';
import Generator from '@/app/components/Generator';

async function HomeContent() {
  await connection();

  const { user, profile } = await getCurrentUserWithProfile();

  if (!user) {
    redirect('/login');
  }

  return (
    <>
      <UserHeader currentPage="generator" isAdmin={isAdmin(profile)} />
      <Generator />
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F3F4F6]" />}>
      <HomeContent />
    </Suspense>
  );
}
