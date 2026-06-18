import { NextResponse, type NextRequest } from "next/server";
import { gateDecision } from "@/lib/gate";

// Protects the app views. Unauthenticated requests are redirected to the Auth0
// login route. The @auth0/nextjs-auth0 session lives in the "appSession" cookie.
export function middleware(req: NextRequest) {
  const authDisabled = process.env.AUTH_DISABLED === "true";
  const hasSession = req.cookies.has("appSession");

  if (gateDecision({ authDisabled, hasSession }) === "login") {
    const loginUrl = new URL("/api/auth/login", req.url);
    loginUrl.searchParams.set("returnTo", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

// Apply to the app views only — never to /api/auth/* (the login flow itself)
// or to static assets.
export const config = {
  matcher: ["/contacts/:path*", "/kanban/:path*", "/funnel/:path*", "/duplicates/:path*", "/tasks/:path*", "/leads/:path*"],
};
