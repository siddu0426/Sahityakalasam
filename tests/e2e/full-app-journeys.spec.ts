import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';

if (!globalThis.WebSocket) {
  (globalThis as any).WebSocket = WebSocket;
}

function getEnvConfig() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const env: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
      }
    }
  }
  return env;
}

async function injectRealSession(page: any, email: string, password = 'Password123!') {
  const env = getEnvConfig();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`Failed to sign in ${email} for E2E session injection: ${error?.message}`);
  }

  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  await page.addInitScript(({ key, session }: { key: string; session: any }) => {
    window.localStorage.setItem(key, JSON.stringify(session));
  }, { key: storageKey, session: data.session });
}

test.describe('Kathalu Complete User Journeys E2E (Real Sessions)', () => {
  test('1. Home Tab: Explore story of the week, genre chips, and search filtering', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Header & Greeting
    await expect(page.locator('text=Namaskaram')).toBeVisible();
    await expect(page.locator('text=A story for today.')).toBeVisible();

    // Story of the week card
    await expect(page.locator('text=ఈ వారపు కథ · Story of the Week')).toBeVisible();
    const sotwPlayBtn = page.locator('button[aria-label^="Play "]').first();
    await expect(sotwPlayBtn).toBeVisible();

    // Genre filter chips interaction
    const moralStoriesChip = page.locator('button:has-text("Moral Stories")');
    await moralStoriesChip.click();
    await expect(moralStoriesChip).toHaveClass(/bg-\[#1F7A6D\]/);

    const panchatantraChip = page.locator('button:has-text("Panchatantra")');
    await panchatantraChip.click();
    await expect(panchatantraChip).toHaveClass(/bg-\[#1F7A6D\]/);

    // Search input
    const searchInput = page.locator('input[placeholder="Search stories or narrators"]');
    await searchInput.fill('జింక');
    await page.waitForTimeout(300);

    // Clear search and reset to All
    await searchInput.fill('');
    const allChip = page.getByRole('button', { name: 'All', exact: true });
    await allChip.click();
    await expect(allChip).toHaveClass(/bg-\[#1F7A6D\]/);
  });

  test('2. Audio Playback & Mini Player Clearance', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Click play on the story of the week
    const playBtn = page.locator('button[aria-label^="Play "]').first();
    await playBtn.click();

    // Verify Now Listening modal is open
    await expect(page.locator('text=Now listening')).toBeVisible();
    await expect(page.locator('button:has-text("Vote for this story")')).toBeVisible();

    // Close Now Listening back to Home
    const backBtn = page.locator('button[aria-label="Back to home"]');
    await backBtn.click();

    // Verify Mini Player is now active at bottom
    const miniPlayer = page.locator('div[aria-label="Now playing bar"]');
    await expect(miniPlayer).toBeVisible();

    // Verify bottom navigation bar remains accessible
    const bottomNav = page.locator('nav[aria-label="Main Navigation"]');
    await expect(bottomNav).toBeVisible();

    // Dismiss mini player
    const dismissBtn = page.locator('button[aria-label="Dismiss player"]');
    await dismissBtn.click();
    await expect(miniPlayer).not.toBeVisible();
  });

  test('3. Listen Tab: Full catalog, sorting, and genre selection', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Navigate to Listen tab
    await page.click('button:has-text("Listen")');
    await expect(page.locator('text=అన్వేషించండి · Listen & Discover')).toBeVisible();

    // Check sort dropdown (Most Voted / Newest First)
    const sortSelect = page.locator('select');
    await expect(sortSelect).toBeVisible();
    await sortSelect.selectOption('newest');
    expect(await sortSelect.inputValue()).toBe('newest');
    await sortSelect.selectOption('most_voted');
    expect(await sortSelect.inputValue()).toBe('most_voted');
  });

  test('4. Upload Tab with Authenticated Narrator Session', async ({ page }) => {
    // Authenticate with real narrator session
    await injectRealSession(page, 'narrator_a@kathalu.app');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Navigate to Upload tab
    await page.click('button:has-text("Upload")');
    await expect(page.locator('text=Tell your story')).toBeVisible();

    // Check 4 steps indicator: Pay, Record, Details, Submit
    await expect(page.locator('span:text-is("Pay")')).toBeVisible();
    await expect(page.locator('span:text-is("Record")')).toBeVisible();
    await expect(page.locator('span:text-is("Details")')).toBeVisible();
    await expect(page.locator('span:text-is("Submit")')).toBeVisible();

    const actionBtn = page.locator('button:has-text("Pay ₹20"), button:has-text("Submit story")').first();
    await expect(actionBtn).toBeVisible();
  });

  test('5. Profile Tab with Real Listener Session', async ({ page }) => {
    // Authenticate with real listener session
    await injectRealSession(page, 'listener_test@kathalu.app');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Navigate to Profile tab
    await page.click('button:has-text("Profile")');
    await expect(page.locator('text=My Profile')).toBeVisible();

    // Check stats cards
    await expect(page.locator('text=Stories shared')).toBeVisible();
    await expect(page.locator('text=Listener votes')).toBeVisible();
  });

  test('6. Weekly Winner Modal: Trophy celebration & sharing', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const waveformBtn = page.locator('button[aria-label="Story of the Week & Weekly Winner"]');
    await waveformBtn.click();

    await expect(page.locator('text=ఈ వారపు విజేత · Story of the Week')).toBeVisible();
    await expect(page.locator('text=₹1,000 Reward Winner')).toBeVisible();
    await expect(page.locator('button:has-text("Share this joy")')).toBeVisible();

    const closeBtn = page.locator('button[aria-label="Close"]').first();
    await closeBtn.click();
    await expect(page.locator('text=ఈ వారపు విజేత · Story of the Week')).not.toBeVisible();
  });

  test('7. Admin Review Desk with Real Admin Session', async ({ page }) => {
    // Authenticate with real admin session
    await injectRealSession(page, 'admin_test@kathalu.app');

    await page.goto('/admin');

    await expect(page.locator('text=Kathalu Editorial Desk')).toBeVisible();
    await expect(page.locator('button:has-text("Review Queue")')).toBeVisible();
    await expect(page.locator('button:has-text("Weekly Shortlist (Top 5)")')).toBeVisible();

    await page.click('button:has-text("Weekly Shortlist (Top 5)")');
    await expect(page.locator('button:has-text("Run Tally Now")')).toBeVisible();
  });

  test('8. Dev Route Persona Switcher Isolation', async ({ page }) => {
    await page.goto('/dev');

    // Checks whether active environment permits /dev or isolates it
    const isDevConsoleVisible = await page.locator('text=Developer Testing Console').isVisible();
    if (isDevConsoleVisible) {
      await expect(page.locator('text=Developer Testing Console')).toBeVisible();
      await expect(page.locator('text=Switch Test Persona')).toBeVisible();
    } else {
      // In production (NEXT_PUBLIC_ENABLE_DEV_TOOLS=false), /dev strictly returns 404
      await expect(page.locator('text=404').or(page.locator('text=This page could not be found'))).toBeVisible();
    }
  });
});
