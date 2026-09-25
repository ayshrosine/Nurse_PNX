import { AdminHeader } from '@/components/admin/shared';
import { TestSeriesForm } from '@/components/admin/TestSeriesForm';

export const metadata = { title: 'New test series' };

export default function CreateTestSeriesPage() {
  return (
    <div className="max-w-3xl">
      <AdminHeader back={{ href: '/admin/test-series', label: 'Test series' }} title="New test series" description="Question count is calculated automatically from approved questions." />
      <TestSeriesForm />
    </div>
  );
}
