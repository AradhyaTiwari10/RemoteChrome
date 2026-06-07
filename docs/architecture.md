# Architecture Documentation — BrowserPilot

This document outlines the architectural decisions, design philosophies, and technical structure of **BrowserPilot**.

---

## 1. Project Overview & Goals
BrowserPilot is a local browser virtualization platform that enables secure, sandboxed web browsing through a remote interface.

### Goals
* **Isolation:** The browser must be decoupled from the host machine to prevent local privilege escalation or malicious file execution.
* **Low Latency:** Interactive mouse and keyboard controls must feel responsive, requiring visual stream compression and optimized control planes.
* **Extensibility:** The orchestration engine must allow developers to hook automated scripts (e.g. Playwright) directly into active interactive sessions.
* **Stateless Scaling:** Spawned browsers should be treated as ephemeral, disposable environments that clean up after themselves.

---

## 2. High-Level Architecture
BrowserPilot follows a monorepo multi-service architecture layout:

```
               +--------------------------------------+
               |               Client                 |
               |  +--------------------------------+  |
               |  |       Next.js Dashboard        |  |
               |  +---------------+----------------+  |
               +------------------|-------------------+
                                  |
                   HTTP/REST APIs | WebRTC/WebSockets
                   (Port 5001)    | (Port 8080/RTC)
                                  v
               +------------------|-------------------+
               |               Backend                |
               |  +---------------+----------------+  |
               |  |     Express Orchestrator       |  |
               |  +---------------+----------------+  |
               +------------------|-------------------+
                                  | Docker Engine API
                                  v
               +------------------|-------------------+
               |            Docker Host               |
               |  +---------------+----------------+  |
               |  |  [Container] Browser Sandbox   |  |
               |  |   - Chromium + Xvfb            |  |
               |  |   - WebRTC/WS Streamer Server   |  |
               |  +--------------------------------+  |
               +--------------------------------------+
```

---

## 3. Component Details

### A. Frontend Dashboard (Next.js 15)
* **View Renderer:** Receives and decodes the real-time frame stream (WebSockets binary array or WebRTC track) and renders it on a canvas/video element.
* **Event Capturer:** Attaches listeners to the viewport container to capture absolute coordinates of click events, keystrokes, and scroll events, converting them into structured payload frames sent via the control channel.
* **Orchestration Client:** Connects to the backend REST API to view active sessions, spin up new sessions, and terminate running containers.

### B. Backend Orchestrator (Node.js / Express)
* **Lifecycle Manager:** Communicates with the local Docker daemon using Docker Engine API/SDK to programmatically pull images, start sandboxed browser containers, assign resource limits, and prune stale containers.
* **API Route Handlers:** Handles session creations (`POST /api/sessions`), list sessions (`GET /api/sessions`), and deletion (`DELETE /api/sessions/:id`).
* **Connection Broker:** Negotiates streaming tokens and port forwards between the frontend client and the specific isolated browser container.

### C. Browser Sandbox Container (Dockerized Chromium)
* **Xvfb virtual framebuffer:** Runs a virtual windowing server inside Linux to allow headful Chromium execution in headless environments.
* **Chromium Core:** The actual browser instance running inside isolation.
* **Streamer Agent:** Node/C++ process in the container that hooks into the X11 screen, captures the frames, compresses them into WebP/VP8 format, and publishes them to the connected client.
* **Input Injector:** Receives control plane event payloads from the client and triggers them programmatically on Chromium via Playwright, Puppeteer, or lower-level toolsets (e.g. `xdotool`).

---

## 4. System Data Flows

### A. Session Provisioning Flow
1. User clicks **"Spawn Browser"** on the Next.js frontend.
2. Frontend sends `POST /api/sessions` to the Express backend.
3. Backend checks capacity and contacts Docker Daemon to launch a `browserpilot-chrome-sandbox` instance.
4. Once healthy, the container returns its internal WebSocket streaming port.
5. Backend responds to the client with the session connection metadata.

