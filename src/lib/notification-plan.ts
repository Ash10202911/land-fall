import type { EmailMessage } from "@/lib/email";

/** Pure functions that decide who gets which email. No I/O, so they are easy to test. */

export type Person = { email: string; company: string };

function jobUrl(baseUrl: string, jobId: string) {
  return `${baseUrl.replace(/\/$/, "")}/jobs/${jobId}`;
}

/** New quote on my job: the poster only. Quote amounts are never put in email. */
export function planNewQuoteEmails(args: {
  baseUrl: string;
  jobId: string;
  route: string;
  poster: Person;
  quoterCompany: string;
}): EmailMessage[] {
  const { baseUrl, jobId, route, poster, quoterCompany } = args;
  return [
    {
      to: poster.email,
      subject: `New quote on your job: ${route}`,
      text: `${quoterCompany} sent a sealed quote on your job ${route}.\n\nReview and compare quotes: ${jobUrl(baseUrl, jobId)}`,
    },
  ];
}

/** Award: the winner gets "won", every other live quoter gets "lost". Duplicates are removed. */
export function planAwardEmails(args: {
  baseUrl: string;
  jobId: string;
  route: string;
  posterCompany: string;
  winner: Person;
  losers: Person[];
}): EmailMessage[] {
  const { baseUrl, jobId, route, posterCompany, winner, losers } = args;
  const url = jobUrl(baseUrl, jobId);
  const emails: EmailMessage[] = [
    {
      to: winner.email,
      subject: `You won: ${route}`,
      text: `${posterCompany} awarded you the job ${route}.\n\nSign in to see their contact details: ${url}\n\nNever change bank details based on a message. Always confirm by phone using a number you already trust.`,
    },
  ];
  const seen = new Set([winner.email.toLowerCase()]);
  for (const loser of losers) {
    const key = loser.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push({
      to: loser.email,
      subject: `Quote not selected: ${route}`,
      text: `${posterCompany} chose another quote for the job ${route}. Thank you for quoting.\n\nView the job: ${url}`,
    });
  }
  return emails;
}

/** A poster cancelled their job: every company that had a live quote is told. Duplicates are removed. */
export function planCancelEmails(args: {
  baseUrl: string;
  jobId: string;
  route: string;
  posterCompany: string;
  quoters: Person[];
}): EmailMessage[] {
  const { baseUrl, jobId, route, posterCompany, quoters } = args;
  const url = jobUrl(baseUrl, jobId);
  const seen = new Set<string>();
  const emails: EmailMessage[] = [];
  for (const q of quoters) {
    const key = q.email.toLowerCase();
    if (!q.email || seen.has(key)) continue;
    seen.add(key);
    emails.push({
      to: q.email,
      subject: `Job cancelled: ${route}`,
      text: `${posterCompany} cancelled the job ${route}. Your quote was not selected. Thank you for quoting.\n\nView the job: ${url}`,
    });
  }
  return emails;
}
