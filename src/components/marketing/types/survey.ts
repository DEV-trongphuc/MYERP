// types/survey.ts — Survey Builder TypeScript Definitions

export type SurveyStatus = 'draft' | 'active' | 'paused' | 'closed';
export type SourceChannel = 'direct_link' | 'qr_code' | 'email_embed' | 'widget' | 'api';
export type DeviceType = 'desktop' | 'tablet' | 'mobile' | 'unknown';

// ─── Question Types ──────────────────────────────────────────────────────────
export type QuestionType =
  | 'short_text' | 'long_text' | 'email' | 'phone' | 'number' | 'date'
  | 'single_choice' | 'multi_choice' | 'dropdown' | 'yes_no'
  | 'star_rating' | 'nps' | 'likert' | 'slider' | 'emoji_rating'
  | 'ranking' | 'matrix_single' | 'matrix_multi'
  | 'file_upload'
  | 'section_header' | 'image_block' | 'divider' | 'page_break'
  | 'button_block' | 'link_block' | 'banner_block';

export interface ChoiceOption {
  id: string;
  label: string;
  value: string;
  imageUrl?: string;
}

export interface MatrixRow { id: string; label: string; }
export interface MatrixCol { id: string; label: string; }

export interface LogicCondition {
  question_id: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_answered' | 'is_empty';
  value?: string | number | string[];
}

export interface LogicRule {
  condition: LogicCondition;
  action: 'skip_to' | 'show_question' | 'hide_question' | 'end_survey' | 'end_survey_screen';
  target?: string; // target block id or thank_you_screen_id
}

export interface QuizSettings {
  enabled: boolean;
  scoringType: 'immediate' | 'backend';
  allowRetry: boolean;
  timeLimitMins?: number;
}

// ─── Survey Block ─────────────────────────────────────────────────────────────
export interface SurveyBlockStyle {
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: string;
  padding?: string;
  fontFamily?: string;
  fontSize?: string;
  labelColor?: string;
  accentColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  boxShadow?: string;
}

export interface SurveyBlock {
  id: string;
  type: QuestionType;
  label: string;
  description?: string;          // Subtitle/helper text below label
  required: boolean;
  style?: SurveyBlockStyle;
  logic?: LogicRule[];

  // Quiz properties
  quizPoints?: number;
  correctAnswer?: string | number | string[];
  correctAnswerMatch?: 'exact' | 'contains';

  // Choice/ranking options
  options?: ChoiceOption[];
  allowOther?: boolean;           // "Khác: ____" option toggle
  randomizeOptions?: boolean;

  // Matrix
  matrixRows?: MatrixRow[];
  matrixCols?: MatrixCol[];

  // Rating/NPS
  minValue?: number;
  maxValue?: number;
  minLabel?: string;
  maxLabel?: string;
  step?: number;
  ratingIcon?: 'star' | 'heart' | 'thumb' | 'number';
  emojis?: string[];              // emoji_rating custom

  // Likert
  likertLabels?: string[];        // e.g. ['Rất không đồng ý', ..., 'Rất đồng ý']

  // Text
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;

  // Image
  imageUrl?: string;
  imageAlt?: string;
  imageWidth?: '25%' | '50%' | '75%' | '100%';
  imageAlign?: 'left' | 'center' | 'right';

  // File upload
  acceptedTypes?: string[];       // e.g. ['image/*', 'application/pdf']
  maxFileSizeMB?: number;

  // Section header
  headingLevel?: 'h2' | 'h3';

  // Button block
  buttonText?: string;
  buttonUrl?: string;
  buttonStyle?: 'filled' | 'outline' | 'ghost';
  buttonAlign?: 'left' | 'center' | 'right';
  buttonColor?: string;
  buttonShadow?: string;

  // Link block
  linkText?: string;
  linkUrl?: string;
  linkAlign?: 'left' | 'center' | 'right';

  // Banner block
  bannerImageUrl?: string;
  bannerHeight?: number;          // px
  bannerOverlay?: string;         // rgba color e.g. 'rgba(0,0,0,0.4)'
  bannerTextColor?: string;
}

// ─── Survey Settings ──────────────────────────────────────────────────────────
export interface SurveyTheme {
  primaryColor: string;
  backgroundColor: string;
  cardBackground: string;
  cardShadow?: string;
  textColor: string;
  fontFamily: string;
  borderRadius: string;
  logoUrl?: string;
  coverImageUrl?: string;
  coverHeight?: 'sm' | 'md' | 'lg';
  coverOverlay?: string;
  coverStyle?: 'minimal' | 'gradient' | 'image';
  coverDescription?: string;
  coverBadge?: string;
  coverCountdown?: string;
  coverCountdownPos?: 'bottom' | 'top_right';
  coverFeatures?: string[];
  coverFeaturesStyle?: 'check' | 'dot';
}

