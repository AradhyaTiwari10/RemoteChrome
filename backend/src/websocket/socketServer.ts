import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { frameService, FramePayload } from "../frames/frameService";
import { controlService } from "../controls/controlService";

export const initSocketServer = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    // Increase ping timeout to handle brief CAPTCHA/navigation stalls
    pingTimeout: 30000,
    pingInterval: 10000
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    let activeSessionId: string | null = null;
    let frameListener: ((payload: FramePayload) => void) | null = null;
    let framesEmitted = 0;

    // Client requests to subscribe to a browser session
    socket.on("session:join", (sessionId: string) => {
      // Unsubscribe from previous session if switching
      if (activeSessionId && frameListener) {
        frameService.unsubscribe(activeSessionId, frameListener);
        socket.leave(`session:${activeSessionId}`);
        console.log(`[Socket] Client ${socket.id} left session ${activeSessionId} (framesEmitted=${framesEmitted})`);
        framesEmitted = 0;
      }

      activeSessionId = sessionId;
      socket.join(`session:${sessionId}`);
      console.log(`[Socket] Client ${socket.id} joined session ${sessionId}`);

      // Create frame listener callback with diagnostics
      frameListener = (payload: FramePayload) => {
        framesEmitted++;
        // Log every 100th frame to confirm the broadcast chain is live
        if (framesEmitted % 100 === 1) {
          console.log(
            `[Socket] Broadcasting frame #${framesEmitted} for session ${sessionId} to client ${socket.id} (imageBytes=${payload.image.length})`
          );
        }
        socket.emit("frame:update", payload);
      };

      frameService.subscribe(sessionId, frameListener);
    });

    // Mouse movement event
    socket.on("mouse:move", async (data: any) => {
      if (!activeSessionId) return;
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
      try {
        const validated = controlService.validatePayload({ type: "mouse:wheel", ...data });
        await controlService.dispatchControl(activeSessionId, validated);
      } catch (err: any) {
        console.error(`[Socket] Error routing mouse:wheel for session ${activeSessionId}:`, err.message);
        socket.emit("control:error", { message: err.message });
      }
    });

    // Handle client disconnect
    socket.on("disconnect", (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id} (reason=${reason}, framesEmitted=${framesEmitted})`);
      if (activeSessionId && frameListener) {
        frameService.unsubscribe(activeSessionId, frameListener);
        frameListener = null;
      }
    });
  });

  return io;
};
