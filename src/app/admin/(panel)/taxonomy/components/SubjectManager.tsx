'use client';

import { useState } from 'react';
import { Card, Button, Input, Table, Th, Td } from '@/components/ui';
import { createSubject, linkSubjectToProgram, unlinkSubjectFromProgram } from '../actions';
import type { ProgramRow, SubjectRow } from '@/lib/server/services/catalogService';

export default function SubjectManager({ 
  programs, 
  subjects 
}: { 
  programs: ProgramRow[], 
  subjects: (SubjectRow & { programs: string[] })[] 
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', slug: '', icon: '' });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await createSubject({ ...formData });
      setIsCreating(false);
      setFormData({ name: '', slug: '', icon: '' });
    } catch (err) {
      alert('Error creating subject');
    }
    setLoading(false);
  }

  async function handleToggleLink(programId: string, subjectId: string, isLinked: boolean) {
    try {
      if (isLinked) {
        await unlinkSubjectFromProgram(programId, subjectId);
      } else {
        await linkSubjectToProgram(programId, subjectId);
      }
    } catch (err) {
      alert('Error updating subject link');
    }
  }

  return (
    <div className="space-y-6 mt-12">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Global Subjects</h2>
        <Button onClick={() => setIsCreating(!isCreating)} variant="secondary">
          {isCreating ? 'Cancel' : 'Add New Subject'}
        </Button>
      </div>

      {isCreating && (
        <Card className="p-4 bg-muted/50 border border-border/50">
          <h3 className="font-semibold mb-4">Create New Subject</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm">Subject Name</label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Pharmacology" required />
            </div>
            <div>
              <label className="text-sm">Slug (URL)</label>
              <Input value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} placeholder="e.g. pharmacology" required />
            </div>
            <div>
              <label className="text-sm">Icon (Emoji)</label>
              <Input value={formData.icon} onChange={e => setFormData({ ...formData, icon: e.target.value })} placeholder="💊" />
            </div>
            <div className="col-span-2">
              <Button type="submit" disabled={loading}>Save Subject</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Subject</Th>
              <Th>Topics</Th>
              <Th>Assign to Exams</Th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={s.id}>
                <Td className="font-medium text-ink">{s.icon} {s.name}</Td>
                <Td>{s.topic_count}</Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    {programs.map(p => {
                      const isLinked = s.programs.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleToggleLink(p.id, s.id, isLinked)}
                          className={`px-2 py-1 text-xs rounded-md transition-colors ${
                            isLinked 
                              ? 'bg-brand-100 text-brand-700 hover:bg-red-100 hover:text-red-700' 
                              : 'bg-muted/50 text-muted hover:bg-brand-50 hover:text-brand-600'
                          }`}
                          title={isLinked ? `Remove from ${p.name}` : `Add to ${p.name}`}
                        >
                          {p.code} {isLinked ? '✓' : '+'}
                        </button>
                      );
                    })}
                  </div>
                </Td>
              </tr>
            ))}
            {subjects.length === 0 && (
              <tr>
                <Td colSpan={3} className="py-8 text-center text-muted">
                  No subjects found.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
