import { getSession } from "@auth0/nextjs-auth0";
import { prisma } from "./prisma";
import { allowlistFromEnv, authDisabled, isAllowedUser } from "./gate";

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

export type AuthState =
  | { kind: "anonymous" }
  | {
      kind: "forbidden";
      sub: string;
      email: string | null;
      emailVerified: boolean;
    }
  | { kind: "allowed"; user: AppUser };

// Resolves the validated Auth0 session against the allowlist.
export async function getAuthState(): Promise<AuthState> {
  if (authDisabled) return { kind: "allowed", user: DEV_USER };
  const session = await getSession();
  const u = session?.user;
  if (!u?.sub) return { kind: "anonymous" };
  if (!isAllowedUser(u, allowlistFromEnv())) {
    return {
      kind: "forbidden",
      sub: u.sub,
      email: u.email ?? null,
      emailVerified: u.email_verified === true,
    };
  }
  return { kind: "allowed", user: { sub: u.sub, email: u.email, name: u.name } };
}

// Current allowlisted user for server components / actions, or null.
export async function getCurrentUser(): Promise<AppUser | null> {
  const state = await getAuthState();
  return state.kind === "allowed" ? state.user : null;
}

// Authorizes a server action: throws unless the caller is an allowlisted user,
// then ensures a User row exists and returns its id (for ownerId / userId on
// writes). Server actions can be invoked from any URL, so every action must
// call this — the middleware alone does not cover them.
export async function ensureCurrentUserId(): Promise<string> {
  const u = await getCurrentUser();
  if (!u) throw new Error("UNAUTHORIZED");
  const row = await prisma.user.upsert({
    where: { auth0Sub: u.sub },
    update: { email: u.email ?? undefined, name: u.name ?? undefined },
    create: { auth0Sub: u.sub, email: u.email ?? undefined, name: u.name ?? undefined },
  });
  return row.id;
}
