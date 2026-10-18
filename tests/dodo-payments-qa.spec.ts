import { test, expect } from "@playwright/test";

test.describe("Dodo Payments Subscriptions & Sync Integration", () => {
  test("Platform Owner SaaS Operations & Dodo Checkout Generation", async ({ page }) => {
    // 1. Login as Platform Admin
    await page.goto("http://localhost:3000/login");
    await page.fill('input[type="email"]', "admin@reporting.app");
    await page.fill('input[type="password"]', "Admin@123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**");

    // 2. Navigate to SaaS Commercial Center (/admin/platform)
    await page.goto("http://localhost:3000/admin/platform");
    await page.waitForSelector(".platform-control-center");

    // Check Dodo Payments Live indicator
    await expect(page.locator("text=Dodo Payments Live")).toBeVisible();
    await expect(page.locator("text=OVYRO FDA & Food Compliance Reporting")).toBeVisible();
    await expect(page.locator("text=pdt_0Npwj88UTNHuZ8GdvRcnV")).toBeVisible();
    await expect(page.locator("text=pdt_0NpwjFgGyqgduafnph03e")).toBeVisible();

    // Capture desktop view of SaaS platform with Dodo Payments
    await page.screenshot({ path: "playwright-screenshots/20-dodo-saas-platform-desktop.png", fullPage: true });

    // 3. Test Generate Dodo Checkout Link
    const getLinkBtn = page.locator('button:has-text("Get Dodo Link"), button:has-text("Renew / Change")').first();
    await expect(getLinkBtn).toBeVisible();
    await getLinkBtn.click();

    // Modal should appear with Dodo checkout session URL
    await page.waitForSelector(".modal-backdrop");
    await expect(page.locator("text=Dodo Payments Checkout Session")).toBeVisible();
    await expect(page.locator("text=checkout.dodopayments.com")).toBeVisible();

    // Capture checkout modal screenshot
    await page.screenshot({ path: "playwright-screenshots/21-dodo-checkout-modal-desktop.png" });

    // Close modal
    await page.click(".modal-close-btn");

    // 4. Test "Sync Dodo Payments" button
    const syncBtn = page.locator('button:has-text("Sync Dodo Payments")');
    await expect(syncBtn).toBeVisible();
    await syncBtn.click();
    await page.waitForTimeout(1500);

    // 5. Navigate to Tenant Billing Page (/admin/billing)
    await page.goto("http://localhost:3000/admin/billing");
    await page.waitForSelector(".admin-page-container");

    await expect(page.locator("text=SaaS Compliance Plan & Billing")).toBeVisible();
    await expect(page.locator("text=OVYRO FDA Reporting").first()).toBeVisible();
    await expect(page.locator("text=OVYRO FDA Reporting Extended").first()).toBeVisible();
    await expect(page.locator("text=₹500").first()).toBeVisible();
    await expect(page.locator("text=₹5,000").first()).toBeVisible();

    // Capture tenant billing page screenshot
    await page.screenshot({ path: "playwright-screenshots/22-tenant-billing-page-desktop.png", fullPage: true });
  });

  test("Mobile-first Viewport of Dodo SaaS Platform and Billing", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // 1. Login
    await page.goto("http://localhost:3000/login");
    await page.fill('input[type="email"]', "admin@reporting.app");
    await page.fill('input[type="password"]', "Admin@123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**");

    // 2. Mobile SaaS Platform
    await page.goto("http://localhost:3000/admin/platform");
    await page.waitForSelector(".platform-control-center");
    await page.screenshot({ path: "playwright-screenshots/23-dodo-platform-mobile.png", fullPage: true });

    // 3. Mobile Tenant Billing
    await page.goto("http://localhost:3000/admin/billing");
    await page.waitForSelector(".admin-page-container");
    await page.screenshot({ path: "playwright-screenshots/24-dodo-billing-mobile.png", fullPage: true });
  });
});
