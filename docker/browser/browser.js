const { chromium } = require("playwright-core");

const TARGET_URL = process.env.TARGET_URL;
const SESSION_ID = process.env.SESSION_ID;

if (!SESSION_ID) {
  console.error(JSON.stringify({ level: "error", message: "SESSION_ID environment variable is required" }));
  process.exit(1);
}

if (!TARGET_URL) {
  console.error(JSON.stringify({ level: "error", message: "TARGET_URL environment variable is required" }));
  process.exit(1);
}

(async () => {
  console.log(JSON.stringify({
    level: "info",
    message: `[Browser] Starting session ${SESSION_ID} for URL: ${TARGET_URL}`
  }));

  console.log(JSON.stringify({ level: "info", message: "[Browser] Launching Chromium" }));
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

  console.log(JSON.stringify({ level: "info", message: "[Browser] Navigating to URL" }));
  await page.goto(TARGET_URL, { waitUntil: "load" });

  console.log(JSON.stringify({
    level: "info",
    message: `[Browser] Navigation complete, session ${SESSION_ID} is active and remaining alive`
  }));

  // Keep the process alive and handle shutdown signals gracefully
  let keepAlive = true;

  const shutdown = async () => {
    if (!keepAlive) return;
    keepAlive = false;
    console.log(JSON.stringify({ level: "info", message: "[Browser] Shutdown signal received, closing browser" }));
    await browser.close();
    console.log(JSON.stringify({ level: "info", message: "[Browser] Completed" }));
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Infinite wait loop to prevent exit
  while (keepAlive) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
})().catch((err) => {
  console.error(JSON.stringify({
    level: "error",
    message: "[Browser] Failed with error",
    error: err.message || err
  }));
  process.exit(1);
});
