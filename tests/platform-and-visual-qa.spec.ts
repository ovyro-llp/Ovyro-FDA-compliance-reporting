import { test, expect } from '@playwright/test';
import * as path from 'path';

test('SaaS Platform Control Center & Dynamic Food Presets QA', async ({ page }) => {
  const screenshotDir = path.join(process.cwd(), 'playwright-screenshots');

  // Set iPhone 14/15 mobile viewport
  await page.setViewportSize({ width: 393, height: 852 });

  // 1. Sign In as Platform Owner / Admin
  await page.goto('/login');
  await page.fill('input[type="email"]', 'admin@reporting.app');
  await page.fill('input[type="password"]', 'Admin@123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  // 2. Mobile Platform Control Center (/admin/platform)
  await page.goto('/admin/platform');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(screenshotDir, '14-mobile-saas-platform.png'), fullPage: true });

  // Open "Onboard New Food Business" modal
  await page.click('button:has-text("Onboard New Food Business")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(screenshotDir, '15-mobile-onboard-modal.png') });

  // Fill and onboard a new Cloud Kitchen client
  const uniqueSuffix = Date.now().toString().slice(-4);
  await page.click('button:has-text("Cloud Kitchen")');
  await page.fill('input[placeholder*="Royal Spice"]', `Zenith Kitchen ${uniqueSuffix}`);
  await page.fill('input[placeholder*="owner@"]', `owner${uniqueSuffix}@zenithkitchen.com`);
  await page.fill('input[placeholder*="+91"]', '+919876543210');
  await page.click('button:has-text("Deploy Client Workspace")');
  await page.waitForTimeout(1000);

  // 3. Desktop Platform Control Center
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/admin/platform');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(screenshotDir, '16-desktop-saas-platform.png'), fullPage: true });

  // 4. Verify Dynamic Templates & Presets on Desktop
  await page.goto('/admin/templates');
  await page.waitForTimeout(600);
  await page.click('button:has-text("Create New Report Tab")');
  await page.waitForTimeout(400);

  // Click the new "RAW MATERIAL MANUFACTURING" preset
  const rawMaterialPreset = page.locator('button:has-text("RAW MATERIAL MANUFACTURING")');
  if (await rawMaterialPreset.isVisible()) {
    await rawMaterialPreset.click();
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: path.join(screenshotDir, '17-desktop-raw-material-preset.png') });

  // Click the new "CLOUD KITCHEN DISPATCH" preset
  const cloudKitchenPreset = page.locator('button:has-text("CLOUD KITCHEN DISPATCH")');
  if (await cloudKitchenPreset.isVisible()) {
    await cloudKitchenPreset.click();
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: path.join(screenshotDir, '18-desktop-cloud-kitchen-preset.png') });

  // 5. Verify Team & Dynamic Roles Screen
  await page.goto('/admin/users');
  await page.waitForTimeout(600);
  await page.click('button:has-text("Create Dynamic Role")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(screenshotDir, '19-desktop-dynamic-roles-grouped.png') });
});
