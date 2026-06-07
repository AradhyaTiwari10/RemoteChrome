import { DockerService } from "../docker/dockerService";
import crypto from "crypto";

export interface BrowserSession {
  sessionId: string;
  containerId: string;
  status: "starting" | "active" | "stopped" | "failed";
  createdAt: string;
  targetUrl: string;
}

export class BrowserService {
  private dockerService: DockerService;
  private sessions: Map<string, BrowserSession>;

  constructor() {
    this.dockerService = new DockerService();
    this.sessions = new Map<string, BrowserSession>();
  }

  /**
   * Spawns a new browser container and registers it as an active session
   */
  async createSession(targetUrl: string): Promise<BrowserSession> {
    // Basic validation of the URL
    try {
      new URL(targetUrl);
    } catch (e) {
      throw new Error("Invalid target URL");
    }

    const sessionId = crypto.randomUUID();
    const session: BrowserSession = {
      sessionId,
      containerId: "",
      status: "starting",
      createdAt: new Date().toISOString(),
      targetUrl
    };

    // Store in-memory registry
    this.sessions.set(sessionId, session);

    try {
      // 1. Create Docker container
      const containerId = await this.dockerService.createContainer(sessionId, targetUrl);
      session.containerId = containerId;

      // 2. Start the container
      await this.dockerService.startContainer(containerId);

      // 3. Mark session active
      session.status = "active";
      return session;
    } catch (error: any) {
      session.status = "failed";
      // Cleanup container if it was created
      if (session.containerId) {
        try {
          await this.dockerService.removeContainer(session.containerId);
        } catch (cleanupErr) {
          // Ignore cleanup errors
        }
      }
      throw new Error(`Failed to initialize browser session: ${error.message}`);
    }
  }

  /**
   * Stops and removes a session's container and marks it as stopped
   */
  async stopSession(sessionId: string): Promise<BrowserSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    if (session.status === "stopped") {
      return session;
    }

    try {
      if (session.containerId) {
        // Stop container
        try {
          await this.dockerService.stopContainer(session.containerId);
        } catch (e) {
          // Ignore if already stopped
        }
        // Remove container
        await this.dockerService.removeContainer(session.containerId);
      }

      session.status = "stopped";
      return session;
    } catch (error: any) {
      throw new Error(`Failed to stop browser session: ${error.message}`);
    }
  }

  /**
   * Retrieves a single session by ID
   */
  getSession(sessionId: string): BrowserSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    return session;
  }

  /**
   * Lists all active/registered sessions
   */
  listSessions(): BrowserSession[] {
    return Array.from(this.sessions.values());
  }
}
