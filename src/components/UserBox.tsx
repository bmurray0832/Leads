"use client";

import { useUser } from "@auth0/nextjs-auth0/client";

// Shows the signed-in user + logout, or a login link. When AUTH_DISABLED is on
// for local dev there is no Auth0 session, so we show a "Local dev" marker.
export default function UserBox({ authDisabled }: { authDisabled: boolean }) {
  const { user, isLoading } = useUser();

  if (authDisabled) {
    return <span className="userbox">Local dev (auth off)</span>;
  }
  if (isLoading) return <span className="userbox">…</span>;
  if (!user) {
    return (
      <span className="userbox">
        <a href="/api/auth/login">Log in</a>
      </span>
    );
  }
  return (
    <span className="userbox">
      {user.name ?? user.email} · <a href="/api/auth/logout">Log out</a>
    </span>
  );
}
