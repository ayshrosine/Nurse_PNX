import prisma from '../prisma';

/**
 * Service to manage and fetch the taxonomy catalog: Programs, Semesters, Subjects, and Topics.
 * 
 * According to SDLC Specs:
 * Taxonomy tree is generally heavily read and rarely updated, so in the future,
 * this can be cached in Redis (Upstash).
 */

export class CatalogService {
  /**
   * Fetch all programs available on the platform (e.g. NORCET, BSc Nursing, GNM)
   */
  static async getPrograms() {
    return prisma.program.findMany({
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Fetch a specific program by its slug/code with its nested structure
   */
  static async getProgramWithHierarchy(programCode: string) {
    return prisma.program.findUnique({
      where: { code: programCode },
      include: {
        semesters: {
          include: {
            semester: true
          }
        },
        subjects: {
          include: {
            subject: {
              include: {
                topics: true
              }
            }
          }
        }
      }
    });
  }

  /**
   * Fetch all subjects for a given program. If semesterId is provided, filters by semester.
   */
  static async getSubjects(programId: string, semesterId?: string) {
    const filters: any = { programId };
    if (semesterId) {
      filters.semesterId = semesterId;
    }
    
    return prisma.programSubject.findMany({
      where: filters,
      include: {
        subject: true
      }
    });
  }

  /**
   * Fetch the topic hierarchy for a specific subject
   */
  static async getTopicsBySubject(subjectId: string) {
    // Fetch all topics for the subject
    const allTopics = await prisma.topic.findMany({
      where: { subjectId },
      orderBy: { name: 'asc' }
    });

    // Structure them into a tree
    const topicMap = new Map();
    const roots: any[] = [];

    allTopics.forEach(t => {
      topicMap.set(t.id, { ...t, children: [] });
    });

    allTopics.forEach(t => {
      if (t.parentId) {
        const parent = topicMap.get(t.parentId);
        if (parent) {
          parent.children.push(topicMap.get(t.id));
        }
      } else {
        roots.push(topicMap.get(t.id));
      }
    });

    return roots;
  }
}
