// Development seed data (PRD §36, Database doc §13). All people are fictional (@example.test).
// Fixed UUIDs keep the dataset stable across resets, which the e2e tests rely on.

export const ADMIN_ID = '00000000-0000-4000-8000-000000000001';
export const STUDENT_IDS = [
  '00000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000000012',
  '00000000-0000-4000-8000-000000000013',
  '00000000-0000-4000-8000-000000000014',
  '00000000-0000-4000-8000-000000000015',
];

export const SERIES = {
  fundamentals: '10000000-0000-4000-8000-000000000001',
  medsurg: '10000000-0000-4000-8000-000000000002',
  pharma: '10000000-0000-4000-8000-000000000003',
  community: '10000000-0000-4000-8000-000000000004',
  obg: '10000000-0000-4000-8000-000000000005',
};

export const DOCUMENT_IDS = [
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
];

export const users = [
  { id: ADMIN_ID, name: 'Platform Admin', email: 'admin@example.test', phone: '+919800000001', role: 'ADMIN' },
  { id: STUDENT_IDS[0], name: 'Asha Patil', email: 'student1@example.test', phone: '+919800000011' },
  { id: STUDENT_IDS[1], name: 'Rahul Deshmukh', email: 'student2@example.test', phone: '+919800000012' },
  { id: STUDENT_IDS[2], name: 'Meera Kulkarni', email: 'student3@example.test', phone: '+919800000013' },
  { id: STUDENT_IDS[3], name: 'Imran Shaikh', email: 'student4@example.test', phone: '+919800000014' },
  // No phone: exercises the Complete Profile flow.
  { id: STUDENT_IDS[4], name: 'Priya Nair', email: 'student5@example.test', phone: null },
];

const standardInstructions = [
  'Each question has exactly one correct answer.',
  'There is no negative marking.',
  'You can move between questions and mark any of them for review.',
  'The test submits automatically when the timer reaches zero.',
].join('\n');

export const series = [
  {
    id: SERIES.fundamentals, title: 'Fundamentals of Nursing — Mock Test 1',
    description: 'Core nursing concepts: vital signs, infection control, patient positioning and basic procedures.',
    is_free: true, price: 0, duration_minutes: 10, status: 'PUBLISHED',
  },
  {
    id: SERIES.medsurg, title: 'Medical-Surgical Nursing — Full Test',
    description: 'Exam-level questions on cardiac, respiratory, renal and post-operative nursing care.',
    is_free: false, price: 199, duration_minutes: 15, status: 'PUBLISHED',
  },
  {
    id: SERIES.pharma, title: 'Pharmacology Essentials',
    description: 'Drug classes, antidotes, dosage calculations and nursing considerations for high-alert medicines.',
    is_free: false, price: 199, duration_minutes: 12, status: 'PUBLISHED',
  },
  {
    id: SERIES.community, title: 'Community Health Nursing — Quick Practice',
    description: 'National health programmes, immunisation schedule and epidemiology basics.',
    is_free: true, price: 0, duration_minutes: 8, status: 'PUBLISHED',
  },
  {
    id: SERIES.obg, title: 'Obstetrics & Gynaecology Nursing',
    description: 'Antenatal, intranatal and postnatal care. Draft — questions under review.',
    is_free: false, price: 199, duration_minutes: 10, status: 'DRAFT',
  },
].map((s) => ({ ...s, instructions: standardInstructions }));

