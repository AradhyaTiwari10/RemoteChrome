# Milestones Roadmap — BrowserPilot

This document defines the phases (Epics) required to build and deploy the BrowserPilot virtual browser platform.

---

## Epic 1 — Foundation (Current)
* **Objective:** Initialize monorepo, structure tooling, configure frontend dashboard skeleton, write Express health check server.
* **Deliverables:**
  * Root configurations (`.gitignore`, `docker-compose.yml` skeleton, `README.md`).
  * `frontend/` directory with Next.js 15, TypeScript, Tailwind CSS, App Router.
  * `backend/` directory with Express, TypeScript, health check, logger, error handling.
  * Development and verification scripts.

---

## Epic 2 — Docker
* **Objective:** Dockerize application components to ensure a unified local developer workspace and configuration consistency.
* **Deliverables:**
  * `frontend/Dockerfile` (multi-stage Next.js configuration).
  * `backend/Dockerfile` (TypeScript Node build process).
  * `docker-compose.yml` fully implemented to start frontend, backend, and private bridge network.
  * Environment variable configurations for cross-service API requests.

---

## Epic 3 — Browser Container
* **Objective:** Construct a customized browser image containing headless/headful Chromium.
* **Deliverables:**
  * `browser/Dockerfile` containing Chromium, Xvfb, and system libraries.
  * Initialization script inside the browser image to spin up Xvfb virtual frame buffer.
  * Integration tests verifying Chromium runs, loads URLs, and exits cleanly inside headless Linux.

---

## Epic 4 — Backend Orchestration
* **Objective:** Connect the Express server to the Docker daemon to provision browser containers programmatically.
* **Deliverables:**
  * Docker Engine SDK/API client integration on the backend.
  * APIs to create, list, inspect, and kill session containers (`POST /sessions`, `GET /sessions`, `DELETE /sessions/:id`).
  * Automated cleanup routines to terminate idle or orphan browser instances.

---

## Epic 5 — Streaming
* **Objective:** Stream visual output from Chromium container to the Next.js client.
* **Deliverables:**
  * Streamer daemon inside the browser container to capture Xvfb framebuffer.
  * WebSocket server (or WebRTC signaling backend) that transmits frame buffers (JPEG/WebP) to the frontend.
  * Frontend canvas renderer receiving, parsing, and painting image frames at ~24+ FPS.

---

## Epic 6 — Controls
* **Objective:** Forward mouse and keyboard events from the frontend to the Chromium instance.
* **Deliverables:**
  * DOM event listeners on the frontend viewport canvas to track mouse actions (moves, clicks, drags) and keystrokes.
  * Standardized control message protocol (JSON payloads) sent via WebSockets.
  * Event injector in the container using `xdotool` or Playwright to process and execute these inputs on the Chromium page.

---

## Epic 7 — Production Hardening
* **Objective:** Harden security, optimize bandwidth, scale capability, and compile logs.
* **Deliverables:**
  * Read-only container filesystems, memory profiling limits (cgroups), and network egress sandboxing.
  * Stream compression (H.264 or VP8 via WebRTC) for reduced network overhead.
  * Multi-session concurrency tests and auto-scaling logic.
  * Aggregated logging system for tracking container activity and audit trails.
