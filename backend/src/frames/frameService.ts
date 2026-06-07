import { EventEmitter } from "events";

export interface FramePayload {
  sessionId: string;
  timestamp: number;
  image: string; // Base64 encoded JPEG buffer
}

class FrameService extends EventEmitter {
  private static instance: FrameService;

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  public static getInstance(): FrameService {
    if (!FrameService.instance) {
      FrameService.instance = new FrameService();
    }
    return FrameService.instance;
  }

  /**
   * Emits a frame update for a specific session ID
   */
  public emitFrameUpdate(payload: FramePayload): void {
    this.emit(`frame:${payload.sessionId}`, payload);
  }

  /**
   * Subscribes a listener to a session's frame events
   */
  public subscribe(sessionId: string, callback: (payload: FramePayload) => void): void {
    this.on(`frame:${sessionId}`, callback);
  }

  /**
   * Unsubscribes a listener from a session's frame events
   */
  public unsubscribe(sessionId: string, callback: (payload: FramePayload) => void): void {
    this.off(`frame:${sessionId}`, callback);
  }
}

export const frameService = FrameService.getInstance();
