import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

/**
 * Get the current session, or null if not authenticated.
 */
export async function getSession() {
  return getServerSession(authOptions);
}

/**
 * Require admin access. Returns the session if admin, null otherwise.
 */
export async function requireAdmin() {
  const session = await getSession();
  if (!session?.user?.isAdmin) return null;
  return session;
}
