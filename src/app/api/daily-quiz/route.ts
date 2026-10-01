import { NextResponse } from 'next/server';
import { getTodaysQuiz, getDailyStreak } from '@/lib/server/services/dailyQuizService';
import { getCurrentUser } from '@/lib/server/session';

export async function GET() {
  try {
    const user = await getCurrentUser();
    const quiz = await getTodaysQuiz();
    const streak = user ? await getDailyStreak(user.id) : 0;
    return NextResponse.json({ quiz, streak, date: new Date().toISOString().slice(0, 10) });
  } catch (error: any) {
    console.error('Daily Quiz API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
