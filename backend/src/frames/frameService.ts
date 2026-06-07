import { EventEmitter } from "events";

export interface FramePayload {
  sessionId: string;
  timestamp: number;
  image: string; // Base64 encoded JPEG buffer
}

class FrameService extends EventEmitter {
  private static instance: FrameService;

  // Track per-session frame counters for diagnostics
  private frameCounters = new Map<string, number>();

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
   * Emits a frame update for a specific session ID.
   * Logs a warning if no subscribers are listening (stream would go nowhere).
   */
  public emitFrameUpdate(payload: FramePayload): void {
    const event = `frame:${payload.sessionId}`;
    const listenerCount = this.listenerCount(event);

    if (listenerCount === 0) {
      // Only log every 50 frames to avoid spam
      const count = (this.frameCounters.get(payload.sessionId) || 0) + 1;
      this.frameCounters.set(payload.sessionId, count);
      if (count % 50 === 1) {
        console.warn(
          `[FrameService] Frame received for session ${payload.sessionId} but NO active subscribers (frame #${count}). Stream is being dropped.`
        );
      }
    }

    this.emit(event, payload);
  }

  /**
   * Subscribes a listener to a session's frame events.
   */
  public subscribe(sessionId: string, callback: (payload: FramePayload) => void): void {
    const event = `frame:${sessionId}`;
    this.on(event, callback);
    console.log(
      `[FrameService] Subscriber added for session ${sessionId}. Total listeners: ${this.listenerCount(event)}`
    );
  }

  /**
   * Unsubscribes a listener from a session's frame events.
   */
  public unsubscribe(sessionId: string, callback: (payload: FramePayload) => void): void {
    const event = `frame:${sessionId}`;
    this.off(event, callback);
    console.log(
      `[FrameService] Subscriber removed for session ${sessionId}. Remaining listeners: ${this.listenerCount(event)}`
    );
  }

  /**
   * Returns the number of active subscribers for a session.
   */
  public getSubscriberCount(sessionId: string): number {
    return this.listenerCount(`frame:${sessionId}`);
  }
}

export const frameService = FrameService.getInstance();
