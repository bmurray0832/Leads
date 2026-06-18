// Pure auth-gate decision — no Prisma/Auth0 imports so it is cheap to import
// from middleware (edge) and to unit test.

export const authDisabled = process.env.AUTH_DISABLED === "true";

// AUTH_DISABLED=true bypasses the gate for local dev / CI only. Never in prod.
export function gateDecision(input: {
  authDisabled: boolean;
  hasSession: boolean;
}): "allow" | "login" {
  if (input.authDisabled) return "allow";
  return input.hasSession ? "allow" : "login";
}
