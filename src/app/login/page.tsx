import { Suspense } from 'react';
import { connection } from 'next/server';
import { AuthForm } from '@/app/components/AuthForm';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function LoginContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const params = await searchParams;

  return (
    <AuthForm
      mode="login"
      error={first(params.error)}
      message={first(params.message)}
      next={first(params.next)}
    />
  );
}

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F3F4F6]" />}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}
