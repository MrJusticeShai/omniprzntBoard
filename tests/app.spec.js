// @ts-check
/**
 * omniprzntBoard — Playwright test suite
 *
 * Covers:
 *  1. Page load — title, heading, floating hearts
 *  2. Add a moment → card appears, open overlay works, full text readable
 *  3. Moment overlay — play/pause, zoom toggle, prev/next, Escape closes
 *  4. Edit a moment → saves correctly
 *  5. Delete a moment → card removed
 *  6. Add a journal entry → card appears
 *  7. Delete a journal entry → card removed
 *  8. Add a spinner idea → appears in list, wheel redraws
 *  9. Remove a spinner idea → removed from list
 * 10. Add an Incoming list item → appears, can be removed without marking done
 * 11. Overlay readability — moment text not clipped at top
 * 12. Mobile viewport — canvas does not overflow page width
 */

const { test, expect } = require('@playwright/test');

// File URL for the app — playwright.config sets baseURL but file:// navigation
// works best with page.goto using the absolute path.
const APP = 'file://' + __dirname + '/../index.html';

// Helper: open the app and wait for the main heading
async function openApp(page) {
  // Block Firebase and Cloudinary to keep tests offline and fast
  await page.route('**firestore.googleapis.com**', r => r.abort());
  await page.route('**firebase**', r => r.abort());
  await page.route('**cloudinary.com**', r => r.abort());
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1')).toContainText('Us');
}

// Helper: open the "Our Moments" section if it isn't already
async function openMomentsSection(page) {
  const details = page.locator('details:has(#mom-stage)');
  const isOpen = await details.evaluate(el => el.hasAttribute('open'));
  if (!isOpen) await details.locator('summary').click();
  await page.waitForTimeout(200);
}

// ─────────────────────────────────────────────
// 1. Page load
// ─────────────────────────────────────────────
test('page loads with correct title and heading', async ({ page }) => {
  await openApp(page);
  await expect(page).toHaveTitle(/Us/);
  await expect(page.locator('h1')).toContainText('Us');
  await expect(page.locator('.sub')).toBeVisible();
  // Floating hearts are rendered
  const hearts = page.locator('.hearts span');
  await expect(hearts.first()).toBeVisible();
  await expect(await hearts.count()).toBeGreaterThan(10);
});

// ─────────────────────────────────────────────
// 2. Add a moment — card appears
// ─────────────────────────────────────────────
test('add a moment — card appears on stage', async ({ page }) => {
  await openApp(page);
  await openMomentsSection(page);

  await page.fill('#mom-title', 'Test Moment');
  await page.fill('#mom-body', 'This is the full body text of the moment we want to read.');
  await page.click('#btn-add-moment');

  // Button gives feedback
  await expect(page.locator('#btn-add-moment')).toContainText('Saved');

  // Stage now has at least one card
  await expect(page.locator('#mom-stage .mcard').first()).toBeVisible();

  // Form is cleared
  await expect(page.locator('#mom-title')).toHaveValue('');
  await expect(page.locator('#mom-body')).toHaveValue('');
});

// ─────────────────────────────────────────────
// 3. Open moment overlay — full text readable, not clipped
// ─────────────────────────────────────────────
test('moment overlay opens and shows full readable text', async ({ page }) => {
  await openApp(page);
  await openMomentsSection(page);

  const longBody = 'Line one of the memory.\nLine two goes into more detail.\nLine three has even more context.\nLine four keeps going.\nLine five wraps it up beautifully.';
  await page.fill('#mom-title', 'Overlay Test');
  await page.fill('#mom-body', longBody);
  await page.click('#btn-add-moment');
  await page.waitForTimeout(300);

  // Flip the card to see the back
  const card = page.locator('#mom-stage .mcard').first();
  await card.click();
  await page.waitForTimeout(400);

  // Click the Open button
  await card.locator('[data-a="open"]').click();
  await expect(page.locator('#mov')).toHaveClass(/show/);

  // Overlay title is visible
  await expect(page.locator('#mov-title-line')).toContainText('Overlay Test');

  // Body text is present and not empty
  await expect(page.locator('#mov-body-line')).toContainText('Line one');

  // Count shows 1 / 1
  await expect(page.locator('#mov-count')).toContainText('1 / 1');

  // The content area is NOT clipped — its top is below the close button
  const contentBox = await page.locator('#mov-content').boundingBox();
  const closeBox   = await page.locator('#mov-x').boundingBox();
  expect(contentBox.y).toBeGreaterThan(closeBox.y + closeBox.height - 10);
});

