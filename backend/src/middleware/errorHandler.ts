import { Request, Response, NextFunction } from "express";

const NODE_ENV = process.env.NODE_ENV || "development";

/**
 * Global Express error handling middleware.
 */
export const errorHandlerMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR: ${err.message}`);
  
  const responsePayload = {
    error: "Internal Server Error",
    message: NODE_ENV === "development" ? err.message : "An unexpected error occurred",
    ...(NODE_ENV === "development" && { stack: err.stack })
  };

  res.status(500).json(responsePayload);
};

export default errorHandlerMiddleware;
