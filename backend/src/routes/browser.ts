import { Router } from "express";
import {
  startSession,
  listSessions,
  getSession,
  stopSession,
  receiveFrame
} from "../controllers/browserController";

const router = Router();

router.post("/browser/start", startSession);
router.get("/browser", listSessions);
router.get("/browser/:sessionId", getSession);
router.post("/browser/:sessionId/stop", stopSession);
router.post("/browser/:sessionId/frame", receiveFrame);

export default router;
