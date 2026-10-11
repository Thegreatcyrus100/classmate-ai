export interface StudentProfile {
  uid: string;
  username: string;
  normalized_username: string;
  normalizedUsername: string;
  full_name: string;
  fullName: string;
  course_section: string;
  courseSection: string;
  email?: string;
  created_at: string;
  createdAt: string;
  updated_at: string;
  updatedAt: string;
}

export interface SimplifiedExplanation {
  concept: string;
  simpleExplanation: string;
  analogy?: string;
}

export interface KeyTerm {
  term: string;
  definition: string;
  importance?: string;
}

export interface ImportantPrinciple {
  title: string;
  description: string;
  formulaOrRule?: string;
  example?: string;
}

export interface PracticalExample {
  topic: string;
  scenario: string;
  solutionOrTakeaway: string;
}

export interface StepByStepGuide {
  processName: string;
  steps: string[];
}

export interface ComparisonTable {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface Mnemonic {
  targetConcept: string;
  mnemonicText: string;
  explanation: string;
}

export interface ExamTip {
  tip: string;
  keyFocus: string;
  commonMistake?: string;
}

export interface GlossaryItem {
  word: string;
  definition: string;
  pronunciationOrContext?: string;
}

export interface SourceReference {
  section: string;
  keyTakeaway: string;
  pageOrHeading?: string;
}

export interface ReviewerContent {
  title: string;
  tableOfContents: string[];
  lessonSummary: string;
  simplifiedExplanations: SimplifiedExplanation[];
  keyTerms: KeyTerm[];
  importantPrinciples: ImportantPrinciple[];
  practicalExamples: PracticalExample[];
  stepByStepGuides: StepByStepGuide[];
  comparisonTables: ComparisonTable[];
  mnemonics: Mnemonic[];
  examTips: ExamTip[];
  vocabularyGlossary: GlossaryItem[];
  sourceReferences: SourceReference[];
}

export interface StudyMaterial {
  id: string;
  ownerUid: string;
  roomId?: string; // empty string or roomId if shared
  title: string;
  fileType: string;
  originalFileName: string;
  fileSize: number;
  processingStatus: 'processing' | 'ready' | 'failed';
  extractedTextSnippet?: string;
  reviewerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Reviewer {
  id: string;
  ownerUid: string;
  materialId: string;
  roomId?: string;
  title: string;
  content: ReviewerContent;
  createdAt: string;
  updatedAt: string;
}

export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'identification'
  | 'fill_in_the_blank'
  | 'matching'
  | 'short_answer';

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[]; // For multiple choice & true_false
  correctAnswer: string;
  acceptableAnswers?: string[]; // For identification / fill_in_the_blank
  matchingPairs?: { prompt: string; match: string }[]; // For matching type
  explanation: string;
  sourceRef?: string;
}

export interface Quiz {
  id: string;
  ownerUid: string;
  materialId: string;
  roomId?: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'comprehensive';
  timeLimitMinutes?: number; // 0 or undefined means untimed
  questions: QuizQuestion[];
  createdAt: string;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  studentUid: string;
  materialId: string;
  materialTitle: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeSpentSeconds: number;
  answers: Record<string, string>; // questionId -> studentAnswer
  results: Record<string, boolean>; // questionId -> isCorrect
  weakTopics: string[];
  completedAt: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  category?: string;
  hint?: string;
  mastered: boolean;
  difficultyRating?: 'easy' | 'medium' | 'hard';
  lastReviewedAt?: string;
}

export interface FlashcardDeck {
  id: string;
  ownerUid: string;
  materialId: string;
  roomId?: string;
  title: string;
  cards: Flashcard[];
  createdAt: string;
  updatedAt: string;
}

export interface StudyRoom {
  id: string;
  roomName: string;
  code: string;
  ownerUid: string;
  ownerName: string;
  description: string;
  announcements?: {
    id: string;
    text: string;
    authorName: string;
    createdAt: string;
  }[];
  memberCount: number;
  createdAt: string;
}

export interface RoomMember {
  id: string;
  roomId: string;
  studentUid: string;
  studentName: string;
  courseSection: string;
  role: 'owner' | 'moderator' | 'member';
  joinedAt: string;
}

export interface RoomMessage {
  id: string;
  roomId: string;
  senderUid: string;
  senderName: string;
  senderCourse: string;
  content: string;
  createdAt: string;
}
