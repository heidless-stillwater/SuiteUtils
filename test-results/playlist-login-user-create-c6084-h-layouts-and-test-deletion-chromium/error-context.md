# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: playlist.spec.ts >> login user, create playlist, add resource, configure cover, edit settings, switch layouts, and test deletion
- Location: tests/playlist.spec.ts:3:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('div.rounded-2xl:has(button:has-text("List")):has(button:has-text("2 Cols"))')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('div.rounded-2xl:has(button:has-text("List")):has(button:has-text("2 Cols"))')

```

```yaml
- navigation:
  - link "Sovereign Resources v0.1.0 Live Sync Active":
    - /url: /
    - img
    - heading "Sovereign Resources" [level=1]
    - text: v0.1.0
    - paragraph: Live Sync Active
  - button "Toggle Suite Switcher"
  - link "Dashboard":
    - /url: /dashboard
  - link "Resources":
    - /url: /resources
  - link "Playlists":
    - /url: /playlists
  - link "Sources":
    - /url: /creators
  - text: Playwright Test Curator Basic Access
  - button "Switch to Creamy Alabaster (Light)":
    - img
  - button "P"
- main:
  - link "Playlists Hub":
    - /url: /playlists
  - button "Collapse Details"
  - img "Edited Playlist 1781348408512"
  - heading "Edited Playlist 1781348408512" [level=1]
  - text: private • 1 Assets • ⭐️ 3
  - paragraph: Description updated by Playwright test
  - heading "Intelligence Tags" [level=4]
  - button "+"
  - text: P Playwright Test Curator Playlist Curator
  - button "Play All"
  - button "✏️ Edit"
  - button "🗑️ Delete"
  - heading "Curated Playlist Sequence" [level=2]
  - combobox "Sort Sequence":
    - option "Date Updated" [selected]
    - option "Date Added"
    - option "Custom Order"
  - 'button "Sort: Descending (Newest First)"'
  - button "List View"
  - button "2"
  - button "3"
  - button "4"
  - button "5"
  - text: "#1"
  - heading "How Claude Code’s lead designer builds with AI" [level=3]
  - paragraph: Discover more about How Claude Code’s lead designer builds with AI with this in-depth resource.
  - text: gemini free video
  - button "Set as Playlist Cover"
  - button "Remove from Playlist"
  - status
- contentinfo:
  - img
  - text: Stillwater
  - paragraph: The definitive architectural hub for high-end prompt engineering & AI system design. Curating elite blueprints for the next era of intelligence.
  - heading "Architecture" [level=4]
  - link "All Resources":
    - /url: /resources
  - link "Categories":
    - /url: /categories
  - link "Sources Registry":
    - /url: /creators
  - link "Gemini Nodes":
    - /url: /resources?platform=gemini
  - heading "Ecosystem" [level=4]
  - link "Master Pricing":
    - /url: /pricing
  - link "Stillwater Studio":
    - /url: http://localhost:3001/generate
  - link "Stillwater Registry":
    - /url: http://localhost:5173
  - link "Control Center":
    - /url: /dashboard
  - heading "Support" [level=4]
  - link "API Framework":
    - /url: /api-docs
  - text: Ecosystem Active
  - paragraph: © 2026 Stillwater Resources. Engineered in the AI Era.
  - text: Next.js 14+ Firebase Admin
- button "Open Tanstack query devtools":
  - img
- alert
- button "/agentation v2.2.1 Output Detail Standard React Components Marker Colour Purple Blue Cyan Green Yellow Orange Red Clear on copy/send Block page interactions Manage MCP & Webhooks Manage MCP & Webhooks MCP Connection MCP connection allows agents to receive and act on annotations. Learn more Webhooks Auto-Send The webhook URL will receive live annotation changes and annotation data.":
  - img
  - button:
    - img
  - button [disabled]:
    - img
  - button [disabled]:
    - img
  - button [disabled]:
    - img
  - button [disabled]:
    - img
  - button:
    - img
  - button:
    - img
  - text: /agentation v2.2.1
  - button "Switch to light mode":
    - img
  - text: Output Detail
  - img
  - button "Standard"
  - text: React Components
  - img
  - checkbox [checked]
  - text: Marker Colour
  - button "Purple"
  - button "Blue"
  - button "Cyan"
  - button "Green"
  - button "Yellow"
  - button "Orange"
  - button "Red"
  - checkbox "Clear on copy/send"
  - text: Clear on copy/send
  - img
  - checkbox "Block page interactions" [checked]
  - img
  - text: Block page interactions
  - button "Manage MCP & Webhooks":
    - text: Manage MCP & Webhooks
    - img
  - button "Manage MCP & Webhooks":
    - img
    - text: Manage MCP & Webhooks
  - text: MCP Connection
  - img
  - paragraph:
    - text: MCP connection allows agents to receive and act on annotations.
    - link "Learn more":
      - /url: https://agentation.dev/mcp
  - text: Webhooks
  - img
  - text: Auto-Send
  - checkbox [checked] [disabled]
  - paragraph: The webhook URL will receive live annotation changes and annotation data.
  - textbox "Webhook URL"
