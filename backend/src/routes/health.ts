import { Router, Request, Response } from "express";

const router = Router();
const NODE_ENV = process.env.NODE_ENV || "development";

/**
 * GET /health
 * Returns status: ok when the system is online.
 */
router.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: NODE_ENV
  });
});

export default router;