export interface SurveyVoucherConfig {
  enabled: boolean;
  campaign_id?: string;
  logic_mappings?: Array<{
    condition: LogicCondition;
    reward_item_id?: string;
  }>;
  fallback_reward_item_id?: string;
}

export interface SurveySettings {
  showProgressBar: boolean;
  progressBarStyle: 'bar' | 'steps' | 'percentage';
  allowPartialSubmit: boolean;
  redirectUrl?: string;           // After submit redirect
  trackIp: boolean;
  trackLocation: boolean;
  customCss?: string;
  quiz?: QuizSettings;
  voucher_config?: SurveyVoucherConfig;
}

export interface ThankYouPage {
  id?: string;
  title: string;
  message: string;
  emoji?: string;
  imageUrl?: string;
  showSocialShare: boolean;
  redirectUrl?: string;
  redirectDelay?: number;         // Seconds before auto-redirect
  ctaText?: string;               // CTA button text
  ctaUrl?: string;                // CTA button URL
}

// ─── Survey Entity ────────────────────────────────────────────────────────────
export interface Survey {
  id: string;
  workspace_id: number;
  name: string;
  slug: string;
  status: SurveyStatus;
  blocks: SurveyBlock[];
  theme: SurveyTheme;
  settings: SurveySettings;
  thankYouPage: ThankYouPage;       // Default ending screen
  thankYouPages?: ThankYouPage[];   // Additional ending screens for branching
  target_list_id?: string;
  flow_trigger_id?: string;
  response_limit?: number;
  close_at?: string;
  require_login: boolean;
  allow_anonymous: boolean;
  one_per_email: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Computed from DB
  response_count?: number;
  completion_rate?: number;
  avg_nps?: number;
}

// ─── Response ─────────────────────────────────────────────────────────────────
export interface SurveyAnswer {
  question_id: string;
  block_id: string;
  type: QuestionType;
  label?: string;
  answer_text?: string;
  answer_num?: number;
  answer_json?: string[] | number[] | Record<string, any>;
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  subscriber_id?: string;
  session_token: string;
  answers: SurveyAnswer[];
  completion_rate: number;
  time_spent_sec?: number;
  source_channel: SourceChannel;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  device_type: DeviceType;
  referrer_url?: string;
  geo_country?: string;
  geo_city?: string;
  submitted_at: string;
  // Joined
  subscriber_name?: string;
  subscriber_email?: string;
}

// ─── Analytics ───────────────────────────────────────────────────────────────
export interface SurveyAnalyticsOverview {
  total_views: number;
  total_responses: number;
  completion_rate: number;
  avg_time_spent_sec: number;
  nps_score?: number;
  responses_this_week: number;
  responses_last_week: number;
  by_channel: Record<SourceChannel, number>;
  by_device: Record<DeviceType, number>;
  by_date: Array<{ date: string; count: number }>;
}

export interface QuestionAnalytics {
  question_id: string;
  block_id: string;
  type: QuestionType;
  label: string;
  total_answered: number;
  skip_rate: number;
  // Choice
  choice_distribution?: Array<{ label: string; count: number; percentage: number }>;
  // Rating
  avg_rating?: number;
  rating_distribution?: Array<{ value: number; count: number }>;
  // NPS
  promoters?: number;
  passives?: number;
  detractors?: number;
  nps_score?: number;
  // Text
  text_responses?: string[];
  // Ranking
  ranking_avg?: Array<{ label: string; avg_rank: number }>;
  // Additional block data passed by API for display formatting
  content?: any;
  options?: any;
}

// ─── Toolbox ─────────────────────────────────────────────────────────────────
export interface QuestionTypeDefinition {
  type: QuestionType;
  label: string;
  icon: string;              // Lucide icon name
  group: QuestionGroup;
  description: string;
  isLayout?: boolean;
}

export type QuestionGroup =
  | 'Cơ bản' | 'Lựa chọn' | 'Đánh giá' | 'Nâng cao' | 'Bố cục';

// Dual value declarations for verbatimModuleSyntax compatibility
export const ChoiceOption: any = undefined;
export const MatrixRow: any = undefined;
export const MatrixCol: any = undefined;
export const LogicCondition: any = undefined;
export const LogicRule: any = undefined;
export const QuizSettings: any = undefined;
export const SurveyBlockStyle: any = undefined;
export const SurveyBlock: any = undefined;
export const SurveyTheme: any = undefined;
export const SurveyVoucherConfig: any = undefined;
export const SurveySettings: any = undefined;
export const ThankYouPage: any = undefined;
export const Survey: any = undefined;
export const SurveyAnswer: any = undefined;
export const SurveyResponse: any = undefined;
export const SurveyAnalyticsOverview: any = undefined;
export const QuestionAnalytics: any = undefined;
export const QuestionTypeDefinition: any = undefined;
export const SurveyStatus: any = undefined;
export const SourceChannel: any = undefined;
export const DeviceType: any = undefined;
export const QuestionType: any = undefined;
export const QuestionGroup: any = undefined;
