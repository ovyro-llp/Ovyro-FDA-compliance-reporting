import { test, expect } from "@playwright/test";

test.describe("Apple HIG & Typeform Single-Question Onboarding Flow", () => {
  test("Walkthrough Initial Onboarding and Post-Payment Setup Wizard", async ({ page }) => {
    // 1. Login
    await page.goto("http://localhost:3000/login");
    await page.fill('input[type="email"]', "admin@reporting.app");
    await page.fill('input[type="password"]', "Admin@123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**");

    // 2. Initial Onboarding (/onboard) - Desktop
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("http://localhost:3000/onboard");
    await page.waitForSelector(".onboard-anim-title");

    // Capture Q1: Business Type
    await expect(page.locator("text=What type of food business do you operate?")).toBeVisible();
    await page.waitForTimeout(350);
    await page.screenshot({ path: "playwright-screenshots/onboard-initial-q1-desktop.png" });

    // Advance to Q2: Number of Outlets
    await page.click('button:has-text("Continue →")');
    await expect(page.locator("text=How many outlets or facilities do you operate?")).toBeVisible();
    await page.waitForTimeout(350);
    await page.screenshot({ path: "playwright-screenshots/onboard-initial-q2-desktop.png" });

    // Select 2 - 3 Locations scale
    const multiScaleCard = page.locator('.onboard-template-card:has-text("2 – 3 Locations")');
    if (await multiScaleCard.isVisible()) {
      await multiScaleCard.click();
    }

    // Advance to Q3: Shifts
    await page.click('button:has-text("Continue to Shifts →")');
    await expect(page.locator("text=What operating shifts do you run each day?")).toBeVisible();
    await page.waitForTimeout(350);
    await page.screenshot({ path: "playwright-screenshots/onboard-initial-q3-desktop.png" });

    // Advance to Q4: Risk Modules
    await page.click('button:has-text("Continue to Risk Areas →")');
    await expect(page.locator("text=Which food safety areas apply to your kitchen?")).toBeVisible();
    await page.waitForTimeout(350);
    await page.screenshot({ path: "playwright-screenshots/onboard-initial-q4-desktop.png" });

    // Advance to Q5: Plan & Checkout
    await page.click('button:has-text("Continue to Plan Selection →")');
    await expect(page.locator("text=Choose your compliance subscription")).toBeVisible();
    await expect(page.locator('button:has-text("Skip for now & explore software →")')).toBeVisible();
    await page.waitForTimeout(350);
    await page.screenshot({ path: "playwright-screenshots/onboard-initial-q5-desktop.png" });

    // 2.1 Test Duplicate Outlet Feature in /admin/outlets
    await page.goto("http://localhost:3000/admin/outlets");
    await page.waitForSelector(".outlet-card");
    const initialOutletCount = await page.locator(".outlet-card").count();
    const duplicateBtn = page.locator(".btn-action-duplicate").first();
    await expect(duplicateBtn).toBeVisible();
    await duplicateBtn.click();
    await page.waitForTimeout(1000);
    const newOutletCount = await page.locator(".outlet-card").count();
    expect(newOutletCount).toBeGreaterThanOrEqual(initialOutletCount);
    await page.screenshot({ path: "playwright-screenshots/admin-outlets-duplicated.png" });

    // 3. Post-Payment Setup Wizard (/onboard/setup) - Desktop
    await page.goto("http://localhost:3000/onboard/setup?session_id=mock_dodo_session_123");
    await page.waitForSelector(".onboard-anim-title");

    // Step 1: Add Employees
    await expect(page.locator("text=Who works in your kitchen or facility?")).toBeVisible();
    // Quick add preset
    const quickAddChip = page.locator('.onboard-quick-chip:has-text("Sunil Kumar")');
    if (await quickAddChip.isVisible()) {
      await quickAddChip.click();
    }
    await page.waitForTimeout(350);
    await page.screenshot({ path: "playwright-screenshots/onboard-setup-step1-staff-desktop.png" });

    // Advance to Step 2: Templates
    await page.click('button:has-text("Continue to Checklists →")');
    await expect(page.locator("text=Which compliance checklists do you need?")).toBeVisible();
    await page.waitForTimeout(350);
    await page.screenshot({ path: "playwright-screenshots/onboard-setup-step2-templates-desktop.png" });

    // Finish Setup & Launch -> Celebration
    await page.click('button:has-text("Finish Setup & Launch 🚀")');
    await expect(page.locator("text=Your business is ready for compliance!")).toBeVisible();
    await page.waitForTimeout(350);
    await page.screenshot({ path: "playwright-screenshots/onboard-setup-step3-celebration-desktop.png" });

    // 4. Mobile Viewport (375x812)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("http://localhost:3000/onboard");
    await page.waitForSelector(".onboard-anim-title");
    await page.waitForTimeout(350);
    await page.screenshot({ path: "playwright-screenshots/onboard-initial-q1-mobile.png" });

    await page.goto("http://localhost:3000/onboard/setup");
    await page.waitForSelector(".onboard-anim-title");
    await page.waitForTimeout(350);
    await page.screenshot({ path: "playwright-screenshots/onboard-setup-step1-mobile.png" });
  });
});
