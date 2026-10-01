import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { toggleBookmark } from '@/lib/server/services/bookmarkService';
import { z } from 'zod';

const bookmarkSchema = z.object({
  questionId: z.uuid(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { questionId } = bookmarkSchema.parse(body);
    const added = await toggleBookmark(user.id, questionId);
    return NextResponse.json({ bookmarked: added });
  } catch (error: any) {
    if (error?.code === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Bookmark API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
