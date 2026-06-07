const { chromium } = require("playwright-core");

(async () => {
  console.log("[Browser] Launching Chromium");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium-browser",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  console.log("[Browser] Navigating to URL");
  await page.goto("https://www.google.com", { waitUntil: "load" });

  console.log("[Browser] Capturing Screenshot");
  await page.screenshot({ path: "/screenshots/google-homepage.png" });

  console.log("[Browser] Completed");
  await browser.close();
  process.exit(0);
})().catch((err) => {
  console.error("[Browser] Failed with error:", err);
  process.exit(1);
});
