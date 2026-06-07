import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { frameService, FramePayload } from "../frames/frameService";
import { controlService } from "../controls/controlService";

export const initSocketServer = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*", // Allow all hosts inside Docker/development network
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    let activeSessionId: string | null = null;
    let frameListener: ((payload: FramePayload) => void) | null = null;

    // Client requests to subscribe to a browser session
    socket.on("session:join", (sessionId: string) => {
      // 1. Unsubscribe from previous session if exists
      if (activeSessionId && frameListener) {
        frameService.unsubscribe(activeSessionId, frameListener);
        socket.leave(`session:${activeSessionId}`);
        console.log(`[Socket] Client ${socket.id} left session ${activeSessionId}`);
      }

      activeSessionId = sessionId;
      socket.join(`session:${sessionId}`);
      console.log(`[Socket] Client ${socket.id} joined session ${sessionId}`);

      // 2. Create frame listener callback
      frameListener = (payload: FramePayload) => {
        socket.emit("frame:update", payload);
      };

      // 3. Register callback in FrameService
      frameService.subscribe(sessionId, frameListener);
    });

    // Mouse movement event
    socket.on("mouse:move", async (data: any) => {
      if (!activeSessionId) return;
      console.log(`[Socket] Received mouse:move for session ${activeSessionId}:`, data);
      try {
        const validated = controlService.validatePayload({ type: "mouse:move", ...data });
        await controlService.dispatchControl(activeSessionId, validated);
      } catch (err: any) {
        console.error(`[Socket] Error routing mouse:move for session ${activeSessionId}:`, err.message);
        socket.emit("control:error", { message: err.message });
      }
    });

    // Mouse click event
    socket.on("mouse:click", async (data: any) => {
      if (!activeSessionId) return;
      console.log(`[Socket] Received mouse:click for session ${activeSessionId}:`, data);
      try {
        const validated = controlService.validatePayload({ type: "mouse:click", ...data });
        await controlService.dispatchControl(activeSessionId, validated);
      } catch (err: any) {
        console.error(`[Socket] Error routing mouse:click for session ${activeSessionId}:`, err.message);
        socket.emit("control:error", { message: err.message });
      }
    });

    // Keyboard type event
    socket.on("keyboard:type", async (data: any) => {
      if (!activeSessionId) return;
      console.log(`[Socket] Received keyboard:type for session ${activeSessionId}:`, data);
      try {
        const validated = controlService.validatePayload({ type: "keyboard:type", ...data });
        await controlService.dispatchControl(activeSessionId, validated);
      } catch (err: any) {
        console.error(`[Socket] Error routing keyboard:type for session ${activeSessionId}:`, err.message);
        socket.emit("control:error", { message: err.message });
      }
    });

    // Mouse wheel (scroll) event
    socket.on("mouse:wheel", async (data: any) => {
      if (!activeSessionId) return;
      console.log(`[Socket] Received mouse:wheel for session ${activeSessionId}:`, data);
      try {
        const validated = controlService.validatePayload({ type: "mouse:wheel", ...data });
        await controlService.dispatchControl(activeSessionId, validated);
      } catch (err: any) {
        console.error(`[Socket] Error routing mouse:wheel for session ${activeSessionId}:`, err.message);
        socket.emit("control:error", { message: err.message });
      }
    });

    // Handle client disconnect
    socket.on("disconnect", () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
      if (activeSessionId && frameListener) {
        frameService.unsubscribe(activeSessionId, frameListener);
      }
    });
  });

  return io;
};
