import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Public landing page. Authenticated visitors are sent straight to the CRM;
// everyone else gets a page that actually renders (instead of bouncing into the
// auth-gated app) with a login button.
export default async function Home() {
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    // Auth not configured yet — fall through to the public landing page.
  }
  if (user) redirect("/contacts");

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
      <h1 style={{ fontSize: 32, margin: 0 }}>Leads CRM</h1>
      <p className="subtle" style={{ maxWidth: 420 }}>
        Your hosted pipeline — Contacts, Kanban, Funnel, Duplicates, Tasks, and
        revenue analytics. Please log in to continue.
      </p>
      <a className="btn" href="/api/auth/login" style={{ textDecoration: "none" }}>
        Log in
      </a>
    </div>
  );
}
