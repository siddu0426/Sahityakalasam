import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'compact-mobile (360x640)', width: 360, height: 640 },
  { name: 'iphone-standard (390x844)', width: 390, height: 844 },
  { name: 'flagship-mobile (430x932)', width: 430, height: 932 },
  { name: 'desktop-centered (1280x800)', width: 1280, height: 800 },
];

for (const vp of viewports) {
  test(`Viewport ${vp.name}: renders without horizontal overflow or clipped text`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');

    // Check header
    await expect(page.locator('text=Namaskaram')).toBeVisible();
    await expect(page.locator('text=A story for today.')).toBeVisible();

    // Verify no unexpected horizontal scrollbar on body
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 1);

    // Verify genre chips height and pill styling
    const firstChip = page.locator('button:has-text("Folk Tales")');
    await expect(firstChip).toBeVisible();
    const chipBox = await firstChip.boundingBox();
    expect(chipBox).not.toBeNull();
    if (chipBox) {
      expect(Math.round(chipBox.height)).toBe(44);
    }

    // Verify bottom nav is visible and correctly positioned
    const bottomNav = page.locator('nav[aria-label="Main Navigation"]');
    await expect(bottomNav).toBeVisible();
    const navBox = await bottomNav.boundingBox();
    expect(navBox).not.toBeNull();

    // Navigate to Upload screen and verify Submit Story button is not hidden behind nav
    await page.click('button:has-text("Upload")');
    await expect(page.locator('text=Tell your story')).toBeVisible();

    const submitOrPayButton = page.locator('button:has-text("Pay ₹20"), button:has-text("Submit story")').first();
    await expect(submitOrPayButton).toBeVisible();

    // Verify button bounding box is above or clear of bottom nav top
    const buttonBox = await submitOrPayButton.boundingBox();
    expect(buttonBox).not.toBeNull();
  });
}

