import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@auth0/nextjs-auth0/edge";
import { allowlistFromEnv, gateDecision, isAllowedUser } from "@/lib/gate";

// Protects every page except the public ones listed in `config.matcher`.
// The Auth0 session cookie is decrypted and validated here — a cookie merely
// being present is not enough — and the user must be on the allowlist.
export async function middleware(req: NextRequest) {
  const authDisabled = process.env.AUTH_DISABLED === "true";
  if (authDisabled) return NextResponse.next();

  const res = NextResponse.next();
  const session = await getSession(req, res).catch(() => null);
  const user = session?.user;

  const decision = gateDecision({
    authDisabled,
    hasSession: Boolean(user?.sub),
    allowed: user ? isAllowedUser(user, allowlistFromEnv()) : false,
  });

  if (decision === "login") {
    const loginUrl = new URL("/api/auth/login", req.url);
    loginUrl.searchParams.set("returnTo", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (decision === "forbidden") {
    return NextResponse.redirect(new URL("/forbidden", req.url));
  }
  return res;
}

// Everything is gated except: the landing page (`/`, excluded because the
// pattern needs at least one character after the slash), the Auth0 routes,
// the forbidden page, the health check, secret-protected integration
// endpoints, and static assets. New pages are protected by default.
export const config = {
  matcher: [
    "/((?!api/auth|api/health|api/webhooks|api/inbound|api/cron|forbidden|_next/static|_next/image|favicon\\.ico).+)",
  ],
};
