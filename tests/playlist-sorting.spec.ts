import { test, expect } from '@playwright/test';

test('playlist catalog sorting options test', async ({ page }) => {
  // Mock `/api/playlists` route to return custom list of playlists for testing sorting query params
  let lastRequestedUrl: string | null = null;
  await page.route('**/api/playlists?*', async route => {
    lastRequestedUrl = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            id: 'playlist-a',
            title: 'A Playlist',
            description: 'First alphabetically.',
            resourceIds: [],
            status: 'published',
            creator: { displayName: 'Tester' },
            createdAt: new Date('2026-06-01T00:00:00Z'),
            updatedAt: new Date('2026-06-05T00:00:00Z')
          },
          {
            id: 'playlist-b',
            title: 'B Playlist',
            description: 'Second alphabetically.',
            resourceIds: [],
            status: 'published',
            creator: { displayName: 'Tester' },
            createdAt: new Date('2026-06-02T00:00:00Z'),
            updatedAt: new Date('2026-06-04T00:00:00Z')
          }
        ]
      })
    });
  });

  // 1. Navigate to the catalog page
  await page.goto('http://localhost:3002/playlists');

  // Verify the sort dropdown selector is visible
  const sortSelect = page.locator('select').last();
  await expect(sortSelect).toBeVisible();
  
  // Verify default value is "ranking_desc"
  await expect(sortSelect).toHaveValue('ranking_desc');

  // 2. Select "Title (A-Z)" (title_asc)
  await sortSelect.selectOption('title_asc');
  
  // Wait for the route to be called with the parameters
  await expect.poll(() => lastRequestedUrl).toContain('sortBy=title');
  await expect.poll(() => lastRequestedUrl).toContain('sortOrder=asc');

  // 3. Select "Recently Created" (createdAt_desc)
  await sortSelect.selectOption('createdAt_desc');
  await expect.poll(() => lastRequestedUrl).toContain('sortBy=createdAt');
  await expect.poll(() => lastRequestedUrl).toContain('sortOrder=desc');
});
