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
  .post("/register", handleRegister, {
    body: t.Object({
      username: t.String(),
      email: t.String(),
      password: t.String(),
    }),
  })
  .post("/login", handleLogin, {
    body: t.Object({
      email: t.String(),
      password: t.String(),
    }),
  })
  .use(authMiddleware)
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
        .get("/wallet", handleGetWalletSummary)
        .post("/wallet/deposit", handleAdminDepositWallet, {
          body: t.Object({
            amount: t.Number(),
          }),
        })
        .get("/api-key", handleGetApiKeyStatus)
        .post("/api-key", handleGenerateApiKey)
        .delete("/api-key", handleRevokeApiKey),
  );
