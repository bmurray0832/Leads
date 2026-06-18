import { getSession } from "@auth0/nextjs-auth0";
import { prisma } from "./prisma";
import { authDisabled } from "./gate";

export { authDisabled, gateDecision } from "./gate";

export interface AppUser {
  sub: string;
  email?: string | null;
  name?: string | null;
}

const DEV_USER: AppUser = {
  sub: "dev|local",
  email: "dev@example.com",
  name: "Local Dev",
};

// Current authenticated user for server components / actions.
export async function getCurrentUser(): Promise<AppUser | null> {
  if (authDisabled) return DEV_USER;
  const session = await getSession();
  const u = session?.user;
  if (!u?.sub) return null;
  return { sub: u.sub, email: u.email, name: u.name };
}

// Ensure a User row exists for the current session and return its id.
// Lets us stamp ownerId / userId on writes (activities, tasks).
export async function ensureCurrentUserId(): Promise<string | null> {
  const u = await getCurrentUser();
  if (!u) return null;
  const row = await prisma.user.upsert({
    where: { auth0Sub: u.sub },
    update: { email: u.email ?? undefined, name: u.name ?? undefined },
    create: { auth0Sub: u.sub, email: u.email ?? undefined, name: u.name ?? undefined },
  });
  return row.id;
}
