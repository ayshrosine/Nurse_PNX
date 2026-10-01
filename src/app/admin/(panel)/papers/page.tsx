import type { Metadata } from 'next';
import { Card, Table, Th, Td } from '@/components/ui';
import { listExamPapers } from '@/lib/server/services/catalogService';

export const metadata: Metadata = { title: 'PYQ Papers' };
export const dynamic = 'force-dynamic';

export default async function AdminPapersPage() {
  const papers = await listExamPapers();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">PYQ Papers</h1>
          <p className="mt-1 text-sm text-muted">Manage previous year question papers.</p>
        </div>
      </div>

      <Card className="mt-6">
        <Table>
          <thead>
            <tr>
              <Th>Exam Name</Th>
              <Th>Program</Th>
              <Th>Year</Th>
              <Th>Shift</Th>
              <Th className="text-right">Questions</Th>
            </tr>
          </thead>
          <tbody>
            {papers.map((p) => (
              <tr key={p.id}>
                <Td className="font-medium text-ink">{p.exam_name}</Td>
                <Td>{p.program_name}</Td>
                <Td>{p.exam_year}</Td>
                <Td>{p.shift ?? '—'}</Td>
                <Td className="text-right">{p.question_count}{p.total_questions ? ` / ${p.total_questions}` : ''}</Td>
              </tr>
            ))}
            {papers.length === 0 && (
              <tr>
                <Td colSpan={5} className="py-8 text-center text-muted">
                  No PYQ papers found.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
      
      <p className="mt-6 text-sm text-muted">Note: Full CRUD management for PYQ Papers is in development. You can currently add these directly in the database.</p>
    </div>
  );
}