### B. Interactive Control Loop
```
[User Click] -> [Next.js Event Capturer] -> [JSON over WebSocket] -> [Streamer Agent] -> [xdotool Injector] -> [Chromium Action]
```
1. Client clicks at coordinates `(120, 240)` relative to the container size.
2. Dashboard translates this coordinates and packages: `{ type: "click", x: 120, y: 240, button: "left" }`.
3. Action is dispatched via WebSocket control channel.
4. Input Injector in the container receives the JSON frame and performs command-level injection.
5. The screen updates, generating new frames that are compressed and sent back to the dashboard canvas.

---

## 5. Security & Isolation Model
* **Network Isolation:** Browser containers will run inside a locked-down custom bridge network with no incoming traffic except through the authorized backend proxy.
* **Filesystem Isolation:** The container's root partition is read-only, with temporary memory-backed storage (`tmpfs`) mounted for browser profiles, ensuring no browser state persists once closed.
* **Resource Limits:** Docker Compose/Docker run commands enforce hard CPU limits (e.g., maximum 1 core) and memory caps (e.g., maximum 512MB) per instance to prevent denial of service (DoS) attacks on the host.

---

## 6. Architectural Justification & Advantages

### The Chosen Flow
```
Frontend Client  ──>  Backend Orchestrator  ──>  Browser Sandbox Container  ──>  Chromium
```

This multi-tier approach separates client-side visualization, state orchestration, container execution, and raw browser processes.

### Advantages
1. **Separation of Concerns:** 
   * The **Frontend** does not know how containers are provisioned; it only handles rendering and event capture.
   * The **Backend Orchestrator** manages lifecycle scheduling but does not process pixel values or compression codecs.
   * The **Browser Sandbox Container** runs isolated and handles input injection directly in its environment.
2. **Scalability:** 
   * As concurrent user counts grow, the Backend Orchestrator can balance container creation across multiple docker hosts/nodes (e.g. Docker Swarm or Kubernetes clusters) without changing frontend or streaming logic.
3. **Multi-Session Support:**
   * Because each browser runs inside its own Docker container with strict network ports, sandboxing multiple instances for a single user or multiple users is natively supported.
4. **Easier Debugging:**
   * Issues in the streaming protocols (e.g., frame drops) can be isolated to the container's streaming daemon, while API router issues (e.g., auth, session limits) are checked in the Express server.

---

## 7. Alternatives Considered

### Alternative A: Monolithic Server with Embedded Chrome
* *Description:* Running a single Node.js server that spawns Chromium directly using Puppeteer/Playwright processes on the host.
* *Why Rejected:* 
  * **Zero Security Sandbox:** If a website executes a sandbox escape vulnerability, the attacker gets immediate access to the host machine running the Node server.
  * **Resource Contention:** Multiple active Chromium processes on a single host make it difficult to set hard memory/CPU caps per session, risking host crashes.
  * **No Multi-Tenancy:** Harder to manage cookie/session cleaning reliably at process level compared to complete container isolation.

### Alternative B: Direct Peer Connection to Container (No Backend Orchestrator)
* *Description:* Frontend directly triggers Docker API commands to spawn containers, and connects directly via socket.
* *Why Rejected:*
  * **Security Risk:** Requires exposing the host's raw Docker Daemon socket `/var/run/docker.sock` to the public web client, allowing any client to take full control of the host machine.
  * **Orchestration Chaos:** No central point to enforce maximum session limits, track idle timeouts, or clean up zombie containers.

---

## 8. Browser Agent Container (Proof-of-Concept)

Introduced in Milestone 3, the Browser Agent Container serves as a minimal, lightweight prototype demonstrating isolated headless browser execution inside Docker.

### A. Responsibilities
* **Process Isolation:** Encapsulates the Chromium browser engine entirely within a secure Docker container, safeguarding host processes.
* **Task Automation:** Orchestrates programmatic page interactions (navigation, wait-states, page loading) via Playwright-core.
* **Artifact Capture:** Generates visual output files (screenshots) and writes them back to persistent shared volumes.

### B. Container Lifecycle

