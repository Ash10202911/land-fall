import type { EmailMessage } from "@/lib/email";
import type { Locale } from "@/lib/i18n";
import { translatorFor } from "@/lib/i18n/translator";

/** Pure functions that decide who gets which email. No I/O, so they are easy to test. */

/** `language` is the person's own choice; their email is written in it. English when not given. */
export type Person = { email: string; company: string; language?: Locale };

function jobUrl(baseUrl: string, jobId: string) {
  return `${baseUrl.replace(/\/$/, "")}/jobs/${jobId}`;
}

/** New quote on my job: the requester only. Quote amounts are never put in email. */
export function planNewQuoteEmails(args: {
  baseUrl: string;
  jobId: string;
  route: string;
  requester: Person;
  quoterCompany: string;
}): EmailMessage[] {
  const { baseUrl, jobId, route, requester, quoterCompany } = args;
  const t = translatorFor(requester.language ?? "en");
  return [
    {
      to: requester.email,
      locale: t.locale,
      subject: t("New quote on your job: {route}", { route }),
      text: [
        t("{quoter} sent a sealed quote on your job {route}.", { quoter: quoterCompany, route }),
        "",
        `${t("Review and compare quotes")}: ${jobUrl(baseUrl, jobId)}`,
      ].join("\n"),
    },
  ];
}

/** Award: the winner gets "won", every other live quoter gets "lost". Duplicates are removed. */
export function planAwardEmails(args: {
  baseUrl: string;
  jobId: string;
  route: string;
  requesterCompany: string;
  winner: Person;
  losers: Person[];
}): EmailMessage[] {
  const { baseUrl, jobId, route, requesterCompany, winner, losers } = args;
  const url = jobUrl(baseUrl, jobId);
  const tw = translatorFor(winner.language ?? "en");
  const emails: EmailMessage[] = [
    {
      to: winner.email,
      locale: tw.locale,
      subject: tw("You won: {route}", { route }),
      text: [
        tw("{requester} awarded you the job {route}.", { requester: requesterCompany, route }),
        "",
        `${tw("Sign in to see their contact details")}: ${url}`,
        "",
        tw("Never change bank details based on a message. Always confirm by phone using a number you already trust."),
      ].join("\n"),
    },
  ];
  const seen = new Set([winner.email.toLowerCase()]);
  for (const loser of losers) {
    const key = loser.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const t = translatorFor(loser.language ?? "en");
    emails.push({
      to: loser.email,
      locale: t.locale,
      subject: t("Quote not selected: {route}", { route }),
      text: [
        t("{requester} chose another quote for the job {route}. Thank you for quoting.", { requester: requesterCompany, route }),
        "",
        `${t("View the job")}: ${url}`,
      ].join("\n"),
    });
  }
  return emails;
}

/** A requester cancelled their job: every company that had a live quote is told. Duplicates are removed. */
export function planCancelEmails(args: {
  baseUrl: string;
  jobId: string;
  route: string;
  requesterCompany: string;
  quoters: Person[];
}): EmailMessage[] {
  const { baseUrl, jobId, route, requesterCompany, quoters } = args;
  const url = jobUrl(baseUrl, jobId);
  const seen = new Set<string>();
  const emails: EmailMessage[] = [];
  for (const q of quoters) {
    const key = q.email.toLowerCase();
    if (!q.email || seen.has(key)) continue;
    seen.add(key);
    const t = translatorFor(q.language ?? "en");
    emails.push({
      to: q.email,
      locale: t.locale,
      subject: t("Job cancelled: {route}", { route }),
      text: [
        t("{requester} cancelled the job {route}. Your quote was not selected. Thank you for quoting.", { requester: requesterCompany, route }),
        "",
        `${t("View the job")}: ${url}`,
      ].join("\n"),
    });
  }
  return emails;
}

/**
 * A forwarder asked a question on a job: the requester is told. The asker is never named: questions are
 * anonymous to everyone but the asking company. Contact details are blocked in the database, so the
 * question text is safe to include.
 */
export function planQuestionAskedEmail(args: {
  baseUrl: string;
  jobId: string;
  route: string;
  requester: Person;
  question: string;
}): EmailMessage {
  const { baseUrl, jobId, route, requester, question } = args;
  const t = translatorFor(requester.language ?? "en");
  return {
    to: requester.email,
    locale: t.locale,
    subject: t("New question on your job: {route}", { route }),
    text: [
      t("A forwarder asked a question on your job {route}.", { route }),
      "",
      `"${question}"`,
      "",
      `${t("Answer it so every forwarder can see the answer")}: ${jobUrl(baseUrl, jobId)}`,
    ].join("\n"),
  };
}

/** The requester answered: the person who asked is told. */
export function planQuestionAnsweredEmail(args: {
  baseUrl: string;
  jobId: string;
  route: string;
  asker: Person;
  question: string;
  answer: string;
}): EmailMessage {
  const { baseUrl, jobId, route, asker, question, answer } = args;
  const t = translatorFor(asker.language ?? "en");
  return {
    to: asker.email,
    locale: t.locale,
    subject: t("Your question was answered: {route}", { route }),
    text: [
      t("The requester answered your question on {route}.", { route }),
      "",
      `${t("Question")}: ${question}`,
      `${t("Answer")}: ${answer}`,
      "",
      `${t("View the job")}: ${jobUrl(baseUrl, jobId)}`,
    ].join("\n"),
  };
}
