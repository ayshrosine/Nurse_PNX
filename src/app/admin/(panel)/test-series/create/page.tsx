import { AdminHeader } from '@/components/admin/shared';
import { TestSeriesForm } from '@/components/admin/TestSeriesForm';
import { prisma } from '@/lib/server/db';

export const metadata = { title: 'New test series' };

export default async function CreateTestSeriesPage() {
  const [exams, subjects] = await Promise.all([
    prisma.programs.findMany({ orderBy: { sort_order: 'asc' } }),
    prisma.subjects.findMany({ orderBy: { name: 'asc' } })
  ]);
  
  return (
    <div className="max-w-3xl">
      <AdminHeader back={{ href: '/admin/test-series', label: 'Test series' }} title="New test series" description="Question count is calculated automatically from approved questions." />
      <TestSeriesForm exams={exams} subjects={subjects} />
    </div>
  );
}
