import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { auth } from './auth';
import { findById } from './services/userService';
import { Errors, ApiError } from '../errors';
import type { User } from '@/types';

/**
 * The authenticated user, re-read from Postgres on every request (cached per request).
 * The signed session cookie only identifies *who*; role and status always come from the database,
 * so demoting or suspending a user takes effect immediately.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return null;
  const user = await findById(uid);
  if (!user || user.status !== 'ACTIVE') return null;
  return user;
});

// ---- API guards (throw ApiError → standard error envelope)

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthorized();
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw Errors.forbidden('Admin access required');
  return user;
}

/** Students must have a phone number before starting tests or paying (PRD §5.3, §25). */
export async function requireCompleteProfile(): Promise<User> {
  const user = await requireUser();
  if (!user.phone && user.role !== 'ADMIN') {
    throw new ApiError(403, 'PROFILE_INCOMPLETE', 'Please add your phone number to continue');
  }
  return user;
}

// ---- Page guards (redirect instead of throwing)

export function safeNext(next: string | null | undefined, fallback = '/dashboard'): string {
  // Only same-site relative paths: blocks open redirects like //evil.com or https://evil.com.
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}

export async function requireUserPage(currentPath: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  return user;
}

export async function requireStudentPage(currentPath: string): Promise<User> {
  const user = await requireUserPage(currentPath);
  if (!user.phone && user.role !== 'ADMIN') redirect(`/complete-profile?next=${encodeURIComponent(currentPath)}`);
  return user;
}

export async function requireAdminPage(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  if (user.role !== 'ADMIN') redirect('/admin/login?error=forbidden');
  return user;
}
