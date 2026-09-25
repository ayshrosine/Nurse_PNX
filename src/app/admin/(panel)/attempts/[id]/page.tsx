import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, StatusBadge } from '@/components/ui';
import { AdminHeader } from '@/components/admin/shared';
import { ScoreSummary, QuestionReview } from '@/components/results/ResultView';
import { getResult } from '@/lib/server/services/attemptService';
import { requireAdminPage } from '@/lib/server/session';
import { queryOne } from '@/lib/server/db';
import { formatDateTime } from '@/lib/format';
import { uuidSchema } from '@/lib/validation';
import type { Attempt } from '@/types';

export const metadata = { title: 'Attempt' };

export default async function AdminAttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const admin = await requireAdminPage();
  const base = await queryOne<Attempt & { user_name: string; user_email: string; test_title: string }>(
    `SELECT a.*, u.name AS user_name, u.email AS user_email, ts.title AS test_title
       FROM attempts a JOIN users u ON u.id = a.user_id JOIN test_series ts ON ts.id = a.test_series_id WHERE a.id = $1`,
    [id],
  );
  if (!base) notFound();

  const header = (
    <AdminHeader
      back={{ href: '/admin/attempts', label: 'Attempts' }}
      title={<span className="flex items-center gap-3">Attempt <StatusBadge status={base.status} /></span>}
      description={<>By <Link href={`/admin/users/${base.user_id}`} className="text-brand-600 hover:underline">{base.user_name}</Link> ({base.user_email}) · started {formatDateTime(base.started_at)}</>}
    />
  );

  if (base.status !== 'COMPLETED') {
    return (
      <>
        {header}
        <Card className="p-6 text-sm text-muted">This attempt has not been submitted, so there is no score or answer review yet. Test: {base.test_title}.</Card>
      </>
    );
  }
  const result = await getResult(admin, id);
  return (
    <div className="max-w-4xl">
      {header}
      <ScoreSummary result={result} />
      <h2 className="mb-4 mt-8 text-lg font-semibold">Answers</h2>
      <QuestionReview result={result} />
    </div>
  );
}
