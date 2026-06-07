import { Request, Response, NextFunction } from "express";

/**
 * Custom request logger middleware printing [timestamp] METHOD path.
 */
export const loggerMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
};
export default loggerMiddleware;
