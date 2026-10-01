import type { Metadata } from 'next';
import { Card, Table, Th, Td } from '@/components/ui';
import { listPrograms } from '@/lib/server/services/catalogService';

export const metadata: Metadata = { title: 'Taxonomy' };
export const dynamic = 'force-dynamic';

export default async function AdminTaxonomyPage() {
  const programs = await listPrograms();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Taxonomy</h1>
          <p className="mt-1 text-sm text-muted">Manage programs, subjects, and topics.</p>
        </div>
      </div>

      <Card className="mt-6">
        <Table>
          <thead>
            <tr>
              <Th>Program</Th>
              <Th>Code</Th>
              <Th className="text-right">Subjects</Th>
              <Th className="text-right">Tests</Th>
            </tr>
          </thead>
          <tbody>
            {programs.map((p) => (
              <tr key={p.id}>
                <Td className="font-medium text-ink">{p.icon} {p.name}</Td>
                <Td className="font-mono text-xs">{p.code}</Td>
                <Td className="text-right">{p.subject_count}</Td>
                <Td className="text-right">{p.test_count}</Td>
              </tr>
            ))}
            {programs.length === 0 && (
              <tr>
                <Td colSpan={4} className="py-8 text-center text-muted">
                  No programs found. Run the database seed to add default taxonomy.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
      
      <p className="mt-6 text-sm text-muted">Note: Full CRUD management for Taxonomy is in development. You can currently edit these directly in the database.</p>
    </div>
  );
}
