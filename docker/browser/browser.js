const { chromium } = require("playwright-core");
const http = require("http");
const fs = require("fs");
const path = require("path");

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
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  console.log(JSON.stringify({ level: "info", message: "[Browser] Navigating to URL" }));
  await page.goto(TARGET_URL, { waitUntil: "load" });

  console.log(JSON.stringify({
    level: "info",
    message: `[Browser] Navigation complete, session ${SESSION_ID} is active and remaining alive`
  }));

  let keepAlive = true;
  const tempScreenshotPath = `/screenshots/${SESSION_ID}.jpg`;

  // Start HTTP control server on port 3001 inside the container
  const controlServer = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/control") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", async () => {
        let action;
        try {
          action = JSON.parse(body);
          if (!action.type) {
            throw new Error("Missing action type");
          }

          console.log(JSON.stringify({
            level: "info",
            message: `[Browser] Received control endpoint request: ${action.type}`,
            payload: action
          }));

          console.log(JSON.stringify({
            level: "info",
            message: `[Browser] Injecting Playwright action: ${action.type}`,
            actionType: action.type
          }));

          switch (action.type) {
            case "mouse:move":
              if (typeof action.x !== "number" || typeof action.y !== "number") {
                throw new Error("Invalid mouse coordinates");
              }
              await page.mouse.move(action.x, action.y);
              break;
            case "mouse:click":
              if (typeof action.x !== "number" || typeof action.y !== "number") {
                throw new Error("Invalid mouse coordinates");
              }
              await page.mouse.click(action.x, action.y);
              break;
            case "keyboard:type":
              if (typeof action.text !== "string") {
                throw new Error("Invalid keyboard input");
              }
              const specialKeys = ["Enter", "Backspace", "Tab", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
              const modifierKeys = ["Shift", "Control", "Alt", "Meta", "CapsLock"];
              
              if (specialKeys.includes(action.text)) {
                await page.keyboard.press(action.text);
              } else if (modifierKeys.includes(action.text)) {
                console.log(JSON.stringify({
                  level: "info",
                  message: `[Browser] Ignored modifier key: ${action.text}`
                }));
              } else if (action.text.length === 1) {
                await page.keyboard.type(action.text);
              } else {
                console.log(JSON.stringify({
                  level: "info",
                  message: `[Browser] Ignored non-printable/complex key: ${action.text}`
                }));
              }
              break;
            case "mouse:wheel":
              if (typeof action.deltaX !== "number" || typeof action.deltaY !== "number") {
                throw new Error("Invalid scroll deltas");
              }
              await page.mouse.wheel(action.deltaX, action.deltaY);
              break;
            default:
              throw new Error(`Unsupported action type: ${action.type}`);
          }

          console.log(JSON.stringify({
            level: "info",
            message: `[Browser] Playwright action executed successfully: ${action.type}`
          }));

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          console.error(JSON.stringify({
            level: "error",
            message: `[Browser] Action execution failed${action ? ` for ${action.type}` : ""}`,
            error: err.message
          }));
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  controlServer.listen(3001, "0.0.0.0", () => {
    console.log(JSON.stringify({
      level: "info",
      message: `[Browser] Control server listening on port 3001`
    }));
  });

  const shutdown = async () => {
    if (!keepAlive) return;
    keepAlive = false;
    console.log(JSON.stringify({ level: "info", message: "[Browser] Shutdown signal received, closing browser" }));
    
    try {
      controlServer.close();
    } catch (err) {
      // Ignore
    }
    
    await browser.close();
    
    // Clean up temporary files
    try {
      if (fs.existsSync(tempScreenshotPath)) {
        fs.unlinkSync(tempScreenshotPath);
        console.log(JSON.stringify({ level: "info", message: `[Browser] Cleaned up temporary file: ${tempScreenshotPath}` }));
      }
    } catch (err) {
      console.error(JSON.stringify({ level: "warn", message: "Failed to cleanup temporary file", error: err.message }));
    }

    console.log(JSON.stringify({ level: "info", message: "[Browser] Completed" }));
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  let isCapturing = false;

  const captureAndPostFrame = async () => {
    if (!keepAlive || isCapturing) return;
    isCapturing = true;

    try {
      // 1. Capture screenshot to file (JPEG quality adjustable)
      await page.screenshot({
        path: tempScreenshotPath,
        type: "jpeg",
        quality: JPEG_QUALITY
      });

      // 2. Read file to buffer
      const buffer = fs.readFileSync(tempScreenshotPath);
      const base64Image = buffer.toString("base64");

      // 3. POST image data to backend
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
          }
        },
        (res) => {
          res.resume(); // free memory
        }
      );

      req.on("error", (err) => {
        // Ignore connection errors (e.g. backend restarting)
      });

      req.write(payload);
      req.end();
    } catch (err) {
      // Avoid spamming logs if capture fails occasionally
    } finally {
      isCapturing = false;
    }
  };

  // Run the loop at 100ms interval
  while (keepAlive) {
    await captureAndPostFrame();
    await new Promise((resolve) => setTimeout(resolve, FRAME_RATE_MS));
  }
})().catch((err) => {
  console.error(JSON.stringify({
    level: "error",
    message: "[Browser] Failed with error",
    error: err.message || err
  }));
  process.exit(1);
});
