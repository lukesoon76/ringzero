import { buildAllTrustCards, buildTrustCard, type TrustCard } from "@ring-zero/policy";
import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "regent/trust-card/v1";

/** Stamp + sign a card so it is shareable and tamper-evident. */
function sign(card: TrustCard, issuedAt: string): { issuedAt: string; signature: string } {
  const signature = createHmac("sha256", KEY).update(JSON.stringify({ card, issuedAt })).digest("hex");
  return { issuedAt, signature };
}

/**
 * Trust Cards generated from real assurance evidence. `?pipeline=<id>` returns one;
 * otherwise all. Each card is stamped with an issue date and an HMAC signature.
 */
export function GET(req: Request): NextResponse {
  const issuedAt = new Date().toISOString().slice(0, 10);
  const id = new URL(req.url).searchParams.get("pipeline");
  try {
    if (id) {
      const card = buildTrustCard(id);
      return NextResponse.json({ ok: true, card, ...sign(card, issuedAt) });
    }
    const cards = buildAllTrustCards().map((card) => ({ card, ...sign(card, issuedAt) }));
    return NextResponse.json({ ok: true, cards });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
