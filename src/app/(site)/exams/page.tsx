import type { Metadata } from 'next';
import Link from 'next/link';
import { Container, Card } from '@/components/ui';
import { listPrograms } from '@/lib/server/services/catalogService';

export const metadata: Metadata = { title: 'Exams' };
export const dynamic = 'force-dynamic';

const PROGRAM_GRADIENTS: Record<string, string> = {
  norcet: 'from-brand-700 to-brand-500',
  esic: 'from-indigo-700 to-indigo-500',
  rrb: 'from-orange-700 to-orange-500',
  cho: 'from-emerald-700 to-emerald-500',
  'state-cet': 'from-violet-700 to-violet-500',
  'bsc-nursing': 'from-teal-700 to-teal-500',
  gnm: 'from-sky-700 to-sky-500',
};

import { requireUserPage } from '@/lib/server/session';

export default async function ExamsPage() {
  await requireUserPage('/exams');
  const programs = await listPrograms();

  return (
    <Container className="py-12 lg:py-16">
      <div className="animate-slide-up text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-200/60 bg-brand-50/60 px-4 py-1.5 text-xs font-medium text-brand-700">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-500 opacity-50" />
            <span className="relative inline-flex size-2 rounded-full bg-brand-500" />
          </span>
          Choose your exam
        </div>
        <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">Exam Preparation</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          Select your target exam to see subject-wise tests, mock tests, PYQs, and practice questions tailored for you.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {programs.map((p, i) => (
          <Link key={p.id} href={`/exams/${p.slug}`} className={`block group animate-slide-up stagger-${Math.min(i + 1, 6)}`}>
            <Card className="relative overflow-hidden p-0 card-hover h-full">
              <div className={`bg-gradient-to-br ${PROGRAM_GRADIENTS[p.slug] ?? 'from-brand-700 to-brand-500'} px-6 py-8 text-white`}>
                <span className="text-3xl">{p.icon}</span>
                <h2 className="mt-3 text-xl font-semibold">{p.name}</h2>
                {p.description && <p className="mt-1 text-sm text-white/80">{p.description}</p>}
              </div>
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex gap-4 text-sm text-muted">
                  <span>{p.subject_count} Subjects</span>
                  <span>{p.test_count} Tests</span>
                </div>
                <span className="text-sm font-medium text-brand-600 group-hover:text-brand-700 transition-colors">
                  Explore →
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </Container>
  );
}
