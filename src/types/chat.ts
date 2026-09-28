export type ConversationType = 'direct' | 'group';
export type MessageType = 'text' | 'image' | 'file' | 'sticker' | 'erp_card' | 'system_event';
export type ParticipantRole = 'owner' | 'admin' | 'member';
export type UserOnlineStatus = 'online' | 'away' | 'offline';

export interface ChatParticipant {
  user_id: number;
  role: ParticipantRole;
  nickname?: string;
  joined_at?: string;
  full_name: string;
  email?: string;
  avatar_url?: string;
  job_title?: string;
  system_role?: string;
  is_online?: boolean;
  is_active?: boolean;
  user_status?: string;
  online_status?: UserOnlineStatus;
  last_ping_at?: string;
  seconds_ago?: number;
  last_read_message_id?: number;
}

export interface ChatReaction {
  type: string;
  count: number;
  users: string[];
  user_ids?: number[];
  details?: Array<{ user_id: number; full_name: string; avatar_url?: string }>;
  reacted_by_me: boolean;
}

export type MessageDeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'error';

export interface MessageReadParticipant {
  user_id: number;
  full_name: string;
  avatar_url?: string;
  read_at?: string;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  message_type: MessageType;
  content: string;
  metadata?: any;
  reply_to_id?: number | null;
  is_pinned?: boolean;
  is_edited?: boolean;
  deleted_at?: string | null;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
  sender_title?: string;
  reply_content?: string;
  reply_type?: MessageType;
  reply_sender_name?: string;
  reactions?: ChatReaction[];
  is_mine?: boolean;
  is_sending?: boolean;
  delivery_status?: MessageDeliveryStatus;
  temp_id?: string;
  read_by?: MessageReadParticipant[];
}

export interface ChatConversation {
  id: number;
  type: ConversationType;
  title: string;
  avatar_url?: string;
  created_by: number;
  last_message_at?: string;
  pinned_message_id?: number | null;
  settings?: {
    only_admin_can_send?: boolean;
    only_admin_can_change_info?: boolean;
  };
  my_role?: ParticipantRole;
  is_pinned?: boolean;
  is_muted?: boolean;
  last_read_message_id?: number;
  unread_count: number;
  last_msg_id?: number;
  last_msg_sender_id?: number;
  last_msg_type?: MessageType;
  last_msg_content?: string;
  last_msg_created_at?: string;
  last_msg_sender_name?: string;
  participant_count?: number;
  other_user?: {
    id: number;
    full_name: string;
    email?: string;
    avatar_url?: string;
    job_title?: string;
    role?: string;
    is_online?: boolean;
    is_active?: boolean;
    user_status?: string;
    online_status?: UserOnlineStatus;
    last_ping_at?: string;
    last_read_message_id?: number;
  };
  participants?: ChatParticipant[];
  pinned_message?: {
    id: number;
    content: string;
    message_type: MessageType;
    sender_id: number;
    sender_name: string;
    created_at: string;
  };
}

export interface StaffDirectoryUser {
  id: number;
  full_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  role: string;
  job_title?: string;
  team_id?: number;
  team_name?: string;
  status: UserOnlineStatus;
  custom_status?: string;
  last_ping_at?: string;
  last_active_at?: string;
  seconds_ago?: number;
}

export interface ChatVaultItem {
  id: number;
  message_id: number;
  uploader_id: number;
  sender_id?: number;
  sender_name?: string;
  category: 'image' | 'video' | 'document' | 'link';
  file_name: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  created_at: string;
}

export interface ErpEntitySearchResult {
  entity_type: 'task' | 'workflow' | 'so' | 'po' | 'contact' | 'ticket';
  id: number;
  contact_id?: number;
  contact_name?: string;
  title: string;
  status?: string;
  subtitle?: string;
  badge?: string;
  amount?: number;
  priority?: string;
  progress?: number;
  due_date?: string;
  assignee_name?: string;
  creator_name?: string;
  owner_name?: string;
  vendor_name?: string;
  category?: string;
  phone?: string;
  email?: string;
  date?: string;
  code?: string;
  sub_type?: string;
  creator_avatar?: string;
  created_at?: string;
  steps?: Array<{ name: string; avatar?: string }>;
  approver_name?: string;
  approver_avatar?: string;
  approver_status?: string;
  assignee_avatar?: string;
  owner_avatar?: string;
  contact_phone?: string;
  tags?: string[] | string;
  pipeline_status?: string;
  last_contact?: string;
  source?: string;
}

