
export const CampaignStatus: Record<string, string> = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  SENDING: 'sending',
  SENT: 'sent',
  ACTIVE: 'active',
  PAUSED: 'paused',
  WAITING_FLOW: 'waiting_flow',
  WAITING_FOR_FLOW: 'waiting_flow',
};
export type CampaignStatus = string;

export interface ResponsiveStyle {
  // Mobile/Tablet overrides
  fontSize?: string;
  paddingTop?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  paddingRight?: string;
  marginTop?: string;
  marginBottom?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  width?: string;
  display?: 'block' | 'none';
}

export interface EmailBlockStyle {
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: 'cover' | 'contain' | 'auto';
  backgroundPosition?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  backgroundRepeat?: 'no-repeat' | 'repeat';
  contentBackgroundColor?: string;
  color?: string;

  // Typography
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  textTransform?: 'none' | 'capitalize' | 'uppercase' | 'lowercase';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: string;
  letterSpacing?: string;

  // Spacing (Desktop default)
  paddingTop?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  paddingRight?: string;
  marginTop?: string;
  marginBottom?: string;
  marginLeft?: string;
  marginRight?: string;

  // Border & Radius
  borderRadius?: string;
  borderTopLeftRadius?: string;
  borderTopRightRadius?: string;
  borderBottomLeftRadius?: string;
  borderBottomRightRadius?: string;

  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  borderColor?: string;
  borderTopWidth?: string;
  borderBottomWidth?: string;
  borderLeftWidth?: string;
  borderRightWidth?: string;

  // Shadow
  shadowBlur?: string;
  shadowColor?: string;
  shadowSpread?: string;
  shadowX?: string;
  shadowY?: string;

  width?: string;
  maxWidth?: string;
  height?: string;
  aspectRatio?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';

  // Flex / Layout
  verticalAlign?: 'top' | 'middle' | 'bottom';

  // Social specific (Global)
  iconColor?: string;
  iconBackgroundColor?: string;
  iconSize?: string;
  iconMode?: 'color' | 'dark' | 'light' | 'original' | 'custom';
  iconShape?: 'circle' | 'rounded' | 'square';
  gap?: string;
  iconPadding?: string; // New: Padding inside the icon box

  // Countdown specific
  targetDate?: string; // ISO string for countdown target
  digitColor?: string;
  labelColor?: string;

  // Timeline specific
  timelineDotColor?: string;
  timelineLineColor?: string;
  timelineLineStyle?: 'solid' | 'dashed' | 'dotted';
  timelineDotShape?: 'circle' | 'square';

  // Review specific
  starSize?: string;
  starColor?: string;

  // Responsive Overrides
  mobile?: ResponsiveStyle;
  tablet?: ResponsiveStyle;

  hideOnMobile?: boolean;
  hideOnDesktop?: boolean;
  display?: string;

  // Background Overlay
  overlayColor?: string;
  overlayOpacity?: number; // 0 to 1

  // Video Specific
  playButtonColor?: string;

  // Check List Specific
  checkIconColor?: string;
  checkIconSize?: string;
  checkIconBackgroundColor?: string;
  checkIcon?: string;
  checkIconMode?: 'icon' | 'image';
  checkCustomIconUrl?: string;
  showCheckListTitle?: boolean;
  showItemTitle?: boolean;
  showItemDescription?: boolean;
  checkIconVerticalAlign?: 'top' | 'middle' | 'bottom';
  checkTitleFont?: string;
  checkTitleSize?: string;
  checkItemSize?: string;
  checkDescColor?: string;
  checkTitleColor?: string;
  checkItemColor?: string;
  checkIndividualIcons?: boolean;
  checkIconRadius?: string;
  checkIconBorderWidth?: string;
  checkIconBorderColor?: string;
  checkIconPadding?: string;

  // Table Specific
  tableRows?: number;            // number of data rows (excluding header)
  tableCols?: number;            // number of columns
  tableHeaderRow?: boolean;      // show styled header row
  tableHeaderBg?: string;        // header background color
  tableHeaderTextColor?: string; // header text color
  tableStripe?: 'alternate' | 'solid'; // row color mode
  tableEvenBg?: string;          // even row background
  tableOddBg?: string;           // odd row background
  tableSolidBg?: string;         // solid row background
  tableBorderColor?: string;     // border color
  tableBorderWidth?: string;     // border width px
  tableColWidths?: string[];     // per-column widths ('auto', '120px', '25%')
  tableColAligns?: string[];     // per-column default text alignment
  tableCellPadding?: string;     // cell padding (e.g. '8px 12px')
  tableFontSize?: string;        // base font size for all cells
  tableEvenTextColor?: string;   // text color for even data rows
  tableOddTextColor?: string;    // text color for odd data rows
  tableLastRowBg?: string;       // special background for last row
  tableLastRowTextColor?: string;
  tableLastColBg?: string;       // special background for last column
  tableLastColTextColor?: string;

