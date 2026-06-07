import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const NODE_ENV = process.env.NODE_ENV || "development";

// Middleware: Enable Cross-Origin Resource Sharing
app.use(cors());

// Middleware: Parse JSON payloads
app.use(express.json());

// Custom Logger Middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Route: Health Check
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: NODE_ENV
  });
});

// Middleware: Global Error Handling Structure
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR: ${err.message}`);
  
  const responsePayload = {
    error: "Internal Server Error",
    message: NODE_ENV === "development" ? err.message : "An unexpected error occurred",
    ...(NODE_ENV === "development" && { stack: err.stack })
  };

  res.status(500).json(responsePayload);
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 BrowserPilot Backend Orchestrator Started`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`🩺 Health endpoint: http://localhost:${PORT}/health`);
  console.log(`==================================================`);
});

// Graceful Shutdown
const shutdown = () => {
  console.log("Shutting down backend server gracefully...");
  server.close(() => {
    console.log("Backend server terminated.");
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
