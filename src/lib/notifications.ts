import "server-only";

/** Placeholder until F8 wires email. Never throws: a failed email must not fail the action. */
export async function notifyNewQuote(_args: { jobId: string; quoteId: string }): Promise<void> {}
