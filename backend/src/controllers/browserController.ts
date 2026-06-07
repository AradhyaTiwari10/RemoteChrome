import { Request, Response } from "express";
import { BrowserService } from "../browser/browserService";

const browserService = new BrowserService();

/**
 * POST /api/browser/start
 * Starts a new browser session container
 */
export const startSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { targetUrl } = req.body;

    if (!targetUrl || typeof targetUrl !== "string") {
      res.status(400).json({ error: "targetUrl is required and must be a string" });
      return;
    }

    // Validate URL format
    try {
      new URL(targetUrl);
    } catch (e) {
      res.status(400).json({ error: "Invalid targetUrl format. Must include protocol (e.g., http:// or https://)" });
      return;
    }

    const session = await browserService.createSession(targetUrl);
    res.status(201).json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/browser
 * Lists all registered browser sessions
 */
export const listSessions = (_req: Request, res: Response): void => {
  try {
    const sessions = browserService.listSessions();
    res.status(200).json(sessions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/browser/:sessionId
 * Retrieves specific browser session status
 */
export const getSession = (req: Request, res: Response): void => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const session = browserService.getSession(sessionId);
    res.status(200).json(session);
  } catch (error: any) {
    if (error.message === "Session not found") {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
};

/**
 * POST /api/browser/:sessionId/stop
 * Terminates and removes a browser session container
 */
export const stopSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const session = await browserService.stopSession(sessionId);
    res.status(200).json(session);
  } catch (error: any) {
    if (error.message === "Session not found") {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
};
