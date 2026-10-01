'use server';

import { prisma } from '@/lib/server/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const programSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  is_active: z.boolean().default(true),
  sort_order: z.number().default(0),
});

export async function createProgram(data: z.infer<typeof programSchema>) {
  const parsed = programSchema.parse(data);
  await prisma.programs.create({ data: parsed });
  revalidatePath('/admin/taxonomy');
}

export async function updateProgram(id: string, data: z.infer<typeof programSchema>) {
  const parsed = programSchema.parse(data);
  await prisma.programs.update({ where: { id }, data: parsed });
  revalidatePath('/admin/taxonomy');
}

export async function deleteProgram(id: string) {
  // Hard delete only if no dependencies. (Assuming Prisma handles cascade correctly or rejects if restricted)
  await prisma.programs.delete({ where: { id } });
  revalidatePath('/admin/taxonomy');
}

const subjectSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  icon: z.string().optional(),
  description: z.string().optional(),
});

export async function createSubject(data: z.infer<typeof subjectSchema>) {
  const parsed = subjectSchema.parse(data);
  await prisma.subjects.create({ data: parsed });
  revalidatePath('/admin/taxonomy');
}

export async function linkSubjectToProgram(program_id: string, subject_id: string) {
  await prisma.program_subjects.create({ data: { program_id, subject_id } });
  revalidatePath('/admin/taxonomy');
}

export async function unlinkSubjectFromProgram(program_id: string, subject_id: string) {
  await prisma.program_subjects.delete({ where: { program_id_subject_id: { program_id, subject_id } } });
  revalidatePath('/admin/taxonomy');
}
