import { test, expect } from '@playwright/test';

test('check resources page header elements', async ({ page }) => {
  await page.goto('http://localhost:3002/resources');
  
  const h1 = page.getByRole('heading', { name: 'Resource Library' });
  await expect(h1).toBeVisible();
  
  const links = page.locator('a[href="/resources/new"]');
  const count = await links.count();
  console.log(`=== PLAYWRIGHT TEST: Found ${count} links to /resources/new ===`);
  
  for (let i = 0; i < count; i++) {
    const link = links.nth(i);
    const isVisible = await link.isVisible();
    const html = await link.evaluate(el => el.outerHTML);
    console.log(`Link ${i}: visible=${isVisible}, html=${html}`);
  }
});
