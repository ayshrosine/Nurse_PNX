import type { Metadata } from 'next';
import { listPrograms } from '@/lib/server/services/catalogService';
import TaxonomyManager from './components/TaxonomyManager';

export const metadata: Metadata = { title: 'Taxonomy' };
export const dynamic = 'force-dynamic';

export default async function AdminTaxonomyPage() {
  const programs = await listPrograms();

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
      </div>
    </div>
  );
}