```

# Test source

```ts
  26  |   await createModal.waitFor({ state: 'visible', timeout: 10000 });
  27  |   
  28  |   // Fill in playlist creation modal
  29  |   await createModal.locator('input[placeholder="e.g. Next.js Masterclass"]').fill(`Playwright Playlist ${timestamp}`);
  30  |   await createModal.locator('textarea[placeholder="Enter a brief summary..."]').fill('Verified by Playwright E2E tests');
  31  |   
  32  |   // Click Public visibility toggle (scoped inside the modal)
  33  |   await createModal.locator('button:has-text("Public")').click();
  34  |   
  35  |   // Click the Create submit button (scoped inside modal, text is just "Create" or "Creating...")
  36  |   await createModal.locator('button[type="submit"]').click();
  37  | 
  38  |   // Verify the playlist card is visible on the playlists page
  39  |   await expect(page.locator(`text=Playwright Playlist ${timestamp}`)).toBeVisible({ timeout: 15000 });
  40  | 
  41  |   // 3. Navigate to Resources to add a resource to this playlist
  42  |   await page.goto('http://localhost:3002/resources');
  43  |   
  44  |   // Wait for resource cards to load
  45  |   await page.waitForSelector('[id^="resource-card-"]', { timeout: 10000 });
  46  |   
  47  |   // Get the first resource card
  48  |   const resourceCard = page.locator('[id^="resource-card-"]').first();
  49  |   const resourceTitle = await resourceCard.locator('h3').first().textContent();
  50  |   console.log('Adding resource to playlist:', resourceTitle);
  51  | 
  52  |   // Click the save-to-playlist button (the list icon button)
  53  |   await resourceCard.hover();
  54  |   
  55  |   // Find button with title "Add to Playlist"
  56  |   const addBtn = resourceCard.locator('button[title="Add to Playlist"]');
  57  |   await addBtn.click();
  58  | 
  59  |   // Wait for AddToPlaylistModal to open
  60  |   await page.waitForSelector('span:has-text("Save to Playlist")', { timeout: 10000 });
  61  | 
  62  |   // Check the checkbox corresponding to our new playlist
  63  |   await page.click(`label:has-text("Playwright Playlist ${timestamp}")`);
  64  | 
  65  |   // Close modal by clicking the X close button in the modal header
  66  |   await page.locator('span:has-text("Save to Playlist") + button').click();
  67  |   
  68  |   // 4. Navigate back to the Playlist Details page
  69  |   await page.goto('http://localhost:3002/playlists');
  70  |   await page.click(`text=Playwright Playlist ${timestamp}`);
  71  | 
  72  |   // Wait for details page to load
  73  |   await expect(page).toHaveURL(/.*playlists\/.+/, { timeout: 10000 });
  74  | 
  75  |   // Verify details sidebar is expanded by default on load
  76  |   const collapseBtn = page.locator('button[title="Collapse Details"]');
  77  |   await expect(collapseBtn).toBeVisible({ timeout: 10000 });
  78  | 
  79  |   await expect(page.getByRole('heading', { name: `Playwright Playlist ${timestamp}` })).toBeVisible({ timeout: 10000 });
  80  |   
  81  |   // Verify the resource is in the list
  82  |   await expect(page.locator(`text=${resourceTitle}`).first()).toBeVisible();
  83  | 
  84  |   // 5. Test direct cover configuration from curated sequence card
  85  |   // Toggle layout to List View to show cover management actions
  86  |   const listViewBtn = page.locator('button[title="List View"]');
  87  |   await expect(listViewBtn).toBeVisible();
  88  |   await listViewBtn.click();
  89  | 
  90  |   const setCoverBtn = page.locator('button[title="Set as Playlist Cover"]');
  91  |   await expect(setCoverBtn).toBeVisible();
  92  |   
  93  |   // Click the Set as Playlist Cover button
  94  |   await setCoverBtn.click();
  95  |   
  96  |   // Verify that the button changes status and is highlighted as Active Playlist Cover
  97  |   await expect(page.locator('button[title="Active Playlist Cover"]')).toBeVisible({ timeout: 5000 });
  98  | 
  99  |   // 6. Test inline metadata settings editing
  100 |   await page.click('button:has-text("✏️ Edit")');
  101 |   await page.waitForSelector('span:has-text("Edit Playlist Settings")', { timeout: 5000 });
  102 | 
  103 |   // Edit fields (scoped inside the edit modal)
  104 |   const editModal = page.locator('[class*="backdrop-blur"]:has(span:has-text("Edit Playlist Settings"))');
  105 |   await editModal.locator('input[required]').fill(`Edited Playlist ${timestamp}`);
  106 |   await editModal.locator('textarea').fill('Description updated by Playwright test');
  107 | 
  108 |   // Change visibility to Private (scoped inside modal)
  109 |   await editModal.locator('button:has-text("Private")').click();
  110 | 
  111 |   // Choose Custom cover settings (scoped inside modal)
  112 |   await editModal.locator('label:has-text("Cover Thumbnail Source") + select').selectOption('custom');
  113 |   await editModal.locator('input[type="url"]').fill('https://images.unsplash.com/photo-1506744038136-46273834b3fb');
  114 | 
  115 |   // Save changes
  116 |   await editModal.locator('button:has-text("Save Settings")').click();
  117 | 
  118 |   // Verify modal is closed and metadata is updated
  119 |   await expect(page.locator('span:has-text("Edit Playlist Settings")')).not.toBeVisible();
  120 |   await expect(page.getByRole('heading', { name: `Edited Playlist ${timestamp}` })).toBeVisible({ timeout: 10000 });
  121 |   await expect(page.locator('text=Description updated by Playwright test')).toBeVisible();
  122 |   await expect(page.locator('text=private')).toBeVisible();
  123 | 
  124 |   // 7. Test view mode selectors — scope to the specific toolbar div
  125 |   const viewToolbar = page.locator('div.rounded-2xl:has(button:has-text("List")):has(button:has-text("2 Cols"))');
