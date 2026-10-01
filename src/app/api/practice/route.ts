import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { getPracticeQuestions, recordPracticeAnswer, getPracticeCount } from '@/lib/server/services/practiceService';
import { z } from 'zod';

const answerSchema = z.object({
  topicId: z.uuid(),
  questionId: z.uuid(),
  selectedAnswer: z.enum(['A', 'B', 'C', 'D']),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const topicId = searchParams.get('topicId');
    if (!topicId) return NextResponse.json({ error: 'topicId is required' }, { status: 400 });

    const user = await getCurrentUserSafe();
    const limit = Math.min(Number(searchParams.get('limit') || 10), 50);
    const offset = Math.max(Number(searchParams.get('offset') || 0), 0);

    const [questions, total] = await Promise.all([
      getPracticeQuestions(topicId, user?.id ?? null, limit, offset),
      getPracticeCount(topicId),
    ]);

    return NextResponse.json({ questions, total, limit, offset });
  } catch (error: any) {
    console.error('Practice API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { topicId, questionId, selectedAnswer } = answerSchema.parse(body);
    const result = await recordPracticeAnswer(user.id, topicId, questionId, selectedAnswer);
    if (!result) return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (error: any) {
    if (error?.code === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Practice API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function getCurrentUserSafe() {
  try {
    const { getCurrentUser } = await import('@/lib/server/session');
    return getCurrentUser();
  } catch {
    return null;
  }
}
