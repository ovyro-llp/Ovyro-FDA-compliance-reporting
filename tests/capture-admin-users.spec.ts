import { test } from '@playwright/test';
import * as path from 'path';

test('Capture users & roles screen', async ({ page }) => {
  const screenshotDir = path.join(process.cwd(), 'playwright-screenshots');

  // Mobile Viewport
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/login');
  await page.fill('input[type="email"]', 'admin@reporting.app');
  await page.fill('input[type="password"]', 'Admin@123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  // Go to /admin/users
  await page.goto('/admin/users');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(screenshotDir, '11-mobile-admin-users.png'), fullPage: true });

  // Open Add Role or Add User modal if button exists
  const addRoleBtn = page.locator('button:has-text("Create Dynamic Role"), button:has-text("New Role")').first();
  if (await addRoleBtn.isVisible()) {
    await addRoleBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotDir, '12-mobile-role-modal.png') });
  }

  // Desktop Viewport
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/admin/users');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(screenshotDir, '13-desktop-admin-users.png'), fullPage: true });
});
