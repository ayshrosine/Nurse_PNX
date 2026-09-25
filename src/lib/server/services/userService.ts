import 'server-only';
import { query, queryOne } from '../db';
import type { User } from '@/types';

const USER_COLUMNS = 'id, google_id, name, email, phone, role, status, created_at, updated_at, last_login_at';

export async function findById(id: string) {
  return queryOne<User>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
}

export async function findByGoogleId(googleId: string) {
  return queryOne<User>(`SELECT ${USER_COLUMNS} FROM users WHERE google_id = $1`, [googleId]);
}

export async function findByEmail(email: string) {
  return queryOne<User>(`SELECT ${USER_COLUMNS} FROM users WHERE email = $1`, [email]);
}

/**
 * Resolves a verified Google identity to a users row (PRD §26–27).
 * - Match on google_id first; otherwise link a pre-provisioned row with the same verified email.
 * - New users are ALWAYS created as STUDENT. No input to this function can set a role.
 * Returns null when the sign-in must be refused.
 */
export async function upsertFromGoogle(identity: { googleId: string; email: string; name: string }) {
  const byGoogle = await findByGoogleId(identity.googleId);
  if (byGoogle) {
    return queryOne<User>(`UPDATE users SET last_login_at = now() WHERE id = $1 RETURNING ${USER_COLUMNS}`, [
      byGoogle.id,
    ]);
  }
  const byEmail = await findByEmail(identity.email);
  if (byEmail) {
    // A different Google account already owns this email: refuse rather than silently re-link.
    if (byEmail.google_id && byEmail.google_id !== identity.googleId) return null;
    return queryOne<User>(
      `UPDATE users SET google_id = $2, last_login_at = now() WHERE id = $1 RETURNING ${USER_COLUMNS}`,
      [byEmail.id, identity.googleId],
    );
  }
  return queryOne<User>(
    `INSERT INTO users (google_id, name, email, role, last_login_at)
     VALUES ($1, $2, $3, 'STUDENT', now()) RETURNING ${USER_COLUMNS}`,
    [identity.googleId, identity.name.slice(0, 200) || identity.email.split('@')[0], identity.email],
  );
}

/** Development-only sign-in (see auth.ts). Finds by email or creates a STUDENT, never an admin. */
export async function upsertForDevLogin(email: string, name?: string) {
  const existing = await findByEmail(email);
  if (existing) {
    return queryOne<User>(`UPDATE users SET last_login_at = now() WHERE id = $1 RETURNING ${USER_COLUMNS}`, [
      existing.id,
    ]);
  }
  return queryOne<User>(
    `INSERT INTO users (name, email, role, last_login_at) VALUES ($1, $2, 'STUDENT', now()) RETURNING ${USER_COLUMNS}`,
    [name?.trim() || email.split('@')[0], email],
  );
}

export async function updatePhone(userId: string, phone: string) {
  return queryOne<User>(`UPDATE users SET phone = $2 WHERE id = $1 RETURNING ${USER_COLUMNS}`, [userId, phone]);
}

export async function isPhoneTaken(phone: string, exceptUserId: string) {
  const rows = await query(`SELECT 1 FROM users WHERE phone = $1 AND id <> $2 LIMIT 1`, [phone, exceptUserId]);
  return rows.length > 0;
}
