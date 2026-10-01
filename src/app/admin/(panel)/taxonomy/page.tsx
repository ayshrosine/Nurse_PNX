import type { Metadata } from 'next';
import { listPrograms } from '@/lib/server/services/catalogService';
import TaxonomyManager from './components/TaxonomyManager';
import SubjectManager from './components/SubjectManager';
import { prisma } from '@/lib/server/db';

export const metadata: Metadata = { title: 'Taxonomy' };
export const dynamic = 'force-dynamic';

export default async function AdminTaxonomyPage() {
  const programs = await listPrograms();
  const rawSubjects = await prisma.subjects.findMany({
    orderBy: { name: 'asc' },
    include: {
      program_subjects: { select: { program_id: true } },
      _count: { select: { topics: true } }
    }
  });

  const subjects = rawSubjects.map(s => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    icon: s.icon,
    description: s.description,
    topic_count: s._count.topics,
    question_count: 0,
    programs: s.program_subjects.map(ps => ps.program_id)
  }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Exams & Subjects (Taxonomy)</h1>
          <p className="mt-1 text-sm text-muted">Manage exams, subjects, and link them together.</p>
        </div>
      </div>
      <div className="mt-6">
        <TaxonomyManager initialPrograms={programs} />
        <SubjectManager programs={programs} subjects={subjects} />
      </div>
    </div>
  );
}