> 126 |   await expect(viewToolbar).toBeVisible();
      |                             ^ Error: expect(locator).toBeVisible() failed
  127 | 
  128 |   // Check initial state (List button is active with bg-primary)
  129 |   await expect(viewToolbar.locator('button:has-text("List")')).toHaveClass(/bg-primary/);
  130 | 
  131 |   // Switch to 2 Cols
  132 |   await viewToolbar.locator('button:has-text("2 Cols")').click();
  133 |   await expect(viewToolbar.locator('button:has-text("2 Cols")')).toHaveClass(/bg-primary/);
  134 |   await expect(page.locator('.grid-cols-1.sm\\:grid-cols-2')).toBeVisible();
  135 | 
  136 |   // Switch to 3 Cols
  137 |   await viewToolbar.locator('button:has-text("3 Cols")').click();
  138 |   await expect(viewToolbar.locator('button:has-text("3 Cols")')).toHaveClass(/bg-primary/);
  139 |   await expect(page.locator('.grid-cols-1.sm\\:grid-cols-2.md\\:grid-cols-3')).toBeVisible();
  140 | 
  141 |   // Switch to 4 Cols
  142 |   await viewToolbar.locator('button:has-text("4 Cols")').click();
  143 |   await expect(viewToolbar.locator('button:has-text("4 Cols")')).toHaveClass(/bg-primary/);
  144 |   await expect(page.locator('.grid-cols-1.sm\\:grid-cols-2.md\\:grid-cols-3.lg\\:grid-cols-4')).toBeVisible();
  145 | 
  146 |   // Switch to 5 Cols
  147 |   await viewToolbar.locator('button:has-text("5 Cols")').click();
  148 |   await expect(viewToolbar.locator('button:has-text("5 Cols")')).toHaveClass(/bg-primary/);
  149 |   await expect(page.locator('.grid-cols-1.sm\\:grid-cols-2.md\\:grid-cols-3.lg\\:grid-cols-4.xl\\:grid-cols-5')).toBeVisible();
  150 | 
  151 |   // Switch back to List
  152 |   await viewToolbar.locator('button:has-text("List")').click();
  153 |   await expect(viewToolbar.locator('button:has-text("List")')).toHaveClass(/bg-primary/);
  154 | 
  155 |   // 8. Verify drag-and-drop elements & arrow options are visible for curator
  156 |   await expect(page.locator('div[title="Drag to reorder"]')).toBeVisible();
  157 |   await expect(page.locator('button[title="Promote (Move Up)"]')).toBeVisible();
  158 |   await expect(page.locator('button[title="Demote (Move Down)"]')).toBeVisible();
  159 | 
  160 |   // 9. Verify deletion functionality
  161 |   await expect(page.locator('button[title="Remove from Playlist"]')).toBeVisible();
  162 |   
  163 |   // Click the delete button
  164 |   await page.click('button[title="Remove from Playlist"]');
  165 |   
  166 |   // Verify that the confirmation modal is open
  167 |   await expect(page.locator('span:has-text("Remove from Playlist")')).toBeVisible();
  168 |   await expect(page.locator(`text=Are you sure you want to remove`)).toBeVisible();
  169 |   
  170 |   // Click Cancel
  171 |   await page.click('button:has-text("Cancel")');
  172 |   
  173 |   // Modal should close and item should still be visible
  174 |   await expect(page.locator('span:has-text("Remove from Playlist")')).not.toBeVisible();
  175 |   await expect(page.locator(`text=${resourceTitle}`).first()).toBeVisible();
  176 |   
  177 |   // Click delete again
  178 |   await page.click('button[title="Remove from Playlist"]');
  179 |   
  180 |   // Click Remove
  181 |   await page.click('button:has-text("Remove")');
  182 |   
  183 |   // Modal should close and item should disappear from the list
  184 |   await expect(page.locator('span:has-text("Remove from Playlist")')).not.toBeVisible();
  185 |   await expect(page.locator(`text=${resourceTitle}`).first()).not.toBeVisible();
  186 | 
  187 |   // 10. Clean up: Delete the created playlist itself to prevent database pollution
  188 |   const deletePlaylistBtn = page.locator('button:has-text("🗑️ Delete")');
  189 |   await expect(deletePlaylistBtn).toBeVisible();
  190 |   await deletePlaylistBtn.click();
  191 | 
  192 |   // Wait for confirmation modal
  193 |   const deleteModal = page.locator('[class*="backdrop-blur"]:has(span:has-text("Delete Playlist"))');
  194 |   await deleteModal.waitFor({ state: 'visible', timeout: 5000 });
  195 | 
  196 |   // Click the confirm Delete button inside modal
  197 |   const confirmDeleteBtn = deleteModal.locator('button:has-text("Delete")');
  198 |   await confirmDeleteBtn.click();
  199 | 
  200 |   // Verify redirect back to /playlists catalog page
  201 |   await expect(page).toHaveURL(/.*playlists$/, { timeout: 10000 });
  202 | 
  203 |   console.log('Test completed successfully!');
  204 | });
  205 | 
  206 | test.afterEach(async ({ page }) => {
  207 |   try {
  208 |     console.log('[Cleanup] Starting cleanup...');
  209 |     // Navigate to the playlists list page
  210 |     await page.goto('http://localhost:3002/playlists');
  211 |     await page.waitForTimeout(1500); // Wait briefly for cards to load
  212 | 
  213 |     // Force List View to have a reliable checkbox selector
  214 |     const listViewBtn = page.locator('button[title="List View"]');
  215 |     if (await listViewBtn.isVisible()) {
  216 |       console.log('[Cleanup] Switching to List View');
  217 |       await listViewBtn.click();
  218 |       await page.waitForTimeout(500);
  219 |     }
  220 | 
  221 |     // Find any playlists whose title contains "Playwright Playlist"
  222 |     const cards = page.locator('div.group:has(h3:has-text("Playwright Playlist"))');
  223 |     const count = await cards.count();
  224 |     console.log(`[Cleanup] Found ${count} stray Playwright test playlist(s)`);
  225 |     
  226 |     if (count > 0) {
```