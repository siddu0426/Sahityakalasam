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
import {
  SEED_PROFILES,
  SEED_STORIES,
  SEED_WINNER,
  SEED_NOTIFICATIONS,
  SAMPLE_AUDIO_URLS,
} from './seed-data';
import { getCurrentISTWeekStart, getCurrentISTWeekRange } from './constants';

const STORAGE_KEYS = {
  CURRENT_USER_ID: 'kathalu_current_user_id',
  PROFILES: 'kathalu_profiles_v1',
  STORIES: 'kathalu_stories_v1',
  VOTES: 'kathalu_votes_v1',
  PAYMENTS: 'kathalu_payments_v1',
  CREDITS: 'kathalu_credits_v1',
  WINNERS: 'kathalu_winners_v1',
  REPORTS: 'kathalu_reports_v1',
  NOTIFICATIONS: 'kathalu_notifications_v1',
};

// Check if window/localStorage is available
const isBrowser = typeof window !== 'undefined';

function getStorageItem<T>(key: string, defaultValue: T): T {
  if (!isBrowser) return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.warn(`Error reading ${key} from storage:`, e);
    return defaultValue;
  }
}

function setStorageItem<T>(key: string, value: T): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Error writing ${key} to storage:`, e);
  }
}

// In-memory singletons for SSR
let memoryProfiles: Profile[] = [...SEED_PROFILES];
let memoryStories: Story[] = [...SEED_STORIES];
let memoryVotes: Vote[] = [];
let memoryPayments: Payment[] = [];
let memoryCredits: UploadCredit[] = [
  {
    id: 'credit-saanvi-1',
    user_id: 'user-saanvi',
    status: 'available',
    created_at: new Date().toISOString(),
  },
];
let memoryWinners: WeeklyWinner[] = [SEED_WINNER];
let memoryReports: StoryReport[] = [];
let memoryNotifications: NotificationItem[] = [...SEED_NOTIFICATIONS];
let memoryCurrentUserId = 'user-saanvi'; // Default to Saanvi to match screenshot

export class DataService {
  // Profiles
  static getProfiles(): Profile[] {
    return getStorageItem<Profile[]>(STORAGE_KEYS.PROFILES, memoryProfiles);
  }

  static getProfileById(id: string): Profile | undefined {
    const profiles = this.getProfiles();
    return profiles.find((p) => p.id === id);
  }

  static getCurrentUser(): Profile {
    const profiles = this.getProfiles();
    const currentId = isBrowser
      ? localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID) || memoryCurrentUserId
      : memoryCurrentUserId;
    return profiles.find((p) => p.id === currentId) || profiles[0];
  }

  static setCurrentUser(id: string): Profile | undefined {
    const profile = this.getProfileById(id);
    if (profile) {
      memoryCurrentUserId = id;
      if (isBrowser) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, id);
      }
    }
    return profile;
  }

  static updateProfile(id: string, updates: Partial<Profile>): Profile {
    const profiles = this.getProfiles();
    const index = profiles.findIndex((p) => p.id === id);
    if (index === -1) throw new Error('Profile not found');

    const updated = {
      ...profiles[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    profiles[index] = updated;
    memoryProfiles = profiles;
    setStorageItem(STORAGE_KEYS.PROFILES, profiles);
    return updated;
  }

  static loginOrRegisterWithPhone(params: {
    phone: string;
    displayName: string;
    username: string;
    age?: number;
    city?: string;
    showAgeCity?: boolean;
    isMinor?: boolean;
    guardianName?: string;
    guardianPhone?: string;
    guardianRelationship?: string;
    guardianConsent?: boolean;
    bio?: string;
  }): Profile {
    const profiles = this.getProfiles();
    let existing = profiles.find((p) => p.phone === params.phone);

    if (existing) {
      this.setCurrentUser(existing.id);
      return existing;
    }

    const newProfile: Profile = {
      id: `user-${Date.now()}`,
      phone: params.phone,
      display_name: params.displayName || 'కథా ప్రియులు (Story Teller)',
      username: params.username || `kathalu_${params.phone.slice(-4)}`,
      avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${params.phone}`,
      bio: params.bio || '',
      age: params.age,
      city: params.city || 'Hyderabad',
      show_age_city: params.showAgeCity ?? false,
      is_minor: (params.age && params.age < 18) || !!params.isMinor,
      guardian_name: params.guardianName,
      guardian_phone: params.guardianPhone,
      guardian_relationship: params.guardianRelationship,
      guardian_consent: !!params.guardianConsent,
      role: 'user',
      created_at: new Date().toISOString(),
    };

    profiles.push(newProfile);
    memoryProfiles = profiles;
    setStorageItem(STORAGE_KEYS.PROFILES, profiles);
    this.setCurrentUser(newProfile.id);
    return newProfile;
  }

  // Stories
  static getStories(options?: {
    genre?: Genre;
    search?: string;
    sort?: 'most_voted' | 'newest';
    status?: 'all' | 'live' | 'pending' | 'rejected';
  }): Story[] {
    const rawStories = getStorageItem<Story[]>(STORAGE_KEYS.STORIES, memoryStories);
    const profiles = this.getProfiles();
    const votes = this.getVotes();
    const currentWeekStart = getCurrentISTWeekStart();
    const currentUser = this.getCurrentUser();

    // Attach narrator profile and dynamic week vote counts
    let stories = rawStories.map((s) => {
      const narrator = profiles.find((p) => p.id === s.narrator_id);
      const weekVotes = votes.filter(
        (v) => v.story_id === s.id && v.week_start === currentWeekStart
      ).length;
      const userHasVoted = currentUser
        ? votes.some(
            (v) =>
              v.story_id === s.id &&
              v.user_id === currentUser.id &&
              v.week_start === currentWeekStart
          )
        : false;

      return {
        ...s,
        narrator,
        vote_count: (s.vote_count || 0) + weekVotes,
        user_has_voted: userHasVoted,
      };
    });

    // Filter by status (default is live only)
    if (!options?.status || options.status === 'live') {
      stories = stories.filter((s) => s.status === 'live');
    } else if (options.status !== 'all') {
      stories = stories.filter((s) => s.status === options.status);
    }

    // Filter by genre
    if (options?.genre && options.genre !== 'All') {
      stories = stories.filter((s) => s.genre === options.genre);
    }

    // Search query
    if (options?.search && options.search.trim()) {
      const query = options.search.toLowerCase().trim();
      stories = stories.filter(
        (s) =>
          s.title_telugu.toLowerCase().includes(query) ||
          s.title_english.toLowerCase().includes(query) ||
          s.narrator?.display_name.toLowerCase().includes(query) ||
          s.narrator?.city?.toLowerCase().includes(query)
      );
    }

    // Sort
    if (options?.sort === 'newest') {
      stories.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else {
      // Default: most voted
      stories.sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
    }

    return stories;
  }

  static getStoryById(id: string): Story | undefined {
    const stories = this.getStories({ status: 'all' });
    return stories.find((s) => s.id === id);
  }

  static getStoryOfTheWeek(): Story | undefined {
    const liveStories = this.getStories({ status: 'live' });
    // Look for flagged weekly winner first, else top voted
    return liveStories.find((s) => s.is_weekly_winner) || liveStories[0];
  }

  static getNarratorStories(narratorId: string): Story[] {
    const all = this.getStories({ status: 'all' });
    return all.filter((s) => s.narrator_id === narratorId);
  }

  // Voting: 1 vote per user per story per IST week
  static getVotes(): Vote[] {
    return getStorageItem<Vote[]>(STORAGE_KEYS.VOTES, memoryVotes);
  }

  static voteForStory(userId: string, storyId: string): { success: boolean; message: string; newVoteCount: number; hasVoted: boolean } {
    const currentWeekStart = getCurrentISTWeekStart();
    const votes = this.getVotes();

    const existingVoteIndex = votes.findIndex(
      (v) =>
        v.user_id === userId &&
        v.story_id === storyId &&
        v.week_start === currentWeekStart
    );

    const story = this.getStoryById(storyId);
    if (!story) {
      return { success: false, message: 'Story not found', newVoteCount: 0, hasVoted: false };
    }

    if (existingVoteIndex !== -1) {
      // Toggling off vote
      votes.splice(existingVoteIndex, 1);
      memoryVotes = votes;
      setStorageItem(STORAGE_KEYS.VOTES, votes);

      const updatedCount = Math.max(0, (story.vote_count || 1) - 1);
      return {
        success: true,
        message: 'Vote removed for this week',
        newVoteCount: updatedCount,
        hasVoted: false,
      };
    }

    // Cast new vote
    const newVote: Vote = {
      id: `vote-${Date.now()}`,
      user_id: userId,
      story_id: storyId,
      week_start: currentWeekStart,
      created_at: new Date().toISOString(),
    };

    votes.push(newVote);
    memoryVotes = votes;
    setStorageItem(STORAGE_KEYS.VOTES, votes);

    const updatedCount = (story.vote_count || 0) + 1;
    return {
      success: true,
      message: 'Vote recorded! Thank you for supporting Telugu stories.',
      newVoteCount: updatedCount,
      hasVoted: true,
    };
  }

  // Payments & Upload Credits
  static getPayments(userId?: string): Payment[] {
    const payments = getStorageItem<Payment[]>(STORAGE_KEYS.PAYMENTS, memoryPayments);
    return userId ? payments.filter((p) => p.user_id === userId) : payments;
  }

  static getCredits(userId: string): UploadCredit[] {
    const credits = getStorageItem<UploadCredit[]>(STORAGE_KEYS.CREDITS, memoryCredits);
    return credits.filter((c) => c.user_id === userId);
  }

  static getAvailableCreditCount(userId: string): number {
    const credits = this.getCredits(userId);
    return credits.filter((c) => c.status === 'available').length;
  }

  static grantUploadCredit(userId: string, paymentId?: string): UploadCredit {
    const credits = getStorageItem<UploadCredit[]>(STORAGE_KEYS.CREDITS, memoryCredits);
    const newCredit: UploadCredit = {
      id: `credit-${Date.now()}`,
      user_id: userId,
      payment_id: paymentId,
      status: 'available',
      created_at: new Date().toISOString(),
    };
    credits.push(newCredit);
    memoryCredits = credits;
    setStorageItem(STORAGE_KEYS.CREDITS, credits);

    // Also push notification
    this.addNotification({
      user_id: userId,
      type: 'credit_received',
      title: '₹20 Entry Paid',
      message: 'Upload credit confirmed! You are ready to share your story.',
    });

    return newCredit;
  }

  static recordPayment(payment: Omit<Payment, 'id' | 'created_at'>): Payment {
    const payments = getStorageItem<Payment[]>(STORAGE_KEYS.PAYMENTS, memoryPayments);
    const newPayment: Payment = {
      ...payment,
      id: `pay-${Date.now()}`,
      created_at: new Date().toISOString(),
      verified_at: payment.status === 'paid' ? new Date().toISOString() : undefined,
    };
    payments.push(newPayment);
    memoryPayments = payments;
    setStorageItem(STORAGE_KEYS.PAYMENTS, payments);

    if (newPayment.status === 'paid') {
      this.grantUploadCredit(newPayment.user_id, newPayment.id);
    }
    return newPayment;
  }

  // Story Submission & Resubmission
  static submitStory(params: {
    narratorId: string;
    titleTelugu: string;
    titleEnglish: string;
    genre: Genre;
    audioUrl: string;
    durationSeconds: number;
    coverUrl?: string;
    resubmitStoryId?: string; // If resubmitting a rejected story, free!
  }): Story {
    const rawStories = getStorageItem<Story[]>(STORAGE_KEYS.STORIES, memoryStories);

    // If resubmitting rejected story
    if (params.resubmitStoryId) {
      const existingIndex = rawStories.findIndex((s) => s.id === params.resubmitStoryId);
      if (existingIndex !== -1) {
        const updatedStory: Story = {
          ...rawStories[existingIndex],
          title_telugu: params.titleTelugu || rawStories[existingIndex].title_telugu,
          title_english: params.titleEnglish || rawStories[existingIndex].title_english,
          genre: params.genre || rawStories[existingIndex].genre,
          audio_url: params.audioUrl || rawStories[existingIndex].audio_url,
          duration_seconds: params.durationSeconds || rawStories[existingIndex].duration_seconds,
          cover_url: params.coverUrl || rawStories[existingIndex].cover_url,
          status: 'pending', // back to pending review
          reject_reason: undefined,
          reject_notes: undefined,
        };
        rawStories[existingIndex] = updatedStory;
        memoryStories = rawStories;
        setStorageItem(STORAGE_KEYS.STORIES, rawStories);

        this.addNotification({
          user_id: params.narratorId,
          type: 'credit_received',
          title: 'Story Resubmitted',
          message: `Your revised story "${updatedStory.title_telugu}" is now in review.`,
        });

        return updatedStory;
      }
    }

    // If new submission, check and consume 1 upload credit
    const credits = getStorageItem<UploadCredit[]>(STORAGE_KEYS.CREDITS, memoryCredits);
    const availableCredit = credits.find(
      (c) => c.user_id === params.narratorId && c.status === 'available'
    );

    if (!availableCredit) {
      throw new Error('No available upload credit. Please complete the ₹20 entry fee.');
    }

    const storyId = `story-${Date.now()}`;
    availableCredit.status = 'used';
    availableCredit.used_for_story_id = storyId;
    availableCredit.used_at = new Date().toISOString();
    memoryCredits = credits;
    setStorageItem(STORAGE_KEYS.CREDITS, credits);

    const defaultCovers = [
      'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&h=600&fit=crop',
      'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=600&h=600&fit=crop',
      'https://images.unsplash.com/photo-1534188753412-3e26d0d618d6?w=600&h=600&fit=crop',
      'https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=600&h=600&fit=crop',
    ];
    const assignedCover =
      params.coverUrl || defaultCovers[Math.floor(Math.random() * defaultCovers.length)];

    const newStory: Story = {
      id: storyId,
      narrator_id: params.narratorId,
      title_telugu: params.titleTelugu,
      title_english: params.titleEnglish,
      genre: params.genre,
      cover_url: assignedCover,
      audio_url: params.audioUrl || SAMPLE_AUDIO_URLS[0],
      duration_seconds: params.durationSeconds || 180,
      status: 'pending',
      vote_count: 0,
      created_at: new Date().toISOString(),
    };

    rawStories.unshift(newStory);
    memoryStories = rawStories;
    setStorageItem(STORAGE_KEYS.STORIES, rawStories);

    this.addNotification({
      user_id: params.narratorId,
      type: 'credit_received',
      title: 'Story Submitted For Review',
      message: `"${params.titleTelugu}" has been submitted. Our editorial team will review it shortly.`,
    });

    return newStory;
  }

  // Admin Actions
  static approveStory(storyId: string, adminId: string): Story {
    const rawStories = getStorageItem<Story[]>(STORAGE_KEYS.STORIES, memoryStories);
    const index = rawStories.findIndex((s) => s.id === storyId);
    if (index === -1) throw new Error('Story not found');

    const updated: Story = {
      ...rawStories[index],
      status: 'live',
      reject_reason: undefined,
      reject_notes: undefined,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
    };
    rawStories[index] = updated;
    memoryStories = rawStories;
    setStorageItem(STORAGE_KEYS.STORIES, rawStories);

    this.addNotification({
      user_id: updated.narrator_id,
      type: 'story_approved',
      title: '🌟 Story Approved & Live!',
      message: `Your story "${updated.title_telugu}" is now live! Listeners can enjoy and vote for it.`,
    });

    return updated;
  }

  static rejectStory(storyId: string, reason: string, notes: string, adminId: string): Story {
    const rawStories = getStorageItem<Story[]>(STORAGE_KEYS.STORIES, memoryStories);
    const index = rawStories.findIndex((s) => s.id === storyId);
    if (index === -1) throw new Error('Story not found');

    const updated: Story = {
      ...rawStories[index],
      status: 'rejected',
      reject_reason: reason,
      reject_notes: notes,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
    };
    rawStories[index] = updated;
    memoryStories = rawStories;
    setStorageItem(STORAGE_KEYS.STORIES, rawStories);

    this.addNotification({
      user_id: updated.narrator_id,
      type: 'story_rejected',
      title: 'Story Feedback: Needs Revision',
      message: `${reason}. You can re-record and resubmit for free without paying again.`,
    });

    return updated;
  }

  // Weekly Winner & Shortlist
  static getWeeklyShortlist(): Story[] {
    const stories = this.getStories({ status: 'live' });
    return stories.slice(0, 5);
  }

  static confirmWeeklyWinner(storyId: string): WeeklyWinner {
    const story = this.getStoryById(storyId);
    if (!story) throw new Error('Story not found');

    const rawStories = getStorageItem<Story[]>(STORAGE_KEYS.STORIES, memoryStories);
    // Clear previous winner flag and set new winner
    rawStories.forEach((s) => {
      s.is_weekly_winner = s.id === storyId;
    });
    memoryStories = rawStories;
    setStorageItem(STORAGE_KEYS.STORIES, rawStories);

    const weekRange = getCurrentISTWeekRange();
    const winnerRecord: WeeklyWinner = {
      id: `winner-${Date.now()}`,
      story_id: story.id,
      narrator_id: story.narrator_id,
      week_start: weekRange.weekStart,
      week_end: weekRange.weekEnd,
      vote_count: story.vote_count || 1200,
      reward_amount: 1000,
      announced_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const winners = getStorageItem<WeeklyWinner[]>(STORAGE_KEYS.WINNERS, memoryWinners);
    winners.unshift(winnerRecord);
    memoryWinners = winners;
    setStorageItem(STORAGE_KEYS.WINNERS, winners);

    this.addNotification({
      user_id: story.narrator_id,
      type: 'weekly_winner',
      title: '🏆 You Won Story of the Week!',
      message: `Hearty congratulations! "${story.title_telugu}" is this week's winner with ₹1,000 cash reward.`,
    });

    return winnerRecord;
  }

  // Moderation / Reports
  static reportStory(params: { storyId: string; reporterId?: string; reason: StoryReport['reason']; details: string }): StoryReport {
    const reports = getStorageItem<StoryReport[]>(STORAGE_KEYS.REPORTS, memoryReports);
    const story = this.getStoryById(params.storyId);
    const newReport: StoryReport = {
      id: `report-${Date.now()}`,
      story_id: params.storyId,
      story_title: story?.title_telugu,
      reporter_id: params.reporterId,
      reason: params.reason,
      details: params.details,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    reports.unshift(newReport);
    memoryReports = reports;
    setStorageItem(STORAGE_KEYS.REPORTS, reports);
    return newReport;
  }

  static getReports(): StoryReport[] {
    return getStorageItem<StoryReport[]>(STORAGE_KEYS.REPORTS, memoryReports);
  }

  // Notifications
  static getNotifications(userId: string): NotificationItem[] {
    const notifs = getStorageItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, memoryNotifications);
    return notifs.filter((n) => n.user_id === userId);
  }

  static addNotification(item: Omit<NotificationItem, 'id' | 'created_at' | 'is_read'>): NotificationItem {
    const notifs = getStorageItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, memoryNotifications);
    const newNotif: NotificationItem = {
      ...item,
      id: `notif-${Date.now()}`,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    notifs.unshift(newNotif);
    memoryNotifications = notifs;
    setStorageItem(STORAGE_KEYS.NOTIFICATIONS, notifs);
    return newNotif;
  }

  static markNotificationRead(id: string): void {
    const notifs = getStorageItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, memoryNotifications);
    const n = notifs.find((item) => item.id === id);
    if (n) {
      n.is_read = true;
      memoryNotifications = notifs;
      setStorageItem(STORAGE_KEYS.NOTIFICATIONS, notifs);
    }
  }

  // Reset to seeds (helpful for testing and demos)
  static resetToDefault(): void {
    memoryProfiles = [...SEED_PROFILES];
    memoryStories = [...SEED_STORIES];
    memoryVotes = [];
    memoryPayments = [];
    memoryCredits = [
      {
        id: 'credit-saanvi-1',
        user_id: 'user-saanvi',
        status: 'available',
        created_at: new Date().toISOString(),
      },
    ];
    memoryWinners = [SEED_WINNER];
    memoryReports = [];
    memoryNotifications = [...SEED_NOTIFICATIONS];
    memoryCurrentUserId = 'user-saanvi';

    if (isBrowser) {
      localStorage.removeItem(STORAGE_KEYS.PROFILES);
      localStorage.removeItem(STORAGE_KEYS.STORIES);
      localStorage.removeItem(STORAGE_KEYS.VOTES);
      localStorage.removeItem(STORAGE_KEYS.PAYMENTS);
      localStorage.removeItem(STORAGE_KEYS.CREDITS);
      localStorage.removeItem(STORAGE_KEYS.WINNERS);
      localStorage.removeItem(STORAGE_KEYS.REPORTS);
      localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, 'user-saanvi');
    }
  }
}