// [question, A, B, C, D, correct, explanation]
export const questions = {
  [SERIES.fundamentals]: [
    ['What is the normal adult resting respiratory rate?', '6–10 breaths/min', '12–20 breaths/min', '22–28 breaths/min', '30–40 breaths/min', 'B', 'A normal adult breathes 12–20 times per minute at rest.'],
    ['Which is the single most effective way to prevent hospital-acquired infection?', 'Wearing a mask', 'Hand hygiene', 'Isolation of all patients', 'Prophylactic antibiotics', 'B', 'Hand hygiene is the most effective measure to reduce cross-infection.'],
    ['A patient with dyspnoea is best placed in which position?', 'Trendelenburg', 'Prone', 'Fowler’s', 'Lithotomy', 'C', 'Fowler’s position lowers the diaphragm and eases breathing.'],
    ['Which site is preferred for measuring pulse during CPR in adults?', 'Radial', 'Carotid', 'Pedal', 'Temporal', 'B', 'The carotid pulse persists when peripheral pulses are absent.'],
    ['The first step of the nursing process is:', 'Planning', 'Diagnosis', 'Assessment', 'Evaluation', 'C', 'Assessment (data collection) always comes first.'],
    ['Normal adult body temperature (oral) is approximately:', '35.0 °C', '37.0 °C', '38.5 °C', '39.0 °C', 'B', 'Oral temperature averages about 37 °C (98.6 °F).'],
  ],
  [SERIES.medsurg]: [
    ['Which electrolyte imbalance is most associated with peaked T waves on ECG?', 'Hypokalaemia', 'Hyperkalaemia', 'Hyponatraemia', 'Hypocalcaemia', 'B', 'Hyperkalaemia classically causes tall, peaked T waves.'],
    ['The priority nursing action for a patient with suspected myocardial infarction is:', 'Obtain a chest X-ray', 'Administer oxygen and obtain a 12-lead ECG', 'Ambulate the patient', 'Encourage oral fluids', 'B', 'Oxygenation and early ECG diagnosis come first.'],
    ['After a thyroidectomy, which equipment should be kept at the bedside?', 'Tracheostomy set', 'Cardiac monitor only', 'Traction set', 'Nasogastric tube', 'A', 'Airway obstruction from oedema or haemorrhage is a key risk.'],
    ['Kussmaul breathing is characteristic of:', 'Diabetic ketoacidosis', 'Hypoglycaemia', 'Pneumothorax', 'Asthma', 'A', 'Deep rapid breathing compensates for metabolic acidosis in DKA.'],
    ['Which position is recommended immediately after a lumbar puncture?', 'High Fowler’s', 'Flat supine', 'Left lateral with head raised', 'Trendelenburg', 'B', 'Lying flat helps reduce post-lumbar-puncture headache.'],
    ['An early sign of hypoxia is:', 'Cyanosis', 'Restlessness', 'Bradycardia', 'Clubbing', 'B', 'Restlessness and anxiety appear before cyanosis.'],
  ],
  [SERIES.pharma]: [
    ['The antidote for heparin overdose is:', 'Vitamin K', 'Protamine sulphate', 'Naloxone', 'Flumazenil', 'B', 'Protamine sulphate neutralises heparin.'],
    ['Before administering digoxin, the nurse should check the:', 'Blood pressure', 'Apical pulse', 'Respiratory rate', 'Temperature', 'B', 'Withhold digoxin if the apical pulse is below 60/min in adults.'],
    ['Naloxone is used to reverse:', 'Benzodiazepines', 'Opioids', 'Warfarin', 'Insulin', 'B', 'Naloxone is an opioid antagonist.'],
    ['Which lab value is monitored for warfarin therapy?', 'aPTT', 'INR', 'Platelet count', 'Serum potassium', 'B', 'INR (derived from PT) monitors warfarin.'],
    ['A common side effect of ACE inhibitors is:', 'Dry cough', 'Hyperglycaemia', 'Tinnitus', 'Constipation', 'A', 'Bradykinin accumulation causes a persistent dry cough.'],
  ],
  [SERIES.community]: [
    ['BCG vaccine is given by which route?', 'Intramuscular', 'Subcutaneous', 'Intradermal', 'Oral', 'C', 'BCG is administered intradermally.'],
    ['The cold chain temperature for most vaccines is:', '−20 °C to −10 °C', '+2 °C to +8 °C', '+10 °C to +15 °C', '+15 °C to +25 °C', 'B', 'Most vaccines are stored between +2 °C and +8 °C.'],
    ['Oral rehydration solution primarily prevents:', 'Malnutrition', 'Dehydration', 'Fever', 'Worm infestation', 'B', 'ORS replaces fluid and electrolytes lost in diarrhoea.'],
    ['The incidence of a disease refers to:', 'All existing cases', 'New cases in a period', 'Deaths due to the disease', 'Recovered cases', 'B', 'Incidence counts new cases; prevalence counts all existing cases.'],
  ],
  [SERIES.obg]: [
    ['Normal fetal heart rate is:', '80–100 bpm', '110–160 bpm', '170–200 bpm', '60–80 bpm', 'B', 'The normal FHR baseline is 110–160 beats per minute.'],
    ['Naegele’s rule is used to calculate:', 'Gestational weight gain', 'Expected date of delivery', 'Fundal height', 'Apgar score', 'B', 'EDD = LMP + 9 months + 7 days.'],
    ['Lochia rubra typically lasts for:', '1–3 days', '10–14 days', '3–6 weeks', '6–8 weeks', 'A', 'Lochia rubra is red and lasts about 1–3 days postpartum.'],
    ['Magnesium sulphate is the drug of choice for:', 'Postpartum haemorrhage', 'Eclampsia', 'Preterm rupture of membranes', 'Anaemia in pregnancy', 'B', 'MgSO4 prevents and treats eclamptic seizures.'],
  ],
};

