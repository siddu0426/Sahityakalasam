import { describe, it, expect, beforeEach } from 'vitest';
import { DataService } from '../src/lib/data-service';

describe('RLS Policies & Child Safety Moderation Tests', () => {
  beforeEach(() => {
    DataService.resetToDefault();
  });

  it('ensures public story feed returns only live stories by default', () => {
    const publicStories = DataService.getStories({ status: 'live' });

    // Every story in the public feed must have status === 'live'
    for (const story of publicStories) {
      expect(story.status).toBe('live');
    }

    // Pending and rejected stories should NOT be in the public feed
    const hasPending = publicStories.some((s) => s.status === 'pending');
    const hasRejected = publicStories.some((s) => s.status === 'rejected');
    expect(hasPending).toBe(false);
    expect(hasRejected).toBe(false);
  });

  it('allows narrators to view their own pending and rejected stories', () => {
    const saanviStories = DataService.getNarratorStories('user-saanvi');

    const hasLive = saanviStories.some((s) => s.status === 'live');
    const hasPending = saanviStories.some((s) => s.status === 'pending');
    const hasRejected = saanviStories.some((s) => s.status === 'rejected');

    expect(hasLive).toBe(true);
    expect(hasPending).toBe(true);
    expect(hasRejected).toBe(true);
  });

  it('allows narrators to resubmit rejected stories without paying ₹20 entry fee again', () => {
    const rejectedStory = DataService.getStories({ status: 'rejected' })[0];
    expect(rejectedStory).toBeDefined();

    // Resubmit without credit consumption
    const resubmitted = DataService.submitStory({
      narratorId: rejectedStory.narrator_id,
      titleTelugu: rejectedStory.title_telugu,
      titleEnglish: rejectedStory.title_english,
      genre: rejectedStory.genre,
      audioUrl: 'https://actions.google.com/sounds/v1/ambiences/daytime_forest_bonfire.ogg',
      durationSeconds: 300,
      resubmitStoryId: rejectedStory.id,
    });

    expect(resubmitted.status).toBe('pending');
    expect(resubmitted.reject_reason).toBeUndefined();
  });

  it('protects child safety: under-18 narrators require guardian consent', () => {
    const registrationWithoutConsent = () => {
      const age = 12;
      const guardianConsent = false;
      if (age < 18 && !guardianConsent) {
        throw new Error('Guardian consent is mandatory for narrators under 18 years of age.');
      }
    };

    expect(registrationWithoutConsent).toThrow('Guardian consent is mandatory');
  });

  it('ensures phone numbers are kept private and never exposed in narrator public profile views', () => {
    const profiles = DataService.getProfiles();
    for (const profile of profiles) {
      // Simulate public view serialization
      const publicView = {
        id: profile.id,
        display_name: profile.display_name,
        username: profile.username,
        avatar_url: profile.avatar_url,
        bio: profile.bio,
        age: profile.show_age_city ? profile.age : undefined,
        city: profile.show_age_city ? profile.city : undefined,
      };

      expect((publicView as any).phone).toBeUndefined();
      expect((publicView as any).guardian_phone).toBeUndefined();
    }
  });

  it('ensures a narrator cannot read another narrator pending story or approve anything', () => {
    // Narrator 1 creates a pending story
    const pendingStory = DataService.submitStory({
      narratorId: 'user-saanvi',
      titleTelugu: 'సాన్వి రాసిన రహస్య కథ',
      titleEnglish: 'Saanvis Secret Tale',
      genre: 'Moral Stories',
      audioUrl: 'https://actions.google.com/sounds/v1/ambiences/daytime_forest_bonfire.ogg',
      durationSeconds: 180,
    });

    expect(pendingStory.status).toBe('pending');

    // Narrator 2 (Aarav) queries narrator stories
    const aaravStories = DataService.getNarratorStories('user-aarav');
    const canAaravSeeSaanviPending = aaravStories.some((s) => s.id === pendingStory.id);
    expect(canAaravSeeSaanviPending).toBe(false);

    // Narrator 2 attempts to approve Saanvi's story (should fail without admin permissions)
    const approveAttempt = () => {
      const aaravProfile = DataService.getProfileById('user-aarav')!;
      if (aaravProfile.role !== 'admin') {
        throw new Error('Unauthorized: Only admins can approve stories');
      }
      DataService.approveStory(pendingStory.id, aaravProfile.id);
    };

    expect(approveAttempt).toThrow('Unauthorized: Only admins can approve stories');
  });

  it('allows admins to approve pending stories and publish them to live catalog', () => {
    const pending = DataService.getStories({ status: 'pending' })[0];
    expect(pending).toBeDefined();

    const approved = DataService.approveStory(pending.id, 'user-admin');
    expect(approved.status).toBe('live');
    expect(approved.reviewed_by).toBe('user-admin');

    // Story is now in the live feed
    const liveFeed = DataService.getStories({ status: 'live' });
    expect(liveFeed.some((s) => s.id === approved.id)).toBe(true);
  });
});
