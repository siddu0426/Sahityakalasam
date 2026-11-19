export type Genre =
  | 'All'
  | 'Folk Tales'
  | 'Moral Stories'
  | 'Mythology'
  | 'Panchatantra'
  | 'Tenali Rama'
  | 'Bedtime';

export type StoryStatus = 'pending' | 'live' | 'rejected';

export type UserRole = 'listener' | 'narrator' | 'admin' | 'user';

export interface Profile {
  id: string;
  phone?: string;
  email?: string;
  display_name: string;
  username: string;
  avatar_url?: string;
  bio?: string;
  age?: number;
  city?: string;
  show_age_city: boolean;
  is_minor: boolean;
  guardian_name?: string;
  guardian_phone?: string;
  guardian_relationship?: string;
  guardian_consent: boolean;
  role: UserRole;
  created_at: string;
  updated_at?: string;
}

export interface Story {
  id: string;
  narrator_id: string;
  narrator?: Profile;
  title_telugu: string;
  title_english: string;
  genre: Genre;
  cover_url: string;
  audio_url: string;
  duration_seconds: number;
  play_count?: number;
  status: StoryStatus;
  reject_reason?: string;
  reject_notes?: string;
  is_weekly_winner?: boolean;
  vote_count?: number;
  user_has_voted?: boolean;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
}

export interface Vote {
  id: string;
  user_id: string;
  story_id: string;
  week_start: string; // YYYY-MM-DD
  created_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  amount: number; // in paise (2000 = ₹20)
  currency: string;
  razorpay_order_id: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  status: 'created' | 'paid' | 'failed';
  created_at: string;
  verified_at?: string;
}

export interface UploadCredit {
  id: string;
  user_id: string;
  payment_id?: string;
  status: 'available' | 'used' | 'refunded';
  used_for_story_id?: string;
  created_at: string;
  used_at?: string;
}

export interface WeeklyWinner {
  id: string;
  story_id: string;
  story?: Story;
  narrator_id: string;
  narrator?: Profile;
  week_start: string;
  week_end: string;
  vote_count: number;
  reward_amount: number; // in INR e.g. 1000
  announced_at: string;
  created_at: string;
}

export interface StoryReport {
  id: string;
  story_id: string;
  story_title?: string;
  reporter_id?: string;
  reason: 'inappropriate_content' | 'child_safety' | 'copyright_music' | 'audio_quality' | 'other';
  details?: string;
  status: 'pending' | 'reviewed' | 'dismissed';
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: 'story_approved' | 'story_rejected' | 'weekly_winner' | 'credit_received' | 'new_vote';
  title: string;
  message: string;
  data?: Record<string, any>;
  is_read: boolean;
  created_at: string;
}
