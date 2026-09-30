export type Backend = 'codex' | 'deepseek' | 'openai' | 'api';
export type ContextMode = 'screen' | 'file';
export interface PluginSettings {
  contextMode: ContextMode;
  learningMode: boolean;
  backend: Backend;
  codexPath: string;
  codexTimeoutSeconds: number;
  codexIgnoreUserConfig: boolean;
  deepseekModel: string;
  deepseekSecretName: string;
  deepseekThinking: boolean;
  openaiModel: string;
  openaiSecretName: string;
  apiUrl: string;
  apiModel: string;
  apiSecretName: string;
  apiTimeoutSeconds: number;
  streamingEnabled: boolean;
  saveQA: boolean;
  noteSaveMode: 'conversation' | 'answer' | 'off';
  qaFolder: string;
  qaAppendSource: boolean;
  qaAppendAnswer: boolean;
  learnerLevel: '';
  learnerBackground: string;
  answerDepth: boolean;
  answerExamples: boolean;
  profileWizardDone: boolean;
  memoryRecallEnabled: boolean;
  autoClassify: boolean;
  knowledgeFolder: string;
  classificationModel: string;
  classificationDailyLimit: number;
  learningDifficulty: number;
  learningReviewEnabled: boolean;
  showLauncher: boolean;
  screenshotMaxEdge: number;
  screenFollowCursor: boolean;
  previewScreenshot: boolean;
}
export interface ApiResponse {
  choices?: Array<{
    message?: { content?: string | Array<{ text?: string }> };
    delta?: { content?: string };
    finish_reason?: string | null;
  }>;
  error?: { message?: string };
}
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  replyTo?: string;
  error?: boolean;
  streaming?: boolean;
}
export interface ApiConfig { backend: Backend; url: string; model: string; headers: Record<string, string>; }
export interface RequestSnapshot {
  mode: ContextMode;
  source?: string;
  question: string;
  screenshot?: string;
  noteText?: string;
  partial?: boolean;
  history: Array<Pick<ChatMessage, 'role' | 'text'>>;
}
export type LearningPhase = 'explain' | 'apply' | 'teachback' | 'complete';
export type LearningCriterion = 'accuracy' | 'reasoning' | 'plainLanguage' | 'example';
export interface LearningCheck { result: 'pass' | 'retry' | 'unknown'; evidence: string; reason: string; }
export interface LearningState {
  reportId?: string;
  reviewId?: string;
  difficulty?: number;
  review?: { completedAt: number; dueAt: number; streak: number; delayedPasses: number };
  topic: string;
  phase: LearningPhase;
  challenge: string;
  revision: number;
  attempts: number;
  gaps: string[];
  source: { mode: 'file'; path: string; text: string; partial: boolean } | { mode: 'screen' } | null;
  evidence: Array<{ phase: LearningPhase; challenge: string; answer: string; checks: Record<LearningCriterion, LearningCheck>; sourceEvidence: string }>;
  pending: { userId: string; phase: LearningPhase; revision: number; action: 'answer' | 'hint' } | null;
}
export interface ConversationNoteRecord {
  id: string;
  path: string | null;
  created: string;
  hashes: Record<string, string>;
  ranges: Record<string, { start: number; end: number; hash: string }>;
  clean: boolean;
}
