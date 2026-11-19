import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Profile,
  Story,
  Genre,
  Vote,
  Payment,
  UploadCredit,
  WeeklyWinner,
  StoryReport,
  NotificationItem,
} from './types';
import { TEST_ACCOUNTS } from './test-accounts';
import { SEED_STORIES, SEED_WINNER, SEED_NOTIFICATIONS, SAMPLE_AUDIO_URLS } from './seed-data';
import { getCurrentISTWeekStart, getCurrentISTWeekRange } from './constants';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isLiveSupabase = Boolean(
  supabaseUrl &&
  serviceRoleKey &&
  !supabaseUrl.includes('mock.supabase.co') &&
  !supabaseUrl.includes('your-project')
);

const supabaseAdmin: SupabaseClient | null = isLiveSupabase
  ? createClient(supabaseUrl, serviceRoleKey)
  : null;

// Global in-process storage for multi-user concurrency when running without external Supabase
// (Preserves multi-user consistency across all HTTP requests on the same server)
interface GlobalStore {
  profiles: Map<string, Profile>;
  stories: Map<string, Story>;
  votes: Vote[];
  payments: Payment[];
  credits: UploadCredit[];
  winners: WeeklyWinner[];
  reports: StoryReport[];
  notifications: NotificationItem[];
}

declare global {
  var __kathalu_global_store: GlobalStore | undefined;
}

function getGlobalStore(): GlobalStore {
  if (!global.__kathalu_global_store) {
    const profiles = new Map<string, Profile>();
    for (const acc of TEST_ACCOUNTS) {
      profiles.set(acc.id, acc);
    }

    const stories = new Map<string, Story>();
    for (const s of SEED_STORIES) {
      stories.set(s.id, {
        ...s,
        play_count: 42,
        narrator: profiles.get(s.narrator_id),
      });
    }

    global.__kathalu_global_store = {
      profiles,
      stories,
      votes: [],
      payments: [],
      credits: [
        {
          id: 'cred-init-01',
          user_id: 'usr-narrator-01',
          status: 'available',
          created_at: new Date().toISOString(),
        },
      ],
      winners: [SEED_WINNER],
      reports: [],
      notifications: [...SEED_NOTIFICATIONS],
    };
  }
  return global.__kathalu_global_store;
}

export class ServerDB {
  // Check if live Supabase is active
  static isSupabaseActive(): boolean {
    return isLiveSupabase;
  }