  // Voucher Specific
  voucherStyle?: 'ticket' | 'modern' | 'minimal';
  voucherBorderColor?: string;
  voucherBorderStyle?: 'dashed' | 'dotted' | 'solid';
  voucherBg?: string;
  voucherTextColor?: string;
  voucherButtonBg?: string;
  voucherButtonTextColor?: string;
  
  // Header Specific
  headerMenuType?: 'link' | 'button';
  logoWidth?: string;
  menuGap?: string;
  buttonBg?: string;
  buttonColor?: string;

  // Survey Card Specific
  surveyId?: string;
  surveySlug?: string;
  surveyTitle?: string;
  surveyDescription?: string;
  surveyBadgeText?: string;
  surveyButtonText?: string;
  surveyAccentColor?: string;
  surveyCardBgColor?: string;
  surveyBorderColor?: string;
  surveyButtonTextColor?: string;

  noStack?: boolean;
}

export interface SocialLink {
  id: string;
  network: string; // Changed to string to support 'custom' or dynamic keys
  url: string;
  imageUrl?: string; // For custom images/favicons
  // Deep customization per icon
  customStyle?: {
    iconColor?: string;
    backgroundColor?: string;
  };
}

export interface ListItem {
  id: string;
  title: string;
  description: string;
  date?: string;
  icon?: string;
  customIconUrl?: string;
  menuType?: 'link' | 'button';
}

export interface TableCell {
  content: string;
  align?: 'left' | 'center' | 'right';
  colSpan?: number;
  bg?: string;      // cell-level background override
  color?: string;   // cell-level text color override
}

export type VoucherDiscountType = 'percentage' | 'fixed_amount' | 'physical_gift' | 'free_shipping';
export type VoucherCodeType = 'static' | 'dynamic';

export interface VoucherRewardItem {
    id: string; // unique string like reward_xyz
    discountType: VoucherDiscountType;
    discountValue?: number;
    giftTitle?: string;
    imageUrl?: string;
    quantity?: number; // max amount of this reward to generate. undefined/null means unlimited.
}

export interface VoucherCampaign {
    id: string;
    name: string;
    description: string;
    thumbnailUrl?: string;
    
    rewards: VoucherRewardItem[];
    
    codeType: VoucherCodeType;
    staticCode?: string;
    prefixList?: string;
    
    startDate: string;
    endDate?: string;
    
    usageLimitPerUser?: number;
    totalUsageLimit?: number;
    expirationDays?: number;
    
    status: 'draft' | 'active' | 'expired' | 'depleted';
    createdAt: string;
    
    stats: {
        totalGenerated: number;
        totalDistributed: number;
        totalRedeemed: number;
    };

    // Public Form Claim Configurations
    isClaimable?: boolean;
    claimApprovalRequired?: boolean;
    claimEmailTemplateId?: string; // which email template context to use
    claimTargetFormId?: string; // Which form to link to
}

export interface VoucherCode {
    id: string;
    campaignId: string;
    rewardItemId?: string; // Optional for backward compatibility but required for multi-reward
    code: string;
    distributedToSubscriberId?: string;
    distributedAt?: string;
    redeemedAt?: string;
    expirationDays?: number;
    expiresAt?: string;
    status: 'available' | 'distributed' | 'redeemed';
    claimedSource?: string;
    claimedSourceId?: string;
}

export type EmailBlockType = 'section' | 'row' | 'column' | 'text' | 'image' | 'button' | 'spacer' | 'divider' | 'social' | 'video' | 'html' | 'list' | 'header' | 'countdown' | 'quote' | 'timeline' | 'review' | 'order_list' | 'check_list' | 'table' | 'voucher' | 'otp' | 'survey_card';

export interface EmailBlock {
  id: string;
  type: EmailBlockType;
  content: string;          // For table: JSON string of TableCell[][]
  url?: string;
  fallbackUrl?: string;
  fallbackContent?: string;
  altText?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  socialLinks?: SocialLink[];
  items?: ListItem[];
  rating?: number;
  style: EmailBlockStyle;
  children?: EmailBlock[];
  checkListTitle?: string;
  voucherCampaignId?: string; // Linked Voucher Campaign

}

export interface EmailBodyStyle {
  backgroundColor: string;
  backgroundImage?: string;
  contentWidth: string;
  contentBackgroundColor: string;
  fontFamily: string;
  linkColor: string;
  // Background Image Options
  backgroundSize?: 'cover' | 'contain' | 'auto';
  backgroundPosition?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  backgroundRepeat?: 'no-repeat' | 'repeat';
}

