import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sydneyHour } from "@/lib/lane-alerts";
import { sendLaneDigest } from "@/lib/lane-notifications";

export const dynamic = "force-dynamic";

const notFound = () => new NextResponse("Not found", { status: 404 });

/**
 * The daily lane summary, called by Vercel Cron with `Authorization: Bearer $CRON_SECRET`. It does nothing
 * (404) unless CRON_SECRET is set to at least 16 characters. It is scheduled at the two UTC times that are
 * 7am in Sydney across daylight saving, and only acts when it really is 7am there. Running it again never
 * sends anything twice. In development, add `?any=1` to run it at any hour.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return notFound();

  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const anyHour = process.env.NODE_ENV !== "production" && request.nextUrl.searchParams.get("any") === "1";
  if (!anyHour && sydneyHour(now) !== 7) {
    return NextResponse.json({ skipped: "It is not 7am in Sydney." }, { headers: { "Cache-Control": "no-store" } });
  }
  const result = await sendLaneDigest(now);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
