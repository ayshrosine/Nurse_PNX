import fs from 'fs';

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

// Replace daily_quizzes
schema = schema.replace(
  /model daily_quizzes \{[\s\S]*?\}/,
  `model daily_quizzes {
  id             String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  program_id     String       @db.Uuid
  subject_id     String?      @db.Uuid
  quiz_date      DateTime     @db.Date
  source         String       @default("SCHEDULED")
  test_series_id String?      @db.Uuid
  access_tier    String       @default("FREE")
  created_at     DateTime     @default(now()) @db.Timestamptz(6)
  programs       programs     @relation(fields: [program_id], references: [id], onDelete: Cascade)
  subjects       subjects?    @relation(fields: [subject_id], references: [id], onDelete: Cascade)
  test_series    test_series? @relation(fields: [test_series_id], references: [id], onDelete: SetNull)

  @@unique([program_id, subject_id, quiz_date], map: "uq_daily_quizzes")
}`
);

// Append new models
const newModels = `
model user_programs {
  user_id    String   @db.Uuid
  program_id String   @db.Uuid
  is_primary Boolean  @default(false)
  created_at DateTime @default(now()) @db.Timestamptz(6)
  users      users    @relation(fields: [user_id], references: [id], onDelete: Cascade)
  programs   programs @relation(fields: [program_id], references: [id], onDelete: Cascade)

  @@id([user_id, program_id])
}

model question_programs {
  question_id String    @db.Uuid
  program_id  String    @db.Uuid
  questions   questions @relation(fields: [question_id], references: [id], onDelete: Cascade)
  programs    programs  @relation(fields: [program_id], references: [id], onDelete: Cascade)

  @@id([question_id, program_id])
}

model streaks {
  user_id        String   @db.Uuid
  program_id     String   @db.Uuid
  current        Int      @default(0)
  best           Int      @default(0)
  last_quiz_date DateTime @db.Date
  users          users    @relation(fields: [user_id], references: [id], onDelete: Cascade)
  programs       programs @relation(fields: [program_id], references: [id], onDelete: Cascade)

  @@id([user_id, program_id])
}
`;

if (!schema.includes('model user_programs')) {
  schema += newModels;
}

// Ensure relations are linked back on programs
if (!schema.includes('user_programs user_programs[]')) {
  schema = schema.replace(
    /model programs \{[\s\S]*?test_series\s+test_series\[\]\n\}/,
    match => match.replace(
      '}',
      `  daily_quizzes     daily_quizzes[]\n  user_programs     user_programs[]\n  question_programs question_programs[]\n  streaks           streaks[]\n}`
    )
  );
}
// Link user_programs in users
if (!schema.includes('user_programs user_programs[]')) {
  schema = schema.replace(
    /model users \{[\s\S]*?user_answers\s+user_answers\[\]\n\}/,
    match => match.replace(
      '}',
      `  user_programs user_programs[]\n  streaks streaks[]\n}`
    )
  );
}

// Link question_programs in questions
if (!schema.includes('question_programs question_programs[]')) {
  schema = schema.replace(
    /model questions \{[\s\S]*?user_answers\s+user_answers\[\]\n/,
    match => match + `  question_programs     question_programs[]\n`
  );
}

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Schema updated successfully');
