import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyChallenge,
  verifyMetaSignature,
  processLeadgenPayload,
} from "@/lib/meta";

export const dynamic = "force-dynamic";

// Meta webhook verification handshake.
export function GET(req: NextRequest) {
  const result = verifyChallenge(
    req.nextUrl.searchParams,
    process.env.META_VERIFY_TOKEN,
  );
  if (!result.ok) {
    return new NextResponse("forbidden", { status: 403 });
  }
  return new NextResponse(result.challenge, { status: 200 });
}

// Meta leadgen events. Verifies the signature over the raw body, then fetches
// each lead from the Graph API and upserts it (dedupe + new-lead automation).
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifyMetaSignature(rawBody, signature, process.env.META_APP_SECRET)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { results, errors } = await processLeadgenPayload(prisma, payload);
  const created = results.filter((r) => r.created).length;

  // Always 200 so Meta doesn't retry on per-lead errors we've already logged.
  return NextResponse.json({ ok: true, created, processed: results.length, errors });
}
