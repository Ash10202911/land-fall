"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { MODE_COOKIE, MODE_COOKIE_MAX_AGE, SEEN_COOKIE, parseMode } from "@/lib/mode";

const cookieOptions = {
  maxAge: MODE_COOKIE_MAX_AGE,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
  path: "/",
};

/** Saves the Requester / Quoter choice. Only changes which screens are shown, never access. */
export async function setViewMode(value: unknown): Promise<void> {
  await requireMember();
  const mode = parseMode(value);
  if (!mode) return;
  (await cookies()).set(MODE_COOKIE, mode, cookieOptions);
  revalidatePath("/", "layout");
}

/** Marks every job on the board as seen, so only later jobs show the NEW badge. */
export async function markJobsSeen(): Promise<void> {
  await requireMember();
  (await cookies()).set(SEEN_COOKIE, new Date().toISOString(), cookieOptions);
  revalidatePath("/jobs");
}
