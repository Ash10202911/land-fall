import "server-only";

/** Placeholders until F8 wires email. They never throw: a failed email must not fail the action. */
export async function notifyNewQuote(args: { jobId: string; quoteId: string }): Promise<void> {
  void args;
}

export async function notifyAward(args: { jobId: string; winningQuoteId: string }): Promise<void> {
  void args;
}