export interface TemplateGroup {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Template {
  id: string;
  name: string;
  thumbnail: string;
  category: 'newsletter' | 'promotional' | 'transactional' | 'welcome' | 'event' | string;
  groupId?: string;
  lastModified: string;
  created_at?: string;
  createdAt?: string;
  blocks: EmailBlock[];
  bodyStyle: EmailBodyStyle;
  htmlContent?: string;
  visibility?: 'shared' | 'personal' | 'custom' | 'system';
  accessConfig?: {
    visibility: 'shared' | 'personal' | 'custom' | 'system';
    allowed_user_ids: number[];
    allowed_team_ids: number[];
    allowed_departments: string[];
    permission: 'use' | 'edit';
  };
  created_by?: number | null;
  updated_by?: number | null;
  creator?: {
    id?: number;
    name?: string;
    full_name?: string;
    email?: string;
    avatar_url?: string | null;
    picture?: string | null;
    role?: string | null;
  } | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: any;
  message?: string;
  error?: string; // Some endpoints might return 'error' instead of 'message'
  total?: number;
  has_more?: boolean;
  conversation_id?: string;
}

export interface SubscriberNote {
  id: string;
  content: string;
  createdAt: string;
  createdBy: string;
}

export interface Attachment { id: string; name: string; url: string; size: number; type: string; logic: 'all' | 'match_email'; path?: string; }
export interface CampaignReminder { id: string; type: 'no_open' | 'no_click' | 'always'; triggerMode: 'delay' | 'date'; delayDays: number; delayHours: number; scheduledAt: string; subject: string; templateId: string; }
export interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: CampaignStatus;
  sentAt?: string;
  scheduledAt?: string;
  createdAt?: string;
  target: {
    listIds: string[];
    segmentIds: string[];
    tagIds: string[];
    individualIds: string[];
  };
  reminders: CampaignReminder[];
  senderEmail: string;
  senderName?: string;
  trackingEnabled: boolean;
  stats?: {
    sent: number;
    opened: number;
    clicked: number;
    bounced: number;
    spam: number;
    unsubscribed: number;
    failed: number;
  };
  contentBody?: string;
  templateId?: string;
  attachments?: Attachment[];
  totalTargetAudience?: number;
  linkedFlow?: { id: string; name: string; status: string };
  type?: 'email' | 'zalo_zns';
  config?: {
    oa_config_id?: string;
    mapped_params?: Record<string, string>;
    cc_enabled?: boolean;
    cc_emails?: string;
    bcc_enabled?: boolean;
    bcc_emails?: string;
    variable_fallbacks?: Record<string, string>;
    [key: string]: any;
  };
  reminderCount?: number; // [UI-R1] Count of configured reminders — returned by API list query
  step_count?: number;    // [P41] From flow list; used in smart hint
}
export interface Subscriber { id: string; email: string; firstName: string; lastName: string; fullName?: string; full_name?: string; status: 'active' | 'unsubscribed' | 'lead' | 'customer' | 'bounced' | 'complained'; tags: string[]; joinedAt: string; dateOfBirth?: string | null; anniversaryDate?: string | null; lastActivityAt?: string | null; leadScore?: number; chatCount?: number; listIds: string[]; notes: SubscriberNote[]; stats: { emailsSent: number; emailsOpened: number; linksClicked: number; lastOpenAt?: string; lastClickAt?: string; }; customAttributes: Record<string, any>; custom_attributes?: Record<string, any>; custom_fields?: Record<string, any>; gender?: string; phone?: string; phoneNumber?: string; jobTitle?: string; company?: string; companyName?: string; address?: string; salesperson?: string; source?: string; activity?: any[]; verified?: boolean | number; avatar?: string; meta_psid?: string; meta_page_id?: string; [key: string]: any; }
export interface List { id: string; name: string; description?: string; subscriberCount?: number; count?: number; createdAt?: string; updatedAt?: string; }
export interface Segment { id: string; name: string; description: string; count: number; criteria: string; autoCleanupDays?: number; notifyOnJoin?: boolean; notifySubject?: string; notifyEmail?: string; notifyCc?: string; }
export interface FlowStep { id: string; type: 'trigger' | 'action' | 'wait' | 'condition' | 'advanced_condition' | 'split_test' | 'link_flow' | 'remove_action' | 'update_tag' | 'list_action' | 'zalo_zns' | 'zalo_cs' | 'meta_message'; label: string; iconName: string; config: Record<string, any>; nextStepId?: string; yesStepId?: string; noStepId?: string; pathAStepId?: string; pathBStepId?: string; stats?: any; }

