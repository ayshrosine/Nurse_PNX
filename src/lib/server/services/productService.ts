import 'server-only';
import { query, queryOne } from '../db';

// ---------------------------------------------------------------- Products

export interface ProductRow {
  id: string;
  name: string;
  type: string;
  slug: string | null;
  description: string | null;
  price_paise: number;
  mrp_paise: number;
  active: boolean;
  features: string[];
  sort_order: number;
}

export async function listActiveProducts(): Promise<ProductRow[]> {
  return query<ProductRow>(
    `SELECT id, name, type, slug, description, price_paise, mrp_paise, active, features, sort_order
       FROM products WHERE active = true ORDER BY sort_order, name`,
  );
}

export async function getProductBySlug(slug: string): Promise<ProductRow | null> {
  return queryOne<ProductRow>(
    `SELECT id, name, type, slug, description, price_paise, mrp_paise, active, features, sort_order
       FROM products WHERE slug = $1 AND active = true`,
    [slug],
  );
}

export async function getProductById(id: string): Promise<ProductRow | null> {
  return queryOne<ProductRow>(
    `SELECT id, name, type, slug, description, price_paise, mrp_paise, active, features, sort_order
       FROM products WHERE id = $1`,
    [id],
  );
}

// ---------------------------------------------------------------- Entitlements

export async function hasEntitlement(userId: string, productId: string): Promise<boolean> {
  const row = await queryOne(
    `SELECT 1 FROM entitlements WHERE user_id = $1 AND product_id = $2 AND (expires_at IS NULL OR expires_at > now())`,
    [userId, productId],
  );
  return row !== null;
}

export async function grantEntitlement(userId: string, productId: string, purchaseId?: string) {
  return query(
    `INSERT INTO entitlements (user_id, product_id, source_purchase_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, product_id) DO NOTHING`,
    [userId, productId, purchaseId ?? null],
  );
}

export async function listUserEntitlements(userId: string) {
  return query(
    `SELECT e.id, e.product_id, e.granted_at, e.expires_at,
            p.name AS product_name, p.type AS product_type, p.slug AS product_slug
       FROM entitlements e
       JOIN products p ON p.id = e.product_id
      WHERE e.user_id = $1 AND (e.expires_at IS NULL OR e.expires_at > now())
      ORDER BY e.granted_at DESC`,
    [userId],
  );
}

// ---------------------------------------------------------------- Coupons

export interface CouponRow {
  code: string;
  description: string | null;
  percent_off: number;
  max_uses: number | null;
  used: number;
  valid_till: string | null;
  active: boolean;
}

export async function validateCoupon(code: string): Promise<CouponRow | null> {
  return queryOne<CouponRow>(
    `SELECT code, description, percent_off, max_uses, used, valid_till, active
       FROM coupons
      WHERE code = $1
        AND active = true
        AND (valid_till IS NULL OR valid_till > now())
        AND (max_uses IS NULL OR used < max_uses)`,
    [code.toUpperCase().trim()],
  );
}

export async function useCoupon(code: string) {
  return query(`UPDATE coupons SET used = used + 1 WHERE code = $1`, [code]);
}

// ---------------------------------------------------------------- Resources (Notes PDFs)

export interface ResourceRow {
  id: string;
  title: string;
  description: string | null;
  subject_name: string | null;
  storage_key: string;
  file_type: string;
  size_bytes: number | null;
  is_free: boolean;
  download_count: number;
}

export async function listResources(subjectSlug?: string): Promise<ResourceRow[]> {
  if (subjectSlug) {
    return query<ResourceRow>(
      `SELECT r.id, r.title, r.description, s.name AS subject_name,
              r.storage_key, r.file_type, r.size_bytes, r.is_free, r.download_count
         FROM resources r
         LEFT JOIN subjects s ON s.id = r.subject_id
        WHERE s.slug = $1
        ORDER BY r.title`,
      [subjectSlug],
    );
  }
  return query<ResourceRow>(
    `SELECT r.id, r.title, r.description, s.name AS subject_name,
            r.storage_key, r.file_type, r.size_bytes, r.is_free, r.download_count
       FROM resources r
       LEFT JOIN subjects s ON s.id = r.subject_id
      ORDER BY s.sort_order, r.title`,
  );
}

export async function incrementDownload(resourceId: string) {
  return query(`UPDATE resources SET download_count = download_count + 1 WHERE id = $1`, [resourceId]);
}
