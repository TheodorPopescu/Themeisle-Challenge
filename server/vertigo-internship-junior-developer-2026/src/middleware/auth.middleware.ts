import { Elysia } from "elysia";
import { getUserById, getUserByApiKey } from "../lib/auth";
import { jwtPlugin } from "../plugins/jwt";

export const authMiddleware = new Elysia({ name: "auth-middleware" })
  .use(jwtPlugin)
  .derive(async ({ headers, jwt }) => {
    const authHeader = headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { user: null };
    }

    const token = authHeader.substring(7);

    // Try JWT authentication first
    try {
      const payload = await jwt.verify(token);
      if (payload && payload.userId) {
        const user = await getUserById(payload.userId);
        if (user) {
          return { user };
        }
      }
    } catch (error) {
      // Not a valid JWT, continue to API key check
    }

    // Try API key authentication
    const user = await getUserByApiKey(token);
    if (user) {
      return { user };
    }

    return { user: null };
  })
  .as("global");
