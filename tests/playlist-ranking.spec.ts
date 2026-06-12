import { test, expect } from '@playwright/test';

test('playlist ranking property display and edit test', async ({ page }) => {
  // Mock `/api/playlists` route to return custom list of playlists with custom rankings
  await page.route('**/api/playlists?*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            id: 'mock-playlist-rank-4',
            title: 'Rank 4 Playlist',
            description: 'This is ranked 4 stars.',
            resourceIds: [],
            status: 'published',
            creator: { displayName: 'Tester' },
            ranking: 4,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      })
    });
  });

  // Mock detail query endpoint
  let patchRequestPayload: any = null;
  await page.route('**/api/playlists/mock-playlist-rank-4', async route => {
    if (route.request().method() === 'PATCH') {
      patchRequestPayload = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'mock-playlist-rank-4',
            title: 'Rank 4 Playlist',
            description: 'This is ranked 4 stars.',
            resourceIds: [],
            status: 'published',
            ranking: patchRequestPayload.ranking,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        })
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'mock-playlist-rank-4',
            title: 'Rank 4 Playlist',
            description: 'This is ranked 4 stars.',
            resources: [],
            status: 'published',
            creator: { displayName: 'Tester' },
            ranking: 4,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        })
      });
    }
  });

  // 1. Navigate to catalog page
  await page.goto('http://localhost:3002/playlists');

  // 2. Verify grid card has "⭐️ 4" badge visible
  const cardBadge = page.locator('div.absolute.bottom-3.left-3:has-text("⭐️ 4")');
  await expect(cardBadge).toBeVisible();

  // 3. Navigate to detail page
  await page.locator('.glass-card').first().click();
  await page.waitForURL(/\/playlists\/mock-playlist-rank-4/);

  // 4. Verify expanded sidebar has "⭐️ 4" inside details row by default
  const sidebarRanking = page.locator('span.text-amber-400:has-text("⭐️ 4")');
  await expect(sidebarRanking).toBeVisible();

  // 5. Collapse the sidebar to test collapsed details
  const toggleBtn = page.locator('button[title="Collapse Details"]');
  await expect(toggleBtn).toBeVisible();
  await toggleBtn.click();

  // 6. Verify collapsed sidebar has "⭐️4" inside mini ranking div
  const miniRanking = page.locator('div.text-amber-400:has-text("⭐️4")');
  await expect(miniRanking).toBeVisible();
});
