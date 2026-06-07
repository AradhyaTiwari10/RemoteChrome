const { chromium } = require("playwright-core");
const http = require("http");
const fs = require("fs");

const TARGET_URL = process.env.TARGET_URL;
const SESSION_ID = process.env.SESSION_ID;
const BACKEND_URL = process.env.BACKEND_URL || "http://backend:5001";
const FRAME_RATE_MS = parseInt(process.env.FRAME_RATE_MS || "100", 10);
const JPEG_QUALITY = parseInt(process.env.JPEG_QUALITY || "60", 10);

if (!SESSION_ID) {
  console.error(JSON.stringify({ level: "error", message: "SESSION_ID environment variable is required" }));
  process.exit(1);
}

if (!TARGET_URL) {
  console.error(JSON.stringify({ level: "error", message: "TARGET_URL environment variable is required" }));
  process.exit(1);
}

// ─── Diagnostic counters ────────────────────────────────────────────────────
let framesCaptured = 0;
let framesUploaded = 0;
let framesFailedCapture = 0;
let framesFailedUpload = 0;
let lastFrameTime = Date.now();

// Heartbeat: log frame stats every 30 seconds
setInterval(() => {
  const staleSec = ((Date.now() - lastFrameTime) / 1000).toFixed(1);
  console.log(JSON.stringify({
    level: "info",
    message: "[Browser][Heartbeat] Frame pipeline stats",
    framesCaptured,
    framesUploaded,
    framesFailedCapture,
    framesFailedUpload,
    secondsSinceLastFrame: staleSec
  }));
}, 30000);

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
      "--disable-dev-shm-usage",
      // Help evade basic bot-detection fingerprinting
      "--disable-blink-features=AutomationControlled"
    ]
  });

  // ─── Browser-level event listeners ────────────────────────────────────────
  browser.on("disconnected", () => {
    console.error(JSON.stringify({
      level: "error",
      message: "[Browser][EVENT] Chromium browser process disconnected (crash or OOM)"
    }));
    keepAlive = false;
    process.exit(1);
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    // Spoof a real browser user-agent to reduce bot-detection hits
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  });

  const page = await context.newPage();

  // ─── Page-level diagnostic event listeners ────────────────────────────────
  page.on("crash", () => {
    console.error(JSON.stringify({
      level: "error",
      message: "[Browser][EVENT] page.crash fired — renderer process crashed"
    }));
    // The page is now unusable. Signal stream stall to backend.
    keepAlive = false;
    process.exit(1);
  });

  page.on("close", () => {
    console.warn(JSON.stringify({
      level: "warn",
      message: "[Browser][EVENT] page.close fired — page was closed unexpectedly"
    }));
  });

  page.on("pageerror", (err) => {
    console.warn(JSON.stringify({
      level: "warn",
      message: "[Browser][EVENT] page.pageerror — uncaught JS error on page",
      error: err.message
    }));
  });

  page.on("requestfailed", (request) => {
    // Only log non-trivial failures (skip image/font/analytics noise)
    const url = request.url();
    const failure = request.failure()?.errorText || "unknown";
    if (!url.includes("google-analytics") && !url.includes("doubleclick")) {
      console.warn(JSON.stringify({
        level: "warn",
        message: "[Browser][EVENT] page.requestfailed",
        url: url.substring(0, 120),
        failure
      }));
    }
  });

  page.on("response", (response) => {
    const status = response.status();
    // Log 4xx/5xx responses (indicates CAPTCHA redirects, 429 rate limits etc.)
    if (status >= 400) {
      console.warn(JSON.stringify({
        level: "warn",
        message: "[Browser][EVENT] page.response HTTP error",
        url: response.url().substring(0, 120),
        status
      }));
    }
  });

  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      console.log(JSON.stringify({
        level: "info",
        message: "[Browser][EVENT] Main frame navigated",
        url: frame.url().substring(0, 120)
      }));
    }
  });

  console.log(JSON.stringify({ level: "info", message: "[Browser] Navigating to URL" }));
  try {
    await page.goto(TARGET_URL, { waitUntil: "load", timeout: 30000 });
  } catch (navErr) {
    console.error(JSON.stringify({
      level: "error",
      message: "[Browser] Initial navigation failed",
      error: navErr.message
    }));
    // Don't exit — still try to stream whatever is on the page
  }

  console.log(JSON.stringify({
    level: "info",
    message: `[Browser] Navigation complete, session ${SESSION_ID} is active and remaining alive`,
    currentUrl: page.url()
  }));

  let keepAlive = true;
  const tempScreenshotPath = `/screenshots/${SESSION_ID}.jpg`;

  // ─── HTTP Control Server ─────────────────────────────────────────────────
  const controlServer = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/control") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        let action;
        try {
          action = JSON.parse(body);
          if (!action.type) throw new Error("Missing action type");

          console.log(JSON.stringify({
            level: "info",
            message: `[Browser] Control action received: ${action.type}`,
            payload: action
          }));

          switch (action.type) {
            case "mouse:move":
              if (typeof action.x !== "number" || typeof action.y !== "number") throw new Error("Invalid mouse coordinates");
              await page.mouse.move(action.x, action.y);
              break;
            case "mouse:click":
              if (typeof action.x !== "number" || typeof action.y !== "number") throw new Error("Invalid mouse coordinates");
              await page.mouse.click(action.x, action.y);
              break;
            case "keyboard:type":
              if (typeof action.text !== "string") throw new Error("Invalid keyboard input");
              const specialKeys = ["Enter", "Backspace", "Tab", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
              const modifierKeys = ["Shift", "Control", "Alt", "Meta", "CapsLock", "F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12"];
              if (specialKeys.includes(action.text)) {
                await page.keyboard.press(action.text);
              } else if (modifierKeys.includes(action.text)) {
                console.log(JSON.stringify({ level: "info", message: `[Browser] Ignored modifier key: ${action.text}` }));
              } else if (action.text.length === 1) {
                await page.keyboard.type(action.text);
              } else {
                console.log(JSON.stringify({ level: "info", message: `[Browser] Ignored non-printable key: ${action.text}` }));
              }
              break;
            case "mouse:wheel":
              if (typeof action.deltaX !== "number" || typeof action.deltaY !== "number") throw new Error("Invalid scroll deltas");
              await page.mouse.wheel(action.deltaX, action.deltaY);
              break;
            default:
              throw new Error(`Unsupported action type: ${action.type}`);
          }

          console.log(JSON.stringify({ level: "info", message: `[Browser] Action executed: ${action.type}` }));
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          console.error(JSON.stringify({
            level: "error",
            message: `[Browser] Action failed${action ? ` (${action.type})` : ""}`,
            error: err.message
          }));
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
    } else if (req.method === "GET" && req.url === "/health") {
      // Simple health endpoint for diagnostics
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        keepAlive,
        framesCaptured,
        framesUploaded,
        framesFailedCapture,
        framesFailedUpload,
        currentUrl: page.url()
      }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  controlServer.listen(3001, "0.0.0.0", () => {
    console.log(JSON.stringify({ level: "info", message: "[Browser] Control server listening on port 3001" }));
  });

  // ─── Graceful shutdown ────────────────────────────────────────────────────
  const shutdown = async () => {
    if (!keepAlive) return;
    keepAlive = false;
    console.log(JSON.stringify({ level: "info", message: "[Browser] Shutdown signal received" }));
    try { controlServer.close(); } catch (_) {}
    await browser.close();
    try {
      if (fs.existsSync(tempScreenshotPath)) fs.unlinkSync(tempScreenshotPath);
    } catch (_) {}
    console.log(JSON.stringify({ level: "info", message: "[Browser] Shutdown complete" }));
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // ─── Frame capture & upload loop ─────────────────────────────────────────
  let isCapturing = false;

  const captureAndPostFrame = async () => {
    if (!keepAlive || isCapturing) return;
    isCapturing = true;

    try {
      // Step 1: Capture screenshot
      await page.screenshot({
        path: tempScreenshotPath,
        type: "jpeg",
        quality: JPEG_QUALITY
      });
      framesCaptured++;
      lastFrameTime = Date.now();

      // Step 2: Read to buffer
      const buffer = fs.readFileSync(tempScreenshotPath);
      const base64Image = buffer.toString("base64");

      // Step 3: POST to backend
      const payload = JSON.stringify({
        sessionId: SESSION_ID,
        timestamp: Date.now(),
        image: base64Image
      });

      const urlObj = new URL(`${BACKEND_URL}/api/browser/${SESSION_ID}/frame`);
      const req = http.request(
        {
          hostname: urlObj.hostname,
          port: urlObj.port || 80,
          path: urlObj.pathname,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload)
          },
          timeout: 3000
        },
        (res) => {
          if (res.statusCode !== 200) {
            framesFailedUpload++;
            console.warn(JSON.stringify({
              level: "warn",
              message: "[Browser] Frame upload got non-200 response",
              statusCode: res.statusCode,
              framesFailedUpload
            }));
          } else {
            framesUploaded++;
          }
          res.resume();
        }
      );

      req.on("error", (err) => {
        framesFailedUpload++;
        // Log only every 10th failure to avoid log spam
        if (framesFailedUpload % 10 === 1) {
          console.warn(JSON.stringify({
            level: "warn",
            message: "[Browser] Frame upload connection error",
            error: err.message,
            framesFailedUpload
          }));
        }
      });

      req.on("timeout", () => {
        framesFailedUpload++;
        req.destroy();
        if (framesFailedUpload % 10 === 1) {
          console.warn(JSON.stringify({
            level: "warn",
            message: "[Browser] Frame upload timed out",
            framesFailedUpload
          }));
        }
      });

      req.write(payload);
      req.end();
    } catch (err) {
      framesFailedCapture++;
      // Log only every 5th capture failure to avoid log spam
      if (framesFailedCapture % 5 === 1) {
        console.error(JSON.stringify({
          level: "error",
          message: "[Browser] Screenshot capture failed",
          error: err.message,
          framesFailedCapture
        }));
      }
    } finally {
      isCapturing = false;
    }
  };

  // Run the frame loop
  while (keepAlive) {
    await captureAndPostFrame();
    await new Promise((resolve) => setTimeout(resolve, FRAME_RATE_MS));
  }
})().catch((err) => {
  console.error(JSON.stringify({
    level: "error",
    message: "[Browser] Fatal top-level error",
    error: err.message || String(err)
  }));
  process.exit(1);
});
