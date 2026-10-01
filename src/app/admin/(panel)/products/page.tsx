import type { Metadata } from 'next';
import { Card, Table, Th, Td } from '@/components/ui';
import { listActiveProducts } from '@/lib/server/services/productService';
import { formatMoney } from '@/lib/format';

export const metadata: Metadata = { title: 'Products' };
export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  const products = await listActiveProducts();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="mt-1 text-sm text-muted">Manage packs, bundles, and pricing.</p>
        </div>
      </div>

      <Card className="mt-6">
        <Table>
          <thead>
            <tr>
              <Th>Product</Th>
              <Th>Type</Th>
              <Th className="text-right">Price</Th>
              <Th className="text-right">MRP</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <Td className="font-medium text-ink">{p.name}</Td>
                <Td><span className="rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700">{p.type}</span></Td>
                <Td className="text-right tabular-nums">{formatMoney(p.price_paise / 100, 'INR')}</Td>
                <Td className="text-right tabular-nums text-muted line-through">{formatMoney(p.mrp_paise / 100, 'INR')}</Td>
                <Td>{p.active ? 'Active' : 'Inactive'}</Td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <Td colSpan={5} className="py-8 text-center text-muted">
                  No active products found.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
      
      <p className="mt-6 text-sm text-muted">Note: Full CRUD management for Products is in development. You can currently edit these directly in the database.</p>
    </div>
  );
}
