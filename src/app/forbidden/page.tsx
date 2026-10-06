import { redirect } from "next/navigation";
import { getAuthState, type AuthState } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Shown to someone who signed in through the shared Holy Insights Auth0 tenant
// but isn't on the Leads allowlist. Displays their own Auth0 id so the owner
// can add it to ALLOWED_AUTH0_SUBS (e.g. when their email isn't verified).
export default async function ForbiddenPage() {
  let state: AuthState = { kind: "anonymous" };
  try {
    state = await getAuthState();
  } catch {
    // Auth not configured — treat as signed out.
  }
  if (state.kind === "allowed") redirect("/contacts");
  if (state.kind === "anonymous") redirect("/");

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 16,
      }}
    >
      <h1 style={{ fontSize: 28, margin: 0 }}>No access to Leads CRM</h1>
      <p className="subtle" style={{ maxWidth: 460 }}>
        You&apos;re signed in, but this account isn&apos;t on the Leads CRM
        allowlist.
      </p>
      <div className="panel" style={{ padding: "12px 16px", textAlign: "left" }}>
        <div className="field-row">
          <span className="k">Email</span>
          <span>{state.email ?? "—"}</span>
        </div>
        <div className="field-row">
          <span className="k">Email verified</span>
          <span>{state.emailVerified ? "yes" : "no"}</span>
        </div>
        <div className="field-row">
          <span className="k">Auth0 id</span>
          <code>{state.sub}</code>
        </div>
      </div>
      <p className="subtle" style={{ maxWidth: 460 }}>
        To grant access, add the Auth0 id above to <code>ALLOWED_AUTH0_SUBS</code>{" "}
        (or a verified email to <code>ALLOWED_EMAILS</code>) in Railway.
      </p>
      <a className="btn ghost" href="/api/auth/logout" style={{ textDecoration: "none" }}>
        Log out
      </a>
    </div>
  );
}
