import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  handleAdminDepositWallet,
  handleGenerateApiKey,
  handleGetApiKeyStatus,
  handleGetWalletSummary,
  handleLogin,
  handleRegister,
  handleRevokeApiKey,
} from "./handlers";

export const authRoutes = new Elysia({ prefix: "/api/auth" })
  .use(authMiddleware)
  .post("/register", (context) => handleRegister(context as any), {
    body: t.Object({
      username: t.String(),
      email: t.String(),
      password: t.String(),
    }),
  })
  .post("/login", (context) => handleLogin(context as any), {
    body: t.Object({
      email: t.String(),
      password: t.String(),
    }),
  })
  .guard(
    {
      beforeHandle({ user, set }) {
        if (!user) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
      },
    },
    (app) =>
      app
        .get("/wallet", (context) => handleGetWalletSummary(context as any))
        .post("/wallet/deposit", (context) => handleAdminDepositWallet(context as any), {
          body: t.Object({
            amount: t.Number(),
          }),
        })
        .get("/api-key", handleGetApiKeyStatus)
        .post("/api-key", (context) => handleGenerateApiKey(context as any))
        .delete("/api-key", handleRevokeApiKey),
  );