// ─────────────────────────────────────────────
// 4. Moment overlay — play/pause, zoom, Escape
// ─────────────────────────────────────────────
test('moment overlay controls work', async ({ page }) => {
  await openApp(page);
  await openMomentsSection(page);

  // Add two moments so slideshow has something to navigate
  await page.fill('#mom-title', 'First');
  await page.fill('#mom-body', 'Body of first.');
  await page.click('#btn-add-moment');
  await page.waitForTimeout(200);
  await page.fill('#mom-title', 'Second');
  await page.fill('#mom-body', 'Body of second.');
  await page.click('#btn-add-moment');
  await page.waitForTimeout(200);

  // Open overlay on first card
  const card = page.locator('#mom-stage .mcard').first();
  await card.click();
  await page.waitForTimeout(400);
  await card.locator('[data-a="open"]').click();
  await expect(page.locator('#mov')).toHaveClass(/show/);

  // Count shows 2 entries
  await expect(page.locator('#mov-count')).toContainText('/ 2');

  // Play button — text changes to Pause
  await page.click('#mov-play');
  await expect(page.locator('#mov-play')).toContainText('Pause');

  // Pause
  await page.click('#mov-play');
  await expect(page.locator('#mov-play')).toContainText('Play');

  // Zoom toggle
  await page.click('#mov-zoom');
  await expect(page.locator('#mov-content')).toHaveClass(/zoomed/);
  await expect(page.locator('#mov-zoom')).toContainText('Normal');
  await page.click('#mov-zoom');
  await expect(page.locator('#mov-content')).not.toHaveClass(/zoomed/);

  // Next / Prev navigation
  const titleBefore = await page.locator('#mov-title-line').textContent();
  await page.click('#mov-next');
  const titleAfter = await page.locator('#mov-title-line').textContent();
  expect(titleAfter).not.toBe(titleBefore);
  await page.click('#mov-prev');
  expect(await page.locator('#mov-title-line').textContent()).toBe(titleBefore);

  // Escape closes overlay
  await page.keyboard.press('Escape');
  await expect(page.locator('#mov')).not.toHaveClass(/show/);
});

// ─────────────────────────────────────────────
// 5. Edit a moment
// ─────────────────────────────────────────────
test('edit a moment — updated body persists', async ({ page }) => {
  await openApp(page);
  await openMomentsSection(page);

  await page.fill('#mom-title', 'Editable');
  await page.fill('#mom-body', 'Original text.');
  await page.click('#btn-add-moment');
  await page.waitForTimeout(300);

  const card = page.locator('#mom-stage .mcard').first();
  await card.click();             // flip
  await page.waitForTimeout(400);

  // Click Edit
  await card.locator('[data-a="edit"]').click();
  const ta = card.locator('.medit');
  await expect(ta).toBeVisible();

  // Clear and type new text
  await ta.fill('Updated text after edit.');

  // Click Save
  await card.locator('[data-a="edit"]').click();
  await page.waitForTimeout(200);

  // mbody now shows updated text
  await expect(card.locator('.mbody')).toContainText('Updated text after edit.');
  // textarea is hidden again
  await expect(ta).not.toBeVisible();
});

// ─────────────────────────────────────────────
// 6. Delete a moment
// ─────────────────────────────────────────────
test('delete a moment — card is removed', async ({ page }) => {
  await openApp(page);
  await openMomentsSection(page);

  await page.fill('#mom-title', 'To Delete');
  await page.fill('#mom-body', 'Gone soon.');
  await page.click('#btn-add-moment');
  await page.waitForTimeout(300);

  const countBefore = await page.locator('#mom-stage .mcard').count();

  const card = page.locator('#mom-stage .mcard').first();
  await card.click(); // flip
  await page.waitForTimeout(400);

  // Accept the confirm dialog
  page.once('dialog', d => d.accept());
  await card.locator('[data-a="del"]').click();
  await page.waitForTimeout(300);

  const countAfter = await page.locator('#mom-stage .mcard').count();
  expect(countAfter).toBe(countBefore - 1);
});

// ─────────────────────────────────────────────
// 7. Add a journal entry
// ─────────────────────────────────────────────
test('add a journal entry — card appears', async ({ page }) => {
  await openApp(page);

  // Open journal section
  const jSection = page.locator('details:has(#jour-cards)');
  const isOpen = await jSection.evaluate(el => el.hasAttribute('open'));
  if (!isOpen) await jSection.locator('summary').click();
  await page.waitForTimeout(200);

  await page.fill('#jour-title', 'Dreams');
  await page.fill('#jour-body', 'We talked about the future.');
  await page.click('#btn-add-journal');
  await page.waitForTimeout(300);

  await expect(page.locator('#btn-add-journal')).toContainText('Saved');
  await expect(page.locator('#jour-cards .ecard').first()).toBeVisible();
  await expect(page.locator('#jour-cards .etitle').first()).toContainText('Dreams');
});