  // --- PROFILES ---
  static async getProfiles(): Promise<Profile[]> {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.from('profiles').select('*');
      if (!error && data) return data;
    }
    const store = getGlobalStore();
    return Array.from(store.profiles.values());
  }

  static async getProfileById(id: string): Promise<Profile | null> {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.from('profiles').select('*').eq('id', id).single();
      if (!error && data) return data;
    }
    const store = getGlobalStore();
    return store.profiles.get(id) || null;
  }

  static async findProfileByPhoneOrEmail(identifier: string): Promise<Profile | null> {
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .or(`phone.eq.${identifier},email.eq.${identifier}`)
        .maybeSingle();
      if (data) return data;
    }
    const store = getGlobalStore();
    for (const p of Array.from(store.profiles.values())) {
      if (p.phone === identifier || p.email === identifier) {
        return p;
      }
    }
    return null;
  }

  static async upsertProfile(profile: Partial<Profile> & { id: string }): Promise<Profile> {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .upsert(profile)
        .select()
        .single();
      if (!error && data) return data;
    }
    const store = getGlobalStore();
    const existing = store.profiles.get(profile.id) || {
      id: profile.id,
      display_name: 'Telugu Storyteller',
      username: `user_${profile.id.slice(-4)}`,
      show_age_city: false,
      is_minor: false,
      guardian_consent: false,
      role: 'listener',
      created_at: new Date().toISOString(),
    };
    const updated = { ...existing, ...profile, updated_at: new Date().toISOString() } as Profile;
    store.profiles.set(profile.id, updated);
    return updated;
  }

  // --- STORIES ---
  static async getStories(options?: {
    genre?: Genre;
    search?: string;
    sort?: 'most_voted' | 'newest';
    status?: 'all' | 'live' | 'pending' | 'rejected';
    narratorId?: string;
  }): Promise<Story[]> {
    const store = getGlobalStore();
    const currentWeekStart = getCurrentISTWeekStart();

    if (supabaseAdmin) {
      let query = supabaseAdmin.from('stories').select('*, narrator:profiles!narrator_id(*)');

      if (options?.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      } else if (!options?.status) {
        query = query.eq('status', 'live');
      }

      if (options?.genre && options.genre !== 'All') {
        query = query.eq('genre', options.genre);
      }

      if (options?.narratorId) {
        query = query.eq('narrator_id', options.narratorId);
      }

      const { data, error } = await query;
      if (!error && data) {
        return data as Story[];
      }
    }

    // Server memory fallback
    let list = Array.from(store.stories.values()).map((s) => {
      const narrator = store.profiles.get(s.narrator_id);
      return {
        ...s,
        narrator,
        vote_count: s.vote_count || 0,
      };
    });

    if (!options?.status || options.status === 'live') {
      list = list.filter((s) => s.status === 'live');
    } else if (options.status !== 'all') {
      list = list.filter((s) => s.status === options.status);
    }

    if (options?.genre && options.genre !== 'All') {
      list = list.filter((s) => s.genre === options.genre);
    }

    if (options?.narratorId) {
      list = list.filter((s) => s.narrator_id === options.narratorId);
    }

    if (options?.search && options.search.trim()) {
      const q = options.search.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.title_telugu.toLowerCase().includes(q) ||
          s.title_english.toLowerCase().includes(q) ||
          s.narrator?.display_name.toLowerCase().includes(q)
      );
    }

    if (options?.sort === 'newest') {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      list.sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
    }

    return list;
  }

  static async getStoryById(id: string): Promise<Story | null> {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('stories')
        .select('*, narrator:profiles!narrator_id(*)')
        .eq('id', id)
        .maybeSingle();
      if (!error && data) return data as Story;
    }
    const store = getGlobalStore();
    return store.stories.get(id) || null;
  }

  static async submitStory(params: {
    narratorId: string;
    titleTelugu: string;
    titleEnglish: string;
    genre: Genre;
    audioUrl: string;
    durationSeconds: number;
    coverUrl?: string;
    resubmitStoryId?: string;
  }): Promise<Story> {
    if (supabaseAdmin) {
      if (params.resubmitStoryId) {
        const { data: updated, error } = await supabaseAdmin
          .from('stories')
          .update({
            title_telugu: params.titleTelugu,
            title_english: params.titleEnglish || params.titleTelugu,
            genre: params.genre,
            audio_url: params.audioUrl,
            duration_seconds: params.durationSeconds,
            cover_url: params.coverUrl || 'placeholders/default-cover.webp',
            status: 'pending',
            rejection_reason: null,
            reject_reason: null,
            reject_notes: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.resubmitStoryId)
          .select('*, narrator:profiles!narrator_id(*)')
          .single();
        if (!error && updated) return updated as Story;
        if (error) throw new Error(error.message);
      } else {
        const { data: cred } = await supabaseAdmin
          .from('upload_credits')
          .select('id')
          .eq('user_id', params.narratorId)
          .eq('status', 'available')
          .limit(1)
          .maybeSingle();

        if (!cred) {
          throw new Error('No available upload credit. Please complete the ₹20 entry fee.');
        }

        const { data: created, error } = await supabaseAdmin
          .from('stories')
          .insert({
            narrator_id: params.narratorId,
            title_telugu: params.titleTelugu,
            title_english: params.titleEnglish || params.titleTelugu,
            genre: params.genre,
            audio_url: params.audioUrl,
            duration_seconds: params.durationSeconds,
            cover_url: params.coverUrl || 'placeholders/default-cover.webp',
            status: 'pending',
            vote_count: 0,
            play_count: 0,
          })
          .select('*, narrator:profiles!narrator_id(*)')
          .single();

        if (error || !created) {
          throw new Error(error?.message || 'Failed to submit story');
        }

        await supabaseAdmin
          .from('upload_credits')
          .update({ status: 'used', used_for_story_id: created.id, used_at: new Date().toISOString() })
          .eq('id', cred.id);

        await supabaseAdmin
          .from('profiles')
          .update({ role: 'narrator' })
          .eq('id', params.narratorId)
          .eq('role', 'listener');

        return created as Story;
      }
    }

    const store = getGlobalStore();

    // If resubmission, free of charge
    if (params.resubmitStoryId) {
      const existing = store.stories.get(params.resubmitStoryId);
      if (existing) {
        existing.title_telugu = params.titleTelugu || existing.title_telugu;
        existing.title_english = params.titleEnglish || existing.title_english;
        existing.genre = params.genre || existing.genre;
        existing.audio_url = params.audioUrl || existing.audio_url;
        existing.duration_seconds = params.durationSeconds || existing.duration_seconds;
        if (params.coverUrl) existing.cover_url = params.coverUrl;
        existing.status = 'pending';
        existing.reject_reason = undefined;
        existing.reject_notes = undefined;
        return existing;
      }
    }

    // Check upload credit
    const availableCredit = store.credits.find(
      (c) => c.user_id === params.narratorId && c.status === 'available'
    );
    if (!availableCredit) {
      throw new Error('No available upload credit. Please complete the ₹20 entry fee.');
    }

    const storyId = `story-${Date.now()}`;
    availableCredit.status = 'used';
    availableCredit.used_for_story_id = storyId;
    availableCredit.used_at = new Date().toISOString();

    const newStory: Story = {
      id: storyId,
      narrator_id: params.narratorId,
      title_telugu: params.titleTelugu,
      title_english: params.titleEnglish || params.titleTelugu,
      genre: params.genre,
      cover_url: params.coverUrl || 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop',
      audio_url: params.audioUrl,
      duration_seconds: params.durationSeconds,
      status: 'pending',
      vote_count: 0,
      play_count: 0,
      created_at: new Date().toISOString(),
    };

    store.stories.set(storyId, newStory);

    // Promote user role to narrator if they were a listener
    const user = store.profiles.get(params.narratorId);
    if (user && user.role === 'listener') {
      user.role = 'narrator';
    }

    return newStory;
  }

  // --- VOTING (1 VOTE PER USER PER STORY PER WEEK) ---
  static async voteForStory(userId: string, storyId: string): Promise<{ success: boolean; newVoteCount: number; hasVoted: boolean; message: string }> {
    if (supabaseAdmin) {
      const weekStart = getCurrentISTWeekStart();

      const { data: existingVote } = await supabaseAdmin
        .from('votes')
        .select('id')
        .eq('user_id', userId)
        .eq('story_id', storyId)
        .eq('week_start', weekStart)
        .maybeSingle();

      if (existingVote) {
        await supabaseAdmin.from('votes').delete().eq('id', existingVote.id);
        const { count: actualVotes } = await supabaseAdmin
          .from('votes')
          .select('*', { count: 'exact', head: true })
          .eq('story_id', storyId);
        const updated = actualVotes ?? 0;
        await supabaseAdmin.from('stories').update({ vote_count: updated, updated_at: new Date().toISOString() }).eq('id', storyId);
        return { success: true, newVoteCount: updated, hasVoted: false, message: 'Vote removed' };
      } else {
        await supabaseAdmin.from('votes').insert({ user_id: userId, story_id: storyId, week_start: weekStart });
        const { count: actualVotes } = await supabaseAdmin
          .from('votes')
          .select('*', { count: 'exact', head: true })
          .eq('story_id', storyId);
        const updated = actualVotes ?? 1;
        await supabaseAdmin.from('stories').update({ vote_count: updated, updated_at: new Date().toISOString() }).eq('id', storyId);
        return { success: true, newVoteCount: updated, hasVoted: true, message: 'Vote recorded for this week!' };
      }
    }

    const store = getGlobalStore();
    const weekStart = getCurrentISTWeekStart();

    const existingIndex = store.votes.findIndex(
      (v) => v.user_id === userId && v.story_id === storyId && v.week_start === weekStart
    );

    const story = store.stories.get(storyId);
    if (!story) {
      return { success: false, newVoteCount: 0, hasVoted: false, message: 'Story not found' };
    }

    if (existingIndex !== -1) {
      // Toggle vote off
      store.votes.splice(existingIndex, 1);
      const updated = Math.max(0, (story.vote_count || 1) - 1);
      story.vote_count = updated;
      return { success: true, newVoteCount: updated, hasVoted: false, message: 'Vote removed' };
    }

    // Add unique vote
    store.votes.push({
      id: `vote-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      user_id: userId,
      story_id: storyId,
      week_start: weekStart,
      created_at: new Date().toISOString(),
    });

    const updated = (story.vote_count || 0) + 1;
    story.vote_count = updated;

    return {
      success: true,
      newVoteCount: updated,
      hasVoted: true,
      message: 'Vote recorded for this week!',
    };
  }

  // --- PLAY COUNT ---
  static async incrementPlayCount(storyId: string): Promise<number> {
    if (supabaseAdmin) {
      const { data: story } = await supabaseAdmin.from('stories').select('play_count').eq('id', storyId).single();
      const updated = (story?.play_count || 0) + 1;
      await supabaseAdmin.from('stories').update({ play_count: updated }).eq('id', storyId);
      return updated;
    }

    const store = getGlobalStore();
    const story = store.stories.get(storyId);
    if (story) {
      story.play_count = (story.play_count || 0) + 1;
      return story.play_count;
    }
    return 0;
  }

  // --- ADMIN ACTIONS ---
  static async approveStory(storyId: string, adminId: string): Promise<Story> {
    if (supabaseAdmin) {
      const { data: story, error } = await supabaseAdmin
        .from('stories')
        .update({
          status: 'live',
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', storyId)
        .select('*, narrator:profiles!narrator_id(*)')
        .single();

      if (error || !story) throw new Error(error?.message || 'Failed to approve story');

      await supabaseAdmin.from('notifications').insert({
        user_id: story.narrator_id,
        type: 'story_approved',
        title: '🌟 Story Approved & Live!',
        message: `"${story.title_telugu}" has been approved and published to the live feed!`,
        is_read: false,
      });

      return story as Story;
    }

    const store = getGlobalStore();
    const story = store.stories.get(storyId);
    if (!story) throw new Error('Story not found');

    story.status = 'live';
    story.reject_reason = undefined;
    story.reject_notes = undefined;
    story.reviewed_at = new Date().toISOString();
    story.reviewed_by = adminId;

    // Send in-app notification
    store.notifications.unshift({
      id: `notif-${Date.now()}`,
      user_id: story.narrator_id,
      type: 'story_approved',
      title: '🌟 Story Approved & Live!',
      message: `"${story.title_telugu}" has been approved and published to the live feed!`,
      is_read: false,
      created_at: new Date().toISOString(),
    });

    return story;
  }

  static async rejectStory(storyId: string, reason: string, notes: string, adminId: string): Promise<Story> {
    if (supabaseAdmin) {
      const { data: story, error } = await supabaseAdmin
        .from('stories')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          reject_reason: reason,
          reject_notes: notes,
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', storyId)
        .select('*, narrator:profiles!narrator_id(*)')
        .single();

      if (error || !story) throw new Error(error?.message || 'Failed to reject story');

      await supabaseAdmin.from('notifications').insert({
        user_id: story.narrator_id,
        type: 'story_rejected',
        title: 'Story Needs Revision',
        message: `${reason}. You can re-record and resubmit for free without paying again.`,
        is_read: false,
      });

      return story as Story;
    }

    const store = getGlobalStore();
    const story = store.stories.get(storyId);
    if (!story) throw new Error('Story not found');

    story.status = 'rejected';
    story.reject_reason = reason;
    story.reject_notes = notes;
    story.reviewed_at = new Date().toISOString();
    story.reviewed_by = adminId;

    // Send in-app notification
    store.notifications.unshift({
      id: `notif-${Date.now()}`,
      user_id: story.narrator_id,
      type: 'story_rejected',
      title: 'Story Needs Revision',
      message: `${reason}. You can re-record and resubmit for free without paying again.`,
      is_read: false,
      created_at: new Date().toISOString(),
    });

    return story;
  }

  // --- WEEKLY SHORTLIST & WINNER ---
  static async getWeeklyShortlist(): Promise<Story[]> {
    const stories = await this.getStories({ status: 'live', sort: 'most_voted' });
    return stories.slice(0, 5);
  }

  static async confirmWeeklyWinner(storyId: string, adminId?: string): Promise<WeeklyWinner> {
    const store = getGlobalStore();
    const story = store.stories.get(storyId);
    if (!story) throw new Error('Story not found');

    // Unset any previous winner flag
    for (const s of Array.from(store.stories.values())) {
      s.is_weekly_winner = s.id === storyId;
    }

    const weekRange = getCurrentISTWeekRange();
    const winnerRecord: WeeklyWinner = {
      id: `winner-${Date.now()}`,
      story_id: story.id,
      narrator_id: story.narrator_id,
      week_start: weekRange.weekStart,
      week_end: weekRange.weekEnd,
      vote_count: story.vote_count || 1248,
      reward_amount: 1000,
      announced_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    store.winners.unshift(winnerRecord);

    store.notifications.unshift({
      id: `notif-${Date.now()}`,
      user_id: story.narrator_id,
      type: 'weekly_winner',
      title: '🏆 You Won Story of the Week!',
      message: `Congratulations! "${story.title_telugu}" won Story of the Week with ₹1,000 cash reward!`,
      is_read: false,
      created_at: new Date().toISOString(),
    });

    return winnerRecord;
  }

  // --- PAYMENTS & CREDITS ---
  static async grantUploadCredit(userId: string, paymentId?: string): Promise<UploadCredit> {
    const store = getGlobalStore();
    const newCredit: UploadCredit = {
      id: `credit-${Date.now()}`,
      user_id: userId,
      payment_id: paymentId,
      status: 'available',
      created_at: new Date().toISOString(),
    };
    store.credits.push(newCredit);

    store.notifications.unshift({
      id: `notif-${Date.now()}`,
      user_id: userId,
      type: 'credit_received',
      title: '₹20 Entry Confirmed',
      message: 'Upload credit granted! You are ready to record and submit your story.',
      is_read: false,
      created_at: new Date().toISOString(),
    });

    return newCredit;
  }

  static async recordVerifiedPayment(payment: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> {
    const store = getGlobalStore();
    const newPayment: Payment = {
      ...payment,
      id: `pay-${Date.now()}`,
      created_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
    };
    store.payments.push(newPayment);

    // Grant 1 upload credit
    await this.grantUploadCredit(payment.user_id, newPayment.id);
    return newPayment;
  }

  static async getPayments(): Promise<Payment[]> {
    const store = getGlobalStore();
    return store.payments;
  }

  static async getCredits(userId: string): Promise<UploadCredit[]> {
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin.from('upload_credits').select('*').eq('user_id', userId);
      if (data) return data;
    }
    const store = getGlobalStore();
    return store.credits.filter((c) => c.user_id === userId);
  }

  static async getAvailableCreditCount(userId: string): Promise<number> {
    if (supabaseAdmin) {
      const { count } = await supabaseAdmin
        .from('upload_credits')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'available');
      return count || 0;
    }
    const store = getGlobalStore();
    return store.credits.filter((c) => c.user_id === userId && c.status === 'available').length;
  }

  // --- REPORTS ---
  static async reportStory(report: Omit<StoryReport, 'id' | 'created_at' | 'status'>): Promise<StoryReport> {
    const store = getGlobalStore();
    const story = store.stories.get(report.story_id);
    const newReport: StoryReport = {
      ...report,
      id: `rep-${Date.now()}`,
      story_title: story?.title_telugu,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    store.reports.unshift(newReport);
    return newReport;
  }

  static async getReports(): Promise<StoryReport[]> {
    const store = getGlobalStore();
    return store.reports;
  }

  // --- NOTIFICATIONS ---
  static async getNotifications(userId: string): Promise<NotificationItem[]> {
    const store = getGlobalStore();
    return store.notifications.filter((n) => n.user_id === userId);
  }

  static async markNotificationRead(id: string): Promise<void> {
    const store = getGlobalStore();
    const n = store.notifications.find((item) => item.id === id);
    if (n) n.is_read = true;
  }
}