// AI-generated drafts awaiting admin review (5 per seeded document).
export const aiDrafts = [
  [
    ['The Apgar score is assessed at:', '1 and 5 minutes after birth', '10 and 20 minutes', 'Only at 1 hour', '24 hours after birth', 'A', 'Apgar is scored at 1 and 5 minutes.'],
    ['The hormone responsible for milk ejection is:', 'Prolactin', 'Oxytocin', 'Oestrogen', 'Progesterone', 'B', 'Oxytocin triggers the let-down reflex.'],
    ['Hegar’s sign is a:', 'Positive sign of pregnancy', 'Probable sign of pregnancy', 'Presumptive sign', 'Sign of labour', 'B', 'Softening of the lower uterine segment is a probable sign.'],
    ['Folic acid supplementation primarily prevents:', 'Neural tube defects', 'Cleft palate', 'Down syndrome', 'Anaemia of prematurity', 'A', 'Periconceptional folic acid reduces neural tube defects.'],
    ['The duration of the second stage of labour in a primigravida is about:', '10 minutes', '1–2 hours', '8–10 hours', '24 hours', 'B', 'The second stage lasts roughly 1–2 hours in primigravidae.'],
  ],
  [
    ['Physiological jaundice in a term newborn usually appears:', 'Within 24 hours', 'After 24 hours', 'After 3 weeks', 'At birth', 'B', 'Jaundice within 24 hours is pathological.'],
    ['Kangaroo mother care mainly helps with:', 'Thermoregulation', 'Vaccination', 'Jaundice treatment', 'Weight loss', 'A', 'Skin-to-skin contact keeps low-birth-weight babies warm.'],
    ['The recommended exclusive breastfeeding period is:', '2 months', '4 months', '6 months', '12 months', 'C', 'WHO recommends 6 months of exclusive breastfeeding.'],
    ['Engorgement of the breast is best managed by:', 'Stopping breastfeeding', 'Frequent feeding', 'Fluid restriction', 'Binding the breasts', 'B', 'Frequent emptying relieves engorgement.'],
    ['The first stool passed by a newborn is called:', 'Colostrum', 'Meconium', 'Vernix', 'Lanugo', 'B', 'Meconium is the first stool.'],
  ],
];

// status per student per series; the seed computes amounts from series prices.
export const purchases = [
  { user: 0, series: SERIES.medsurg, status: 'SUCCESS', order: 'order_seed_0001', payment: 'pay_seed_0001' },
  { user: 1, series: SERIES.pharma, status: 'SUCCESS', order: 'order_seed_0002', payment: 'pay_seed_0002' },
  { user: 2, series: SERIES.medsurg, status: 'FAILED', order: 'order_seed_0003', payment: null },
  { user: 3, series: SERIES.pharma, status: 'PENDING', order: 'order_seed_0004', payment: null },
  { user: 0, series: SERIES.pharma, status: 'CANCELLED', order: 'order_seed_0005', payment: null },
];

// answers are indexes into the series question list; null = unanswered.
export const attempts = [
  { user: 0, series: SERIES.fundamentals, daysAgo: 6, seconds: 410, answers: ['B', 'B', 'C', 'A', 'C', 'B'] },
  { user: 0, series: SERIES.medsurg, daysAgo: 2, seconds: 780, answers: ['B', 'B', 'A', 'C', null, 'B'] },
  { user: 1, series: SERIES.fundamentals, daysAgo: 4, seconds: 520, answers: ['A', 'B', 'C', 'B', null, 'B'] },
  { user: 1, series: SERIES.community, daysAgo: 1, seconds: 300, answers: ['C', 'B', 'B', 'A'] },
  { user: 2, series: SERIES.community, daysAgo: 0, seconds: null, answers: null, inProgress: true },
];
