import 'server-only';
import { query, type Queryable } from '../db';

export type AuditAction =
  | 'TEST_CREATED' | 'TEST_UPDATED' | 'TEST_PUBLISHED' | 'TEST_UNPUBLISHED' | 'TEST_ARCHIVED' | 'TEST_DELETED'
  | 'QUESTION_CREATED' | 'QUESTION_UPDATED' | 'QUESTION_DELETED' | 'QUESTION_REJECTED' | 'QUESTIONS_REORDERED'
  | 'QUESTION_IMPORTED' | 'DOCUMENT_UPLOADED' | 'DOCUMENT_EXTRACTED' | 'DOCUMENT_GENERATED' | 'DOCUMENT_APPROVED'
  | 'SETTINGS_UPDATED' | 'USER_STATUS_CHANGED';

export async function logAudit(
  adminId: string,
  action: AuditAction,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
  db?: Queryable,
) {
  await query(
    `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, metadata) VALUES ($1,$2,$3,$4,$5)`,
    [adminId, action, entityType, entityId, metadata ?? null],
    db,
  );
}

export async function listForEntity(entityType: string, entityId: string) {
  return query<{ id: string; action: string; admin_name: string | null; metadata: unknown; created_at: string }>(
    `SELECT a.id, a.action, u.name AS admin_name, a.metadata, a.created_at
       FROM audit_logs a LEFT JOIN users u ON u.id = a.admin_id
      WHERE a.entity_type = $1 AND a.entity_id = $2
      ORDER BY a.created_at DESC LIMIT 50`,
    [entityType, entityId],
  );
}
