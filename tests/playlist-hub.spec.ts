import { test, expect } from '@playwright/test';

test('playlist details page collapsed state and hub link test', async ({ page }) => {
  // Mock the lists endpoint
  await page.route('**/api/playlists?search=*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            id: 'mock-playlist-123',
            title: 'Mock Playlist',
            description: 'A mock playlist for testing.',
            resourceIds: [],
            status: 'published',
            creator: { displayName: 'Tester' }
          }
        ]
      })
    });
  });

  // Mock the detail endpoint
  await page.route('**/api/playlists/mock-playlist-123', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: 'mock-playlist-123',
          title: 'Mock Playlist',
          description: 'A mock playlist for testing.',
          resources: [],
          status: 'published',
          creator: { displayName: 'Tester' }
        }
      })
    });
  });

  // 1. Navigate to the playlists hub catalog
  await page.goto('http://localhost:3002/playlists');
  
  // Wait for playlist cards to load
  await page.waitForSelector('.glass-card');
  
  // 2. Click the first playlist card
  await page.locator('.glass-card').first().click();
  
  // Wait for the details page wrapper to load
  await page.waitForURL(/\/playlists\/.+/);
  
  // 3. Verify sticky sidebar is expanded by default (lg:col-span-4)
  const expandedSidebar = page.locator('div.lg\\:col-span-4');
  await expect(expandedSidebar).toBeVisible();
  
  // 4. Verify "Playlists Hub" link text is visible
  const hubLink = page.locator('a[title="Playlists Hub"]');
  await expect(hubLink).toBeVisible();
  
  const label = hubLink.locator('span');
  await expect(label).toBeVisible();
  await expect(label).toHaveText('Playlists Hub');
  
  // 5. Click the collapse/expand toggle button to collapse the sidebar
  const toggleBtn = page.locator('button[title="Collapse Details"]');
  await expect(toggleBtn).toBeVisible();
  await toggleBtn.click();
  
  // 6. Verify sidebar is now collapsed (lg:col-span-1)
  const sidebar = page.locator('div.lg\\:col-span-1');
  await expect(sidebar).toBeVisible();
  
  // 7. Verify text "Playlists Hub" is hidden
  await expect(label).toBeHidden();
  
  // 8. Toggle it back to expanded
  const expandBtn = page.locator('button[title="Expand Details"]');
  await expect(expandBtn).toBeVisible();
  await expandBtn.click();
  
  // Verify it returns to expanded with text visible
  await expect(expandedSidebar).toBeVisible();
  await expect(label).toBeVisible();
});
