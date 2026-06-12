import { test, expect } from '@playwright/test';

test('login user, create playlist, add resource, configure cover, edit settings, switch layouts, and test deletion', async ({ page }) => {
  // Mark this multi-step DB-heavy test as slow (triples the timeout for this test to 90s)
  test.slow();

  const timestamp = Date.now();

  // 1. Log in as the pre-created test user
  await page.goto('http://localhost:3002/auth/login');
  await page.fill('#email', 'playwright_test_curator@stillwater.test');
  await page.fill('#password', 'password123');
  await page.click('#login-submit');

  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });

  // 2. Create a new playlist
  await page.goto('http://localhost:3002/playlists');
  
  // Click Create Playlist button (page-level button)
  await page.click('button:has-text("Create Playlist")');
  
  // Scope all modal interactions to the modal container
  const createModal = page.locator('[class*="backdrop-blur"]:has(span:has-text("New Playlist"))');
  await createModal.waitFor({ state: 'visible', timeout: 10000 });
  
  // Fill in playlist creation modal
  await createModal.locator('input[placeholder="e.g. Next.js Masterclass"]').fill(`Playwright Playlist ${timestamp}`);
  await createModal.locator('textarea[placeholder="Enter a brief summary..."]').fill('Verified by Playwright E2E tests');
  
  // Click Public visibility toggle (scoped inside the modal)
  await createModal.locator('button:has-text("Public")').click();
  
  // Click the Create submit button (scoped inside modal, text is just "Create" or "Creating...")
  await createModal.locator('button[type="submit"]').click();

  // Verify the playlist card is visible on the playlists page
  await expect(page.locator(`text=Playwright Playlist ${timestamp}`)).toBeVisible({ timeout: 15000 });

  // 3. Navigate to Resources to add a resource to this playlist
  await page.goto('http://localhost:3002/resources');
  
  // Wait for resource cards to load
  await page.waitForSelector('[id^="resource-card-"]', { timeout: 10000 });
  
  // Get the first resource card
  const resourceCard = page.locator('[id^="resource-card-"]').first();
  const resourceTitle = await resourceCard.locator('h3').first().textContent();
  console.log('Adding resource to playlist:', resourceTitle);

  // Click the save-to-playlist button (the list icon button)
  await resourceCard.hover();
  
  // Find button with title "Add to Playlist"
  const addBtn = resourceCard.locator('button[title="Add to Playlist"]');
  await addBtn.click();

  // Wait for AddToPlaylistModal to open
  await page.waitForSelector('span:has-text("Save to Playlist")', { timeout: 10000 });

  // Check the checkbox corresponding to our new playlist
  await page.click(`label:has-text("Playwright Playlist ${timestamp}")`);

  // Close modal by clicking the X close button in the modal header
  await page.locator('span:has-text("Save to Playlist") + button').click();
  
  // 4. Navigate back to the Playlist Details page
  await page.goto('http://localhost:3002/playlists');
  await page.click(`text=Playwright Playlist ${timestamp}`);

  // Wait for details page to load
  await expect(page).toHaveURL(/.*playlists\/.+/, { timeout: 10000 });

  // Verify details sidebar is expanded by default on load
  const collapseBtn = page.locator('button[title="Collapse Details"]');
  await expect(collapseBtn).toBeVisible({ timeout: 10000 });

  await expect(page.getByRole('heading', { name: `Playwright Playlist ${timestamp}` })).toBeVisible({ timeout: 10000 });
  
  // Verify the resource is in the list
  await expect(page.locator(`text=${resourceTitle}`).first()).toBeVisible();

  // 5. Test direct cover configuration from curated sequence card
  // Toggle layout to List View to show cover management actions
  const listViewBtn = page.locator('button[title="List View"]');
  await expect(listViewBtn).toBeVisible();
  await listViewBtn.click();

  const setCoverBtn = page.locator('button[title="Set as Playlist Cover"]');
  await expect(setCoverBtn).toBeVisible();
  
  // Click the Set as Playlist Cover button
  await setCoverBtn.click();
  
  // Verify that the button changes status and is highlighted as Active Playlist Cover
  await expect(page.locator('button[title="Active Playlist Cover"]')).toBeVisible({ timeout: 5000 });

  // 6. Test inline metadata settings editing
  await page.click('button:has-text("✏️ Edit")');
  await page.waitForSelector('span:has-text("Edit Playlist Settings")', { timeout: 5000 });

  // Edit fields (scoped inside the edit modal)
  const editModal = page.locator('[class*="backdrop-blur"]:has(span:has-text("Edit Playlist Settings"))');
  await editModal.locator('input[required]').fill(`Edited Playlist ${timestamp}`);
  await editModal.locator('textarea').fill('Description updated by Playwright test');

  // Change visibility to Private (scoped inside modal)
  await editModal.locator('button:has-text("Private")').click();

  // Choose Custom cover settings (scoped inside modal)
  await editModal.locator('label:has-text("Cover Thumbnail Source") + select').selectOption('custom');
  await editModal.locator('input[type="url"]').fill('https://images.unsplash.com/photo-1506744038136-46273834b3fb');

  // Save changes
  await editModal.locator('button:has-text("Save Settings")').click();

  // Verify modal is closed and metadata is updated
  await expect(page.locator('span:has-text("Edit Playlist Settings")')).not.toBeVisible();
  await expect(page.getByRole('heading', { name: `Edited Playlist ${timestamp}` })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('text=Description updated by Playwright test')).toBeVisible();
  await expect(page.locator('text=private')).toBeVisible();

  // 7. Test view mode selectors — scope to the specific toolbar div
  const viewToolbar = page.locator('div.rounded-2xl:has(button:has-text("List")):has(button:has-text("2 Cols"))');
  await expect(viewToolbar).toBeVisible();

  // Check initial state (List button is active with bg-primary)
  await expect(viewToolbar.locator('button:has-text("List")')).toHaveClass(/bg-primary/);

  // Switch to 2 Cols
  await viewToolbar.locator('button:has-text("2 Cols")').click();
  await expect(viewToolbar.locator('button:has-text("2 Cols")')).toHaveClass(/bg-primary/);
  await expect(page.locator('.grid-cols-1.sm\\:grid-cols-2')).toBeVisible();

  // Switch to 3 Cols
  await viewToolbar.locator('button:has-text("3 Cols")').click();
  await expect(viewToolbar.locator('button:has-text("3 Cols")')).toHaveClass(/bg-primary/);
  await expect(page.locator('.grid-cols-1.sm\\:grid-cols-2.md\\:grid-cols-3')).toBeVisible();

  // Switch to 4 Cols
  await viewToolbar.locator('button:has-text("4 Cols")').click();
  await expect(viewToolbar.locator('button:has-text("4 Cols")')).toHaveClass(/bg-primary/);
  await expect(page.locator('.grid-cols-1.sm\\:grid-cols-2.md\\:grid-cols-3.lg\\:grid-cols-4')).toBeVisible();

  // Switch to 5 Cols
  await viewToolbar.locator('button:has-text("5 Cols")').click();
  await expect(viewToolbar.locator('button:has-text("5 Cols")')).toHaveClass(/bg-primary/);
  await expect(page.locator('.grid-cols-1.sm\\:grid-cols-2.md\\:grid-cols-3.lg\\:grid-cols-4.xl\\:grid-cols-5')).toBeVisible();

  // Switch back to List
  await viewToolbar.locator('button:has-text("List")').click();
  await expect(viewToolbar.locator('button:has-text("List")')).toHaveClass(/bg-primary/);

  // 8. Verify drag-and-drop elements & arrow options are visible for curator
  await expect(page.locator('div[title="Drag to reorder"]')).toBeVisible();
  await expect(page.locator('button[title="Promote (Move Up)"]')).toBeVisible();
  await expect(page.locator('button[title="Demote (Move Down)"]')).toBeVisible();

  // 9. Verify deletion functionality
  await expect(page.locator('button[title="Remove from Playlist"]')).toBeVisible();
  
  // Click the delete button
  await page.click('button[title="Remove from Playlist"]');
  
  // Verify that the confirmation modal is open
  await expect(page.locator('span:has-text("Remove from Playlist")')).toBeVisible();
  await expect(page.locator(`text=Are you sure you want to remove`)).toBeVisible();
  
  // Click Cancel
  await page.click('button:has-text("Cancel")');
  
  // Modal should close and item should still be visible
  await expect(page.locator('span:has-text("Remove from Playlist")')).not.toBeVisible();
  await expect(page.locator(`text=${resourceTitle}`).first()).toBeVisible();
  
  // Click delete again
  await page.click('button[title="Remove from Playlist"]');
  
  // Click Remove
  await page.click('button:has-text("Remove")');
  
  // Modal should close and item should disappear from the list
  await expect(page.locator('span:has-text("Remove from Playlist")')).not.toBeVisible();
  await expect(page.locator(`text=${resourceTitle}`).first()).not.toBeVisible();

  // 10. Clean up: Delete the created playlist itself to prevent database pollution
  const deletePlaylistBtn = page.locator('button:has-text("🗑️ Delete")');
  await expect(deletePlaylistBtn).toBeVisible();
  await deletePlaylistBtn.click();

  // Wait for confirmation modal
  const deleteModal = page.locator('[class*="backdrop-blur"]:has(span:has-text("Delete Playlist"))');
  await deleteModal.waitFor({ state: 'visible', timeout: 5000 });

  // Click the confirm Delete button inside modal
  const confirmDeleteBtn = deleteModal.locator('button:has-text("Delete")');
  await confirmDeleteBtn.click();

  // Verify redirect back to /playlists catalog page
  await expect(page).toHaveURL(/.*playlists$/, { timeout: 10000 });

  console.log('Test completed successfully!');
});

