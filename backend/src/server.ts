import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import loggerMiddleware from "./middleware/logger";
import errorHandlerMiddleware from "./middleware/errorHandler";
import healthRouter from "./routes/health";

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
app.use(loggerMiddleware);

// Route Handlers
app.use(healthRouter);

// Middleware: Global Error Handling Structure
app.use(errorHandlerMiddleware);

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
