import type { Locale } from "@/lib/i18n";
import { translatorFor } from "@/lib/i18n/translator";

/** `locale` is the recipient's language; it sets the footer. English when not given. */
export type EmailMessage = { to: string; subject: string; text: string; locale?: Locale };

export const EMAIL_SENDER_NAME = "Southbound";
export const EMAIL_FOOTER = `\n\n--\nSent by ${EMAIL_SENDER_NAME}. To stop these emails, reply STOP.`;

/** Adds the standard footer: sender name and a "reply STOP" line. */
export function withFooter(text: string, locale: Locale = "en"): string {
  if (locale === "en") return `${text.trimEnd()}${EMAIL_FOOTER}`;
  const t = translatorFor(locale);
  return `${text.trimEnd()}\n\n--\n${t("Sent by {name}. To stop these emails, reply STOP.", { name: EMAIL_SENDER_NAME })}`;
}

/** j***@example.com: keeps personal data out of logs. */
export function maskEmail(address: string): string {
  const [local = "", domain = ""] = address.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

export type SendResult = { ok: boolean; provider: "resend" | "console" };

type ResendLike = { emails: { send: (payload: Record<string, unknown>) => Promise<{ error: unknown }> } };

/**
 * The one place emails leave the app. Uses Resend when RESEND_API_KEY is set; otherwise logs the
 * email to the console (recipient masked) so the app runs with no accounts.
 * Never throws: a failed email must not fail the action that triggered it.
 */
export async function sendEmail(
  message: EmailMessage,
  deps: { apiKey?: string; from?: string; createResend?: (key: string) => Promise<ResendLike> } = {},
): Promise<SendResult> {
  const apiKey = "apiKey" in deps ? deps.apiKey : process.env.RESEND_API_KEY;
  const from = deps.from ?? process.env.EMAIL_FROM ?? `${EMAIL_SENDER_NAME} <no-reply@example.com>`;
  const body = withFooter(message.text, message.locale);

  if (!apiKey) {
    console.log(
      [
        "[email:console] RESEND_API_KEY is not set, so this email was not sent.",
        `To: ${maskEmail(message.to)}`,
        `Subject: ${message.subject}`,
        "",
        body,
      ].join("\n"),
    );
    return { ok: true, provider: "console" };
  }

  try {
    const create =
      deps.createResend ??
      (async (key: string) => {
        const { Resend } = await import("resend");
        return new Resend(key) as unknown as ResendLike;
      });
    const resend = await create(apiKey);
    const { error } = await resend.emails.send({ from, to: message.to, subject: message.subject, text: body });
    if (error) {
      console.error("[email] Resend rejected an email.");
      return { ok: false, provider: "resend" };
    }
    return { ok: true, provider: "resend" };
  } catch {
    console.error("[email] Sending failed.");
    return { ok: false, provider: "resend" };
  }
}