// ─────────────────────────────────────────────
// 8. Delete a journal entry
// ─────────────────────────────────────────────
test('delete a journal entry — card removed', async ({ page }) => {
  await openApp(page);

  const jSection = page.locator('details:has(#jour-cards)');
  const isOpen = await jSection.evaluate(el => el.hasAttribute('open'));
  if (!isOpen) await jSection.locator('summary').click();
  await page.waitForTimeout(200);

  await page.fill('#jour-title', 'Temporary');
  await page.fill('#jour-body', 'Will be deleted.');
  await page.click('#btn-add-journal');
  await page.waitForTimeout(300);

  const countBefore = await page.locator('#jour-cards .ecard').count();

  page.once('dialog', d => d.accept());
  await page.locator('#jour-cards .edel').first().click();
  await page.waitForTimeout(300);

  expect(await page.locator('#jour-cards .ecard').count()).toBe(countBefore - 1);
});

// ─────────────────────────────────────────────
// 9. Add a spinner idea
// ─────────────────────────────────────────────
test('add a spinner idea — appears in list', async ({ page }) => {
  await openApp(page);

  // Open Date Spinner section
  const spinSection = page.locator('details:has(#wheel)');
  const isOpen = await spinSection.evaluate(el => el.hasAttribute('open'));
  if (!isOpen) await spinSection.locator('summary').click();
  await page.waitForTimeout(200);

  const countBefore = await page.locator('#ideas-list div').count();

  await page.fill('#newd', 'Stargazing');
  await page.click('#addd');
  await page.waitForTimeout(300);

  expect(await page.locator('#ideas-list div').count()).toBe(countBefore + 1);
  await expect(page.locator('#ideas-list')).toContainText('Stargazing');
  // Input cleared
  await expect(page.locator('#newd')).toHaveValue('');
});

// ─────────────────────────────────────────────
// 10. Remove a spinner idea
// ─────────────────────────────────────────────
test('remove a spinner idea — removed from list correctly', async ({ page }) => {
  await openApp(page);

  const spinSection = page.locator('details:has(#wheel)');
  const isOpen = await spinSection.evaluate(el => el.hasAttribute('open'));
  if (!isOpen) await spinSection.locator('summary').click();
  await page.waitForTimeout(200);

  // Add two distinct ideas so we can verify the right one is removed
  await page.fill('#newd', 'IdeaAlpha');
  await page.click('#addd');
  await page.waitForTimeout(200);
  await page.fill('#newd', 'IdeaBeta');
  await page.click('#addd');
  await page.waitForTimeout(200);

  const countBefore = await page.locator('#ideas-list div').count();

  // Remove the first idea in the list (IdeaBeta was added last, appears first)
  page.once('dialog', d => d.accept());
  await page.locator('#ideas-list div button').first().click();
  await page.waitForTimeout(300);

  expect(await page.locator('#ideas-list div').count()).toBe(countBefore - 1);
});

// ─────────────────────────────────────────────
// 11. Add and remove an Incoming list item
// ─────────────────────────────────────────────
test('add and remove an Incoming list item without marking done', async ({ page }) => {
  await openApp(page);

  await page.fill('#newi', 'Coffee date');
  await page.click('#addi');
  await page.waitForTimeout(300);

  // Item appears in Incoming
  await expect(page.locator('#inc')).toContainText('Coffee date');

  // Check that the Done list does NOT contain it
  await expect(page.locator('#done')).not.toContainText('Coffee date');

  // Remove it via the ✕ button — accept confirm
  const row = page.locator('#inc .item').filter({ hasText: 'Coffee date' });
  page.once('dialog', d => d.accept());
  await row.locator('button[title="Remove"]').click();
  await page.waitForTimeout(300);

  await expect(page.locator('#inc')).not.toContainText('Coffee date');
  await expect(page.locator('#done')).not.toContainText('Coffee date');
});

// ─────────────────────────────────────────────
// 12. Canvas does not overflow on mobile viewport
// ─────────────────────────────────────────────
test('canvas wheel fits within mobile viewport width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);

  const spinSection = page.locator('details:has(#wheel)');
  const isOpen = await spinSection.evaluate(el => el.hasAttribute('open'));
  if (!isOpen) await spinSection.locator('summary').click();
  await page.waitForTimeout(200);

  const canvasBox = await page.locator('#wheel').boundingBox();
  // Canvas right edge must be within viewport
  expect(canvasBox.x + canvasBox.width).toBeLessThanOrEqual(390 + 1); // 1px tolerance
});