// Updated FlowStats to reflect total counts from DB
export interface FlowStats {
  enrolled: number;
  completed: number;
  totalSent: number;
  totalOpened: number;
  uniqueOpened: number;
  totalClicked: number;
  uniqueClicked: number;
  totalFailed?: number;
  totalUnsubscribed?: number;
  // [FIX P6-C1] Per-channel stats — mirrors DB columns stat_zalo_sent, stat_zns_sent, stat_meta_sent
  zaloSent?: number;
  znsSent?: number;
  metaSent?: number;
  openRate?: number;   // stat_open_rate (float)
  clickRate?: number;  // stat_click_rate (float)
  // [FIX P14-H1] ZNS/Zalo link click counters — mirrors stat_total_zalo_clicked / stat_unique_zalo_clicked
  // Added in P11-C1 schema migration; returned by flows.php formatFlow() but were missing from the interface.
  totalZaloClicked?: number;
  uniqueZaloClicked?: number;
}

export interface Flow {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'draft' | 'archived';
  steps: FlowStep[];
  stats: FlowStats; // Use updated FlowStats interface
  config: {
    frequencyCap: number;
    activeDays: number[];
    startTime: string;
    endTime: string;
    exitConditions: string[];
    type: 'realtime' | 'batch';
    frequency?: 'one-time' | 'recurring';
    enrollmentCooldownHours?: number;
    allowMultiple?: boolean;
    maxEnrollments?: number;
    bounceBehavior?: 'stop' | 'ignore';
    advancedExit?: any;
  };
  createdAt: string;
  archivedAt?: string;
  trigger_type?: string | null;
  step_count?: number; // [P41] Returned by list endpoint — avoids loading full steps array for count
}
export interface FormField { id: string; dbField: string; label: string; required: boolean; type: 'text' | 'email' | 'tel' | 'number' | 'date'; isCustom?: boolean; customKey?: string; }
export interface FormDefinition { id: string; name: string; targetListId: string; fields: FormField[]; stats?: { submissions: number; }; status?: 'active' | 'inactive'; notificationEnabled?: boolean; notificationEmails?: string; notificationCcEmails?: string; notificationSubject?: string; }
export interface PurchaseEvent { id: string; name: string; createdAt?: string; status?: 'active' | 'inactive'; stats?: { count: number; revenue?: number; }; notificationEnabled?: boolean; notificationEmails?: string; notificationSubject?: string; }
export interface CustomEvent { id: string; name: string; createdAt?: string; status?: 'active' | 'inactive'; stats?: { count: number; }; notificationEnabled?: boolean; notificationEmails?: string; notificationSubject?: string; }

// --- AI & Chat Types ---

export interface FileAttachment {
  id?: string;
  name: string;
  type: string;
  size: number;
  base64?: string;
  previewUrl?: string;
  content?: string; // For streaming/virtual files
  conversationId?: string;
  conversationTitle?: string;
  propertyId?: string;
  source?: string;
  createdAt?: string; // Added from usage
  uploading?: boolean; // true while reading/processing file
  uploadProgress?: number; // 0-100
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: FileAttachment[];
  quickActions?: string[];
}

export interface ChatSession {
  id: string;
  visitorId?: string;
  title: string;
  createdAt: number;
  lastMessage?: string;
  messages?: Message[];
  isPinned?: boolean;
}

export interface ChatbotInfo {
  id: string;
  name: string;
  slug?: string;
  description: string;
  category_name?: string;
  settings?: {
    bot_name: string;
    brand_color: string;
    bot_avatar: string;
    welcome_msg: string;
  };
  stats?: {
    docs_count: number;
    queries_count: number;
  };
  domain?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
}
// Dual value declarations for verbatimModuleSyntax compatibility
export const ResponsiveStyle: any = undefined;
export const EmailBlockStyle: any = undefined;
export const SocialLink: any = undefined;
export const ListItem: any = undefined;
export const TableCell: any = undefined;
export const VoucherRewardItem: any = undefined;
export const VoucherCampaign: any = undefined;
export const VoucherCode: any = undefined;
export const EmailBlock: any = undefined;
export const EmailBodyStyle: any = undefined;
export const TemplateGroup: any = undefined;
export const Template: any = undefined;
export const ApiResponse: any = undefined;
export const SubscriberNote: any = undefined;
export const Attachment: any = undefined;
export const CampaignReminder: any = undefined;
export const Campaign: any = undefined;
export const Subscriber: any = undefined;
export const List: any = undefined;
export const Segment: any = undefined;
export const FlowStep: any = undefined;
export const FlowStats: any = undefined;
export const Flow: any = undefined;
export const FormField: any = undefined;
export const FormDefinition: any = undefined;
export const PurchaseEvent: any = undefined;
export const CustomEvent: any = undefined;
export const FileAttachment: any = undefined;
export const Message: any = undefined;
export const ChatSession: any = undefined;
export const ChatbotInfo: any = undefined;
export const User: any = undefined;
export const VoucherDiscountType: any = undefined;
export const VoucherCodeType: any = undefined;
export const EmailBlockType: any = undefined;
