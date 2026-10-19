import { test, expect } from "@playwright/test";

test.describe("Cold Chain & Refrigeration Temperature Dropdown", () => {
  test("Verify temperature range dropdown selector on Cold Chain checklist", async ({ page }) => {
    // 1. Sign in
    await page.goto("http://localhost:3000/login");
    await page.fill('input[type="email"]', "admin@reporting.app");
    await page.fill('input[type="password"]', "Admin@123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**");

    // 2. Click Cold Chain & Refrigeration checklist link in sidebar
    const tempLink = page.locator('a:has-text("Cold Chain & Refrigeration")').first();
    if (await tempLink.isVisible()) {
      await tempLink.click();
    } else {
      // Fallback direct navigation
      await page.goto("http://localhost:3000/dashboard");
      await page.waitForTimeout(500);
      await page.locator('a:has-text("Cold Chain")').first().click();
    }

    await page.waitForSelector(".notion-temp-select");

    // 3. Verify dropdown exists and contains options
    const firstSelect = page.locator(".notion-temp-select").first();
    await expect(firstSelect).toBeVisible();

    // Verify dropdown has optgroups and safe range options
    const optionsCount = await firstSelect.locator("option").count();
    expect(optionsCount).toBeGreaterThan(3);

    // Get list of option texts to verify
    const optionTexts = await firstSelect.locator("option").allInnerTexts();
    console.log("Found temperature options:", optionTexts.slice(0, 10));

    // 4. Select a specific temperature
    await firstSelect.selectOption({ index: 2 }); // pick safe option
    await page.waitForTimeout(300);

    // 5. Capture screenshot of the temperature form with dropdown
    await page.screenshot({ path: "playwright-screenshots/cold-chain-temp-dropdown.png" });

    // 6. Test out-of-range option
    const breachOpt = optionTexts.find((t) => t.includes("Critical") || t.includes("⚠️"));
    if (breachOpt) {
      await firstSelect.selectOption({ label: breachOpt });
      await page.waitForTimeout(300);
      await page.screenshot({ path: "playwright-screenshots/cold-chain-temp-breach.png" });
    }
  });
});
