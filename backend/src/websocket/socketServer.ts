import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { frameService, FramePayload } from "../frames/frameService";

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
