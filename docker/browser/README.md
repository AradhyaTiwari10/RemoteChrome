# BrowserPilot isolated Browser Sandbox Container

This directory is reserved for building and maintaining the Docker image running the isolated Chromium browser.

---

##  Purpose of the Browser Container
To run a clean, stateless instance of Chromium inside a Linux container. This completely isolates the host machine from security vulnerabilities, file system access, or network exposure caused by client web browsing.

---

## ️ Future Runtimes

### 1. Chromium Runtime
* **Display Server (Xvfb):** Since containers run headlessly, we will run X Virtual Framebuffer (Xvfb) inside the container. Chromium will launch target pages against display `:99`.
* **Window Manager (Fluxbox/Openbox):** A lightweight window manager will run to coordinate window layout, size, and title decorations if headful interactions are required.
* **Audio Capture (ALSA/PulseAudio):** Audio outputs will be redirected to virtual audio devices if sound streaming is required in future epics.

### 2. Playwright / Automation Agent
* The container will bundle a control agent that uses **Playwright** or **Puppeteer** to connect to Chromium over Chrome DevTools Protocol (CDP) at `ws://127.0.0.1:9222`.
* The control agent will parse visual screen buffer updates and forward keyboard/mouse actions using absolute coordinates.

---

##  Communication Model

```
                                              +-----------------------------------+
                                              |        Browser Container          |
                                              |  +------------+   +------------+  |
[Next.js App] <--- (RTC / WebSocket Stream) --+--|  Streamer  |   |  Chromium  |  |
                                              |  |  Service   |   |  Runtime   |  |
                                              |  +-----+------+   +------+-----+  |
                                              |        |                 |        |
[Express App] <--- (Docker Socket Control) ---+--------|--- (CDP / WS) --+        |
                                              +-----------------------------------+
```

1. **Control Plane (HTTP/Unix Sockets):** Express backend launches the container and binds specific container ports for that session.
2. **Interactive Event Stream (WebSocket):** Frontend client connects directly to the container's Streamer Service. Mouse moves, clicks, and keystrokes are received by the Streamer and injected into Chromium.
3. **Visual Frame Stream (WebSockets/WebRTC):** The Streamer Service reads frame buffers directly from display `:99` (Xvfb), compresses them, and streams them back to the client.
