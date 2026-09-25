export type Role = 'STUDENT' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';
export type TestStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type AnswerOption = 'A' | 'B' | 'C' | 'D';
export type PurchaseStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
export type AttemptStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
export type ReviewStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
export type QuestionSource = 'MANUAL' | 'IMPORTED' | 'AI_GENERATED';
export type DocumentStatus =
  | 'UPLOADED' | 'EXTRACTING' | 'EXTRACTED' | 'EXTRACT_FAILED'
  | 'GENERATING' | 'GENERATED' | 'GENERATE_FAILED' | 'APPROVED';
export type AccessState = 'FREE' | 'LOGIN_REQUIRED' | 'PURCHASE_REQUIRED' | 'PURCHASED';

export interface User {
  id: string;
  google_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface TestSeries {
  id: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  is_free: boolean;
  duration_minutes: number;
  status: TestStatus;
  instructions: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  question_count: number;
}

/** Public catalog item: includes the viewer-specific access state computed server-side. */
export interface PublicTestSeries {
  id: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  is_free: boolean;
  duration_minutes: number;
  instructions: string | null;
  published_at: string | null;
  question_count: number;
  access: AccessState;
  has_access: boolean;
}

export interface Question {
  id: string;
  test_series_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: AnswerOption;
  explanation: string | null;
  question_order: number;
  source: QuestionSource;
  source_document_id: string | null;
  review_status: ReviewStatus;
  created_at: string;
  updated_at: string;
}

/** What a student receives when a test starts. No correct_answer / explanation fields exist on it. */
export interface StudentQuestion {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  question_order: number;
}

export interface Purchase {
  id: string;
  user_id: string;
  test_series_id: string;
  amount: number;
  currency: string;
  provider: 'RAZORPAY' | 'STRIPE';
  order_id: string;
  payment_id: string | null;
  status: PurchaseStatus;
  created_at: string;
  updated_at: string;
  test_title?: string;
  user_name?: string;
  user_email?: string;
}

export interface Attempt {
  id: string;
  user_id: string;
  test_series_id: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  total_questions: number;
  correct_answers: number | null;
  incorrect_answers: number | null;
  unanswered: number | null;
  percentage: number | null;
  time_taken_seconds: number | null;
  status: AttemptStatus;
  test_title?: string;
  user_name?: string;
  user_email?: string;
}

export interface ReviewItem {
  question_id: string;
  question_order: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: AnswerOption;
  explanation: string | null;
  selected_answer: AnswerOption | null;
  is_correct: boolean | null;
}

export interface AttemptResult extends Attempt {
  test_title: string;
  duration_minutes: number;
  review: ReviewItem[];
}

export interface Progress {
  tests_attempted: number;
  tests_completed: number;
  distinct_tests: number;
  average_percentage: number | null;
  best_percentage: number | null;
  total_questions_answered: number;
  accuracy: number | null;
  trend: { attempt_id: string; test_title: string; percentage: number; submitted_at: string }[];
}

export interface DocumentRow {
  id: string;
  test_series_id: string | null;
  uploaded_by: string;
  original_filename: string;
  file_type: 'PDF' | 'DOCX' | 'HTML';
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  status: DocumentStatus;
  extracted_text_key: string | null;
  ocr_provider: string | null;
  ai_provider: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  pending_count?: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PlatformSettings {
  ocr_provider: 'tesseract' | 'ocrspace';
  ai_provider: 'gemini' | 'groq';
  mcq_default_count: number;
}
