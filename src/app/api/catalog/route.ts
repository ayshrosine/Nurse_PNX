import { NextResponse } from 'next/server';
import { getFullCatalog, listPrograms, listTestsFiltered } from '@/lib/server/services/catalogService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view');

    if (view === 'tree') {
      const catalog = await getFullCatalog();
      return NextResponse.json(catalog);
    }

    // Filtered test listing
    const programSlug = searchParams.get('program') ?? undefined;
    const subjectSlug = searchParams.get('subject') ?? undefined;
    const testType = searchParams.get('type') ?? undefined;
    const isFreeParam = searchParams.get('free');
    const isFree = isFreeParam === 'true' ? true : isFreeParam === 'false' ? false : undefined;

    if (programSlug || subjectSlug || testType || isFree !== undefined) {
      const tests = await listTestsFiltered({ programSlug, subjectSlug, testType, isFree });
      return NextResponse.json({ tests });
    }

    // Default: list all programs
    const programs = await listPrograms();
    return NextResponse.json({ programs });
  } catch (error: any) {
    console.error('Catalog API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
