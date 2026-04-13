import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { authRoutes } from "./src/api/auth.routes";
import { marketRoutes } from "./src/api/markets.routes";
import { resolveExpiredMarketsAutomatically } from "./src/api/handlers";
import { runMigrations } from "./src/db/migrate";
import { jwtPlugin } from "./src/plugins/jwt";

const PORT = Number(process.env.PORT || 4001);
const HOST = process.env.HOST || "0.0.0.0";
const AUTO_RESOLVE_INTERVAL_MS = Number(process.env.AUTO_RESOLVE_INTERVAL_MS || 10000);

export const app = new Elysia()
  .use(
    cors({
      origin: "*",
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  )
  .use(jwtPlugin)
  .onError(({ code, set }) => {
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Not found" };
    }
    if (code === "VALIDATION") {
      set.status = 400;
      return { error: "Invalid request" };
    }
  })
  .use(authRoutes)
  .use(marketRoutes);

if (import.meta.main) {
  let isAutoResolving = false;

  const runAutoResolution = async () => {
    if (isAutoResolving) {
      return;
    }

    isAutoResolving = true;

    try {
      const result = await resolveExpiredMarketsAutomatically();
      if (result.resolved > 0) {
        console.log(`[auto-resolve] Resolved ${result.resolved} expired market(s)`);
      }
    } catch (error) {
      console.error("[auto-resolve] Unexpected failure:", error);
    } finally {
      isAutoResolving = false;
    }
  };

  await runMigrations();

  app.listen({
    port: PORT,
    hostname: HOST,
  });

  void runAutoResolution();
  setInterval(() => {
    void runAutoResolution();
  }, AUTO_RESOLVE_INTERVAL_MS);

  console.log(`🚀 Server running at http://${HOST}:${PORT}`);
}