```
[docker compose run browser]
         │
         ▼
[Launch Headless Chromium]
         │
         ▼
[Navigate & Capture Screenshot]
         │
         ▼
[Save to Mounted Volume /screenshots]
         │
         ▼
[Exit Successfully (Status 0)]
```

The container is designed as a short-lived task (`restart: "no"`) that runs, finishes its automated navigation, outputs its screenshot artifact, and terminates cleanly.

### C. Screenshot Workflow
1. **Instantiation:** Container starts and executes the NodeJS script `browser.js`.
2. **Launch:** Playwright hooks into the system Chromium package installed natively in Alpine (`/usr/bin/chromium-browser`).
3. **Execution:** Chromium navigates headlessly to `https://www.google.com` and awaits full page load.
4. **Export:** Page screenshot is captured and saved directly to the `/screenshots/google-homepage.png` directory inside the container.
5. **Persistence:** The path maps to the host directory `./artifacts/screenshots` via a Docker bind mount volume, persisting the image on the host filesystem.
6. **Teardown:** Browser processes close, and the script exits with status `0`.

### D. Future Evolution Toward Streaming
While this milestone uses a short-lived, headless container, future iterations will evolve this service into a persistent runtime:
* **Interactive Mode:** The container will be updated to launch Chromium in headful mode using a virtual frame buffer (`Xvfb`).
* **Active Streaming:** A websocket or WebRTC streamer agent will run inside the container to continuously capture frame buffer updates from display `:99` and stream them as compressed video feeds to the Next.js frontend.
* **Control plane:** A websocket control socket will accept click/keystroke commands from the client and inject them into Chromium using coordinates.
* **Stateful management:** The Express orchestrator will dynamically manage the lifecycle of these containers (booting, port assignment, health checks, teardowns) on demand.

---

## 9. Persistent Session Orchestration (Milestone 4)

Milestone 4 transitions the architecture from batch container tasks to persistent, dynamically managed browser sessions. The Express backend orchestrator controls the lifecycle of running Chromium sibling containers using Dockerode.

### A. Session Lifecycle

```
[Client POST /api/browser/start]
                │
                ▼
[Orchestrator generates Session ID]
                │
                ▼
[Dockerode provisions browser container]
  - Env: TARGET_URL, SESSION_ID
  - Joined to browserpilot-net
                │
                ├────────────────────────┐
                ▼ (Success)              ▼ (Failure)
    [Mark Session ACTIVE]       [Mark Session FAILED]
                │                        │
                │                        ▼
                │               [Prune Container]
                ▼
[Active Keep-Alive Loop in Container]
                │
                ▼
[Client POST /api/browser/:id/stop]
                │
                ▼
[Dockerode stops & removes container]
                │
                ▼
[Mark Session STOPPED]
```

### B. Browser Container Lifecycle
Unlike Milestone 3 where the container exited after a screenshot, the container in Milestone 4:
1. **Initializes:** Reads `SESSION_ID` and `TARGET_URL` from the environment.
2. **Launches Browser:** Starts Chromium and navigates to the specified URL.
3. **Persists:** Runs an active wait loop (`while (keepAlive)`) keeping the browser process open.
4. **Shuts Down:** Listens for `SIGTERM` or `SIGINT` signals, closes the browser engine cleanly, and exits.

### C. Container Ownership Model
* **The Express backend** binds to `/var/run/docker.sock` of the host system.
* The orchestrator container is run as `user: root` to possess sufficient file permission privileges to write to the Docker socket.
* The orchestrator spawns, lists, monitors, and terminates sibling browser containers (named `browserpilot-session-<SESSION_ID>`) dynamically on demand.

### D. Future Streaming Path
* **WebRTC/WebSocket Tunneling:** The dynamic container allocation will assign a unique websocket port to each session container.
* **Backend Proxying:** The orchestrator will dynamically proxy WS connections from `/api/session/:id/stream` directly to the corresponding sibling container's WebSocket server port on the `browserpilot-net` network.
* **Canvas Updates:** The frontend client will establish connection to the orchestrator proxy, receiving real-time screen frame feeds and sending input commands back.
