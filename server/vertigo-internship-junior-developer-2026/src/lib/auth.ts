import { usersTable } from "../db/schema";
import db from "../db";
import { eq } from "drizzle-orm";

export interface AuthTokenPayload {
  userId: number;
}

/**
 * Hash a password using Bun's built-in crypto
 */
export async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(password, hash);
}

/**
 * Get user by ID
 */
export async function getUserById(userId: number): Promise<typeof usersTable.$inferSelect | null> {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  return user ?? null;
}

/**
 * Get user by API key
 */
export async function getUserByApiKey(apiKey: string): Promise<typeof usersTable.$inferSelect | null> {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.apiKey, apiKey) });
  return user ?? null;
}

/**
 * Generate a new API key for programmatic access.
 */
export function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `pm_${token}`;
}

/**
 * Mask an API key for status display without exposing the full token.
 */
export function maskApiKey(apiKey: string | null | undefined): string | null {
  if (!apiKey) {
    return null;
  }

  if (apiKey.length <= 10) {
    return `${apiKey.slice(0, 4)}****`;
  }

  return `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;
}
