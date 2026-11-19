import { describe, it, expect, beforeEach } from 'vitest';
import { DataService } from '../src/lib/data-service';
import { getCurrentISTWeekStart } from '../src/lib/constants';

describe('Vote Uniqueness & IST Week Rules', () => {
  const testUserId = 'test-user-123';
  const testStoryId = 'story-1';

  beforeEach(() => {
    DataService.resetToDefault();
  });

  it('calculates the Monday start of the week accurately for IST (+05:30)', () => {
    // 2026-11-08 is a Sunday in IST
    const sundayDate = new Date('2026-11-08T10:00:00+05:30');
    const weekStart = getCurrentISTWeekStart(sundayDate);
    // The Monday of this week is Nov 2, 2026
    expect(weekStart).toBe('2026-11-02');
  });

  it('allows a user to cast one vote for a story in the current week', () => {
    const res1 = DataService.voteForStory(testUserId, testStoryId);
    expect(res1.success).toBe(true);
    expect(res1.hasVoted).toBe(true);
  });

  it('toggles the vote off when clicked again by the same user', () => {
    // First vote
    const res1 = DataService.voteForStory(testUserId, testStoryId);
    expect(res1.hasVoted).toBe(true);

    // Second click toggles off
    const res2 = DataService.voteForStory(testUserId, testStoryId);
    expect(res2.success).toBe(true);
    expect(res2.hasVoted).toBe(false);
  });

  it('prevents multiple duplicate votes from incrementing tally for the same user in the same week', () => {
    const initialStory = DataService.getStoryById(testStoryId)!;
    const initialVotes = initialStory.vote_count || 0;

    // Vote once
    const res1 = DataService.voteForStory(testUserId, testStoryId);
    expect(res1.newVoteCount).toBe(initialVotes + 1);

    // Attempting to cast vote again toggles it off, keeping vote count consistent
    const res2 = DataService.voteForStory(testUserId, testStoryId);
    expect(res2.newVoteCount).toBe(initialVotes);
  });

  it('handles concurrent voting requests idempotently without duplicate records', async () => {
    // Simulate multiple simultaneous voting requests from the exact same user
    await Promise.all([
      DataService.voteForStory(testUserId, testStoryId),
      DataService.voteForStory(testUserId, testStoryId),
      DataService.voteForStory(testUserId, testStoryId),
    ]);

    // Check all votes in database for this user and story in the current week
    const allVotes = DataService.getVotes().filter(
      (v) => v.user_id === testUserId && v.story_id === testStoryId && v.week_start === getCurrentISTWeekStart()
    );

    // Concurrency must never produce more than 1 active vote for the user
    expect(allVotes.length).toBeLessThanOrEqual(1);
  });
});
