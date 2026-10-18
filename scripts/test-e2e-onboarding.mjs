import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function run() {
  const screenshotDir = path.resolve(process.cwd(), "test-screenshots");
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // Mobile-first (iPhone 14)
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15",
  });
  const page = await context.newPage();

  const timestamp = Date.now().toString().slice(-5);
  const testEmail = `chef_${timestamp}@cloudkitchen.io`;
  const testName = `Chef Gordon ${timestamp}`;
  const testPassword = `Password123!`;

  console.log(`[TEST]: 1. Navigating to /login...`);
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(screenshotDir, "01_login_page.png") });

  console.log(`[TEST]: 2. Switching to Create Account tab...`);
  await page.click("button:has-text('Create Account')");
  await page.fill("#reg-name", testName);
  await page.fill("#reg-email", testEmail);
  await page.fill("#reg-password", testPassword);
  await page.screenshot({ path: path.join(screenshotDir, "02_signup_form_filled.png") });

  console.log(`[TEST]: 3. Submitting registration...`);
  await page.click("button:has-text('Continue to Setup')");

  // Wait for redirect to /onboard
  await page.waitForURL("**/onboard", { timeout: 15000 });
  console.log(`[TEST]: 4. Landed on /onboard! URL: ${page.url()}`);
  await page.screenshot({ path: path.join(screenshotDir, "03_onboard_step1_operation.png") });

  console.log(`[TEST]: 5. Selecting Cloud Kitchen preset...`);
  await page.click("text=Cloud & Dark Kitchen");
  await page.click("button:has-text('Continue →')");

  console.log(`[TEST]: 6. Step 2: Selecting operational modules and facility name...`);
  await page.waitForSelector("text=Operational Equipment & Risk Profile", { timeout: 5000 });
  await page.screenshot({ path: path.join(screenshotDir, "04_onboard_step2_equipment.png") });

  // Facility name & modules are active. Click Generate Templates & Continue
  await page.click("button:has-text('Generate Templates & Continue →')");

  console.log(`[TEST]: 7. Step 3: Verifying tailored template placement and Dodo pricing...`);
  await page.waitForSelector("text=Compliance Templates Placed in Your Account", { timeout: 15000 });
  await page.screenshot({ path: path.join(screenshotDir, "05_onboard_step3_templates_placed.png") });

  console.log(`[TEST]: 8. Clicking 'Inspect My Templates First' to view dashboard...`);
  await page.click("text=Inspect My Templates First");
  await page.waitForURL("**/dashboard", { timeout: 10000 });
  console.log(`[TEST]: 9. Landed on /dashboard! Checking Free Inspection banner...`);
  await page.waitForSelector("text=Free Inspection Mode Active", { timeout: 10000 });
  await page.screenshot({ path: path.join(screenshotDir, "06_dashboard_free_inspection_mode.png") });

  console.log(`[TEST]: 10. Clicking first template sheet to inspect...`);
  const card = page.locator(".checklist-card").first();
  const cardHref = await card.getAttribute("href");
  console.log(`[TEST]: Navigating to template sheet: ${cardHref}`);
  await page.goto(`http://localhost:3000${cardHref}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(screenshotDir, "07_inspecting_template_sheet.png") });

  console.log(`[TEST]: 11. Attempting to submit report to trigger Dodo Paywall...`);
  await page.waitForSelector(".btn-primary-save", { timeout: 15000 });
  await page.click(".btn-primary-save", { force: true });

  console.log(`[TEST]: 12. Waiting for PaywallModal to appear...`);
  await page.waitForSelector("text=Active Subscription Required", { timeout: 10000 });
  await page.waitForSelector("text=Powered by Dodo Payments Verified Gateway", { timeout: 5000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(screenshotDir, "08_paywall_modal_triggered.png") });
  console.log(`[TEST]: SUCCESS! Dodo Paywall modal triggered properly on 402 write attempt!`);

  await browser.close();
  console.log(`[TEST]: Finished all tests successfully! Screenshots saved in test-screenshots/`);
}

run().catch((err) => {
  console.error(`[TEST_ERROR]:`, err);
  process.exit(1);
});
