'use client';

import { useState } from 'react';
import { Card, Button, Input, Table, Th, Td } from '@/components/ui';
import { createProgram, deleteProgram } from '../actions';
import type { ProgramRow } from '@/lib/server/services/catalogService';

export default function TaxonomyManager({ initialPrograms }: { initialPrograms: ProgramRow[] }) {
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', code: '', slug: '', icon: '' });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await createProgram({ ...formData, sort_order: 0, is_active: true });
      setIsCreating(false);
      setFormData({ name: '', code: '', slug: '', icon: '' });
    } catch (err) {
      alert('Error creating program');
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setIsCreating(!isCreating)} variant="primary">
          {isCreating ? 'Cancel' : 'Add New Exam (Program)'}
        </Button>
      </div>

      {isCreating && (
        <Card className="p-4 bg-muted/50 border border-border/50">
          <h3 className="font-semibold mb-4">Create New Exam</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm">Name</label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. NORCET 2024" required />
            </div>
            <div>
              <label className="text-sm">Code</label>
              <Input value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="e.g. NORCET" required />
            </div>
            <div>
              <label className="text-sm">Slug (URL)</label>
              <Input value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} placeholder="e.g. norcet-2024" required />
            </div>
            <div>
              <label className="text-sm">Icon (Emoji)</label>
              <Input value={formData.icon} onChange={e => setFormData({ ...formData, icon: e.target.value })} placeholder="🏥" />
            </div>
            <div className="col-span-2">
              <Button type="submit" disabled={loading}>Save Exam</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Exam Name</Th>
              <Th>Code</Th>
              <Th className="text-right">Subjects</Th>
              <Th className="text-right">Tests</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {initialPrograms.map((p) => (
              <tr key={p.id}>
                <Td className="font-medium text-ink">{p.icon} {p.name}</Td>
                <Td className="font-mono text-xs">{p.code}</Td>
                <Td className="text-right">{p.subject_count}</Td>
                <Td className="text-right">{p.test_count}</Td>
                <Td className="text-right">
                  <Button variant="danger" size="sm" onClick={async () => {
                    if (confirm('Delete this exam completely?')) {
                      await deleteProgram(p.id);
                    }
                  }}>Delete</Button>
                </Td>
              </tr>
            ))}
            {initialPrograms.length === 0 && (
              <tr>
                <Td colSpan={5} className="py-8 text-center text-muted">
                  No exams found. Add your first exam to begin.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
