import { Suspense } from 'react';
import { connection } from 'next/server';
import { AuthForm } from '@/app/components/AuthForm';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function SignupContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const params = await searchParams;

  return <AuthForm mode="signup" error={first(params.error)} message={first(params.message)} />;
}

export default function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F3F4F6]" />}>
      <SignupContent searchParams={searchParams} />
    </Suspense>
  );
}
