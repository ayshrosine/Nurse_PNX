const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding detailed data for Nursing Level Up...');

  // 1. Create Users (Admin & Student)
  const admin = await prisma.users.upsert({
    where: { email: 'admin@nursinglevelup.com' },
    update: {},
    create: {
      email: 'admin@nursinglevelup.com',
      name: 'Smita Bisen (Admin)',
      role: 'ADMIN',
      phone: '9999999999'
    }
  });

  const student = await prisma.users.upsert({
    where: { email: 'student@example.com' },
    update: {},
    create: {
      email: 'student@example.com',
      name: 'Nursing Student',
      role: 'STUDENT',
      phone: '8888888888'
    }
  });

  // 2. Create Exams (Programs)
  const examsData = [
    { code: 'NORCET', name: 'AIIMS NORCET 2025', slug: 'norcet-2025', icon: '🏥' },
    { code: 'NCLEX', name: 'NCLEX-RN', slug: 'nclex-rn', icon: '🌎' },
    { code: 'CHO', name: 'Community Health Officer', slug: 'cho', icon: '🩺' },
    { code: 'RRB', name: 'RRB Staff Nurse', slug: 'rrb-nurse', icon: '🚆' }
  ];

  const exams = [];
  for (const ex of examsData) {
    const created = await prisma.programs.upsert({
      where: { code: ex.code },
      update: {},
      create: { ...ex, sort_order: exams.length }
    });
    exams.push(created);
  }

  // 3. Create Global Subjects
  const subjectsData = [
    { name: 'Pharmacology', slug: 'pharmacology', icon: '💊' },
    { name: 'Medical Surgical Nursing', slug: 'med-surg', icon: '🫀' },
    { name: 'Fundamentals of Nursing', slug: 'fundamentals', icon: '🌡️' },
    { name: 'Obstetrics & Gynecology (OBG)', slug: 'obg', icon: '👶' },
    { name: 'Pediatric Nursing', slug: 'pediatrics', icon: '🍼' },
    { name: 'Psychiatric Nursing', slug: 'psychiatry', icon: '🧠' },
    { name: 'Community Health Nursing', slug: 'community-health', icon: '🏡' }
  ];

  const subjects = [];
  for (const sub of subjectsData) {
    const created = await prisma.subjects.upsert({
      where: { slug: sub.slug },
      update: {},
      create: sub
    });
    subjects.push(created);
  }

  // 4. Link Subjects to Exams
  for (const exam of exams) {
    for (const subject of subjects) {
      await prisma.program_subjects.upsert({
        where: {
          program_id_subject_id: { program_id: exam.id, subject_id: subject.id }
        },
        update: {},
        create: { program_id: exam.id, subject_id: subject.id }
      });
    }
  }

  // 5. Assign User to an Exam
  await prisma.user_programs.upsert({
    where: { user_id_program_id: { user_id: student.id, program_id: exams[0].id } },
    update: {},
    create: { user_id: student.id, program_id: exams[0].id, is_primary: true }
  });

  // 6. Create Topics for Medical Surgical Nursing
  const msSubject = subjects.find(s => s.slug === 'med-surg');
  const topicsData = [
    { name: 'Cardiovascular System', slug: 'cvs' },
    { name: 'Respiratory System', slug: 'respiratory' },
    { name: 'Gastrointestinal System', slug: 'gi-system' },
    { name: 'Nervous System', slug: 'nervous' },
    { name: 'Endocrine System', slug: 'endocrine' }
  ];

  const topics = [];
  if (msSubject) {
    for (const top of topicsData) {
      // Upsert topic (no unique constraint on slug globally, so we check first or just create if we wipe DB usually. But let's findFirst)
      let topic = await prisma.topics.findFirst({ where: { slug: top.slug, subject_id: msSubject.id }});
      if (!topic) {
        topic = await prisma.topics.create({
          data: { name: top.name, slug: top.slug, subject_id: msSubject.id }
        });
      }
      topics.push(topic);
    }
  }

  // 7. Create a Free Test Series for NORCET
  let testSeries = await prisma.test_series.findFirst({ where: { slug: 'norcet-grand-test' }});
  if (!testSeries) {
    testSeries = await prisma.test_series.create({
      data: {
        title: 'NORCET 2025 Grand Mock Test Series',
        slug: 'norcet-grand-test',
        description: 'Comprehensive mock tests based on latest AIIMS pattern.',
        test_type: 'MOCK_TEST',
        program_id: exams[0].id,
        status: 'PUBLISHED',
        is_free: true,
        price: 0,
        duration_minutes: 180
      }
    });
  }

  // 8. Create a PYQ Exam Paper
  let pyqPaper = await prisma.exam_papers.findFirst({ where: { exam_name: 'NORCET', exam_year: 2023 }});
  if (!pyqPaper) {
    pyqPaper = await prisma.exam_papers.create({
      data: {
        exam_name: 'NORCET',
        exam_year: 2023,
        shift: 'Morning',
        program_id: exams[0].id,
        source_type: 'OFFICIAL',
        total_questions: 100
      }
    });
  }

  // 9. Create Sample Questions
  const questionsData = [
    {
      text: 'Which of the following is the most common cause of right-sided heart failure?',
      options: ['Left-sided heart failure', 'Cor pulmonale', 'Pulmonary embolism', 'Mitral stenosis'],
      correct_option_index: 0,
      explanation: 'Left-sided heart failure is the most common cause of right-sided heart failure.',
      topic_id: topics[0]?.id // CVS
    }
  ];

  for (let i = 0; i < questionsData.length; i++) {
    const q = questionsData[i];
    let existingQ = await prisma.questions.findFirst({ where: { question_text: q.text } });
    if (!existingQ) {
      existingQ = await prisma.questions.create({
        data: {
          test_series_id: testSeries.id,
          question_text: q.text,
          option_a: q.options[0],
          option_b: q.options[1],
          option_c: q.options[2],
          option_d: q.options[3],
          correct_answer: ['A','B','C','D'][q.correct_option_index],
          explanation: q.explanation,
          question_order: i + 1,
          difficulty: 2,
          topic_id: q.topic_id,
          exam_paper_id: pyqPaper.id,
          paper_qno: i + 1,
          review_status: 'APPROVED',
          source: 'MANUAL'
        }
      });
      // Link to Exam
      await prisma.question_programs.create({
        data: { question_id: existingQ.id, program_id: exams[0].id }
      });
      
      // Add to test series ordering
      await prisma.test_series_questions.create({
        data: { test_series_id: testSeries.id, question_id: existingQ.id, position: i + 1 }
      });
    }
  }

  // 10. Create a Daily Quiz for NORCET
  const today = new Date();
  today.setHours(0,0,0,0);
  
  await prisma.daily_quizzes.upsert({
    where: { program_id_subject_id_quiz_date: { program_id: exams[0].id, subject_id: msSubject.id, quiz_date: today } },
    update: {},
    create: {
      program_id: exams[0].id,
      subject_id: msSubject.id,
      quiz_date: today,
      test_series_id: testSeries.id
    }
  });

  console.log('Seeding completed successfully! 🎉');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