test.afterEach(async ({ page }) => {
  try {
    console.log('[Cleanup] Starting cleanup...');
    // Navigate to the playlists list page
    await page.goto('http://localhost:3002/playlists');
    await page.waitForTimeout(1500); // Wait briefly for cards to load

    // Force List View to have a reliable checkbox selector
    const listViewBtn = page.locator('button[title="List View"]');
    if (await listViewBtn.isVisible()) {
      console.log('[Cleanup] Switching to List View');
      await listViewBtn.click();
      await page.waitForTimeout(500);
    }

    // Find any playlists whose title contains "Playwright Playlist"
    const cards = page.locator('div.group:has(h3:has-text("Playwright Playlist"))');
    const count = await cards.count();
    console.log(`[Cleanup] Found ${count} stray Playwright test playlist(s)`);
    
    if (count > 0) {
      // Click the Select Mode toggle button
      const selectModeBtn = page.locator('button[title="Select Mode"]');
      if (await selectModeBtn.isVisible()) {
        console.log('[Cleanup] Toggling Select Mode');
        await selectModeBtn.click();
        await page.waitForTimeout(500); // Wait for select checkboxes to render
      }

      // Select each matching card by dispatching a click event directly on the checkbox element
      for (let i = 0; i < count; i++) {
        console.log(`[Cleanup] Selecting card ${i}`);
        const card = cards.nth(i);
        const checkbox = card.locator('div.w-5.h-5');
        await checkbox.waitFor({ state: 'visible', timeout: 5000 });
        await checkbox.dispatchEvent('click');
      }
      
      // Click the bulk delete button
      const bulkDeleteBtn = page.locator('button:has-text("🗑 Delete")');
      await bulkDeleteBtn.waitFor({ state: 'visible', timeout: 3000 });
      console.log('[Cleanup] Clicking bulk delete button');
      await bulkDeleteBtn.dispatchEvent('click');

      // Wait for bulk delete confirmation modal and click Delete Permanently
      console.log('[Cleanup] Waiting for confirmation modal');
      const deleteModal = page.locator('[class*="backdrop-blur"]:has(span:has-text("Delete Playlists"))');
        await deleteModal.waitFor({ state: 'visible', timeout: 3000 });
        
        console.log('[Cleanup] Clicking Delete Permanently button');
        const confirmDeleteBtn = deleteModal.locator('button').last();
        await confirmDeleteBtn.waitFor({ state: 'visible', timeout: 3000 });
        await confirmDeleteBtn.dispatchEvent('click');
        
        // Wait for modal to disappear
        console.log('[Cleanup] Waiting for modal to disappear');
        await expect(deleteModal).not.toBeVisible();
    }
  } catch (err) {
    console.error('[Cleanup] Error during E2E test cleanup:', err);
  }
});
