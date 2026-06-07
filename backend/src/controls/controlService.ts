import http from "http";

export interface ControlPayload {
  type: "mouse:move" | "mouse:click" | "keyboard:type" | "mouse:wheel";
  x?: number;
  y?: number;
  text?: string;
  deltaX?: number;
  deltaY?: number;
}

export class ControlService {
  // Store last mouse:move timestamp per session to throttle
  private lastMouseMove = new Map<string, number>();
  
  // Throttle interval for mouse moves in ms
  private static MOUSE_MOVE_THROTTLE_MS = 30;

  /**
   * Validates the structure and value bounds of the control payload
   */
  validatePayload(payload: any): ControlPayload {
    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid payload: must be an object");
    }

    const { type } = payload;
    if (!type || typeof type !== "string") {
      throw new Error("Invalid payload: action type is required and must be a string");
    }

    switch (type) {
      case "mouse:move":
      case "mouse:click":
        if (typeof payload.x !== "number" || typeof payload.y !== "number") {
          throw new Error(`Invalid payload: coordinates (x, y) must be numbers for action ${type}`);
        }
        if (payload.x < 0 || payload.x > 1920 || payload.y < 0 || payload.y > 1080) {
          throw new Error(`Invalid payload: coordinates (${payload.x}, ${payload.y}) out of virtual bounds (1920x1080)`);
        }
        return { type, x: payload.x, y: payload.y };

      case "keyboard:type":
        if (typeof payload.text !== "string") {
          throw new Error("Invalid payload: text must be a string for action keyboard:type");
        }
        // Limit typing length to prevent overflows
        if (payload.text.length > 200) {
          throw new Error("Invalid payload: text length exceeds maximum limit of 200 characters");
        }
        return { type, text: payload.text };

      case "mouse:wheel":
        if (typeof payload.deltaX !== "number" || typeof payload.deltaY !== "number") {
          throw new Error("Invalid payload: deltaX and deltaY must be numbers for action mouse:wheel");
        }
        // Limit delta ranges
        if (Math.abs(payload.deltaX) > 2000 || Math.abs(payload.deltaY) > 2000) {
          throw new Error("Invalid payload: scroll delta exceeds maximum safe threshold");
        }
        return { type, deltaX: payload.deltaX, deltaY: payload.deltaY };

      default:
        throw new Error(`Unsupported action type: ${type}`);
    }
  }

  /**
   * Routes the validated event payload to the sibling browser container
   */
  async dispatchControl(sessionId: string, payload: ControlPayload): Promise<void> {
    // Implement rate limiting (throttling) for mouse move events
    if (payload.type === "mouse:move") {
      const now = Date.now();
      const lastTime = this.lastMouseMove.get(sessionId) || 0;
      if (now - lastTime < ControlService.MOUSE_MOVE_THROTTLE_MS) {
        // Silently throttle to prevent clogging CPU/network
        return;
      }
      this.lastMouseMove.set(sessionId, now);
    }

    console.log(`[ControlService] Dispatching event '${payload.type}' to session ${sessionId}:`, payload);

    return new Promise<void>((resolve, reject) => {
      const containerName = `browserpilot-session-${sessionId}`;
      const url = `http://${containerName}:3001/control`;

      const requestBody = JSON.stringify(payload);

      console.log(`[ControlService] Sending HTTP POST to ${url} (size: ${Buffer.byteLength(requestBody)} bytes)`);

      const req = http.request(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(requestBody)
          },
          timeout: 2000 // 2 second timeout for action injection
        },
        (res) => {
          let resData = "";
          res.on("data", (chunk) => {
            resData += chunk;
          });
          res.on("end", () => {
            console.log(`[ControlService] HTTP response from container: status=${res.statusCode}`);
            if (res.statusCode === 200) {
              resolve();
            } else {
              let errMsg = "Unknown error";
              try {
                const parsed = JSON.parse(resData);
                errMsg = parsed.error || errMsg;
              } catch (e) {}
              console.error(`[ControlService] Container control endpoint failed: ${errMsg}`);
              reject(new Error(`Container control failure (HTTP ${res.statusCode}): ${errMsg}`));
            }
          });
        }
      );

      req.on("error", (err) => {
        console.error(`[ControlService] HTTP request error targeting container:`, err.message);
        reject(new Error(`Failed to contact browser container control server: ${err.message}`));
      });

      req.on("timeout", () => {
        console.error(`[ControlService] HTTP request timed out targeting container`);
        req.destroy();
        reject(new Error("Container control server request timed out"));
      });

      req.write(requestBody);
      req.end();
    });
  }
}

export const controlService = new ControlService();
