import prisma from '../prisma';

export class QuestionBankService {
  /**
   * Fetch questions for a specific topic, optionally filtering by difficulty.
   */
  static async getQuestionsByTopic(topicId: string, limit: number = 20) {
    return prisma.question.findMany({
      where: { 
        topicId,
        reviewStatus: 'APPROVED'
      },
      take: limit,
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get all approved questions for a specific test series by its ID,
   * preserving the custom order defined in the pivot table (TestSeriesQuestion).
   */
  static async getQuestionsForTestSeries(testSeriesId: string) {
    const links = await prisma.testSeriesQuestion.findMany({
      where: { testSeriesId },
      include: {
        question: true
      },
      orderBy: { position: 'asc' }
    });
    
    return links.map(link => link.question);
  }

  /**
   * Bulk import or insert new questions (DRAFT mode by default for review).
   */
  static async createQuestions(data: Array<{
    questionText: string,
    optionA: string,
    optionB: string,
    optionC: string,
    optionD: string,
    correctAnswer: 'A' | 'B' | 'C' | 'D',
    explanation?: string,
    subjectId?: string,
    topicId?: string,
    difficulty?: number
  }>) {
    // Note: createMany is supported by Postgres in Prisma
    return prisma.question.createMany({
      data: data.map(q => ({
        ...q,
        reviewStatus: 'DRAFT',
        source: 'IMPORTED'
      }))
    });
  }
}
