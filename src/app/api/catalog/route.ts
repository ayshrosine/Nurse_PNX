import { NextResponse } from 'next/server';
import { CatalogService } from '@/lib/server/services/catalogService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const programCode = searchParams.get('program');

    if (programCode) {
      const hierarchy = await CatalogService.getProgramWithHierarchy(programCode);
      if (!hierarchy) {
        return NextResponse.json({ error: 'Program not found' }, { status: 404 });
      }
      return NextResponse.json(hierarchy);
    }

    const programs = await CatalogService.getPrograms();
    return NextResponse.json(programs);
  } catch (error: any) {
    console.error('Catalog API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
