import { handleAuth } from "@auth0/nextjs-auth0";

// Provides /api/auth/login, /api/auth/logout, /api/auth/callback, /api/auth/me.
export const GET = handleAuth();
