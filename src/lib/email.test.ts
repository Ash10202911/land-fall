import { afterEach, describe, expect, it, vi } from "vitest";
import { EMAIL_FOOTER, maskEmail, sendEmail, withFooter } from "./email";
import { planAwardEmails, planNewQuoteEmails } from "./notification-plan";

const base = { baseUrl: "https://app.example.com/", jobId: "job-1", route: "Shenzhen to Melbourne" };

describe("recipients per email event", () => {
  it("new quote goes to the poster only, with no amounts", () => {
    const emails = planNewQuoteEmails({
      ...base,
      poster: { email: "poster@example.com", company: "Poster Co" },
      quoterCompany: "Quoter Co",
    });
    expect(emails.map((e) => e.to)).toEqual(["poster@example.com"]);
    expect(emails[0].text).toContain("Quoter Co");
    expect(emails[0].text).toContain("https://app.example.com/jobs/job-1");
    expect(emails[0].text).not.toMatch(/\$|AUD|USD/);
  });

  it("award tells the winner they won and every other quoter they lost", () => {
    const emails = planAwardEmails({
      ...base,
      posterCompany: "Poster Co",
      winner: { email: "win@example.com", company: "Winner Co" },
      losers: [
        { email: "lose1@example.com", company: "L1" },
        { email: "lose2@example.com", company: "L2" },
      ],
    });
    expect(emails.map((e) => e.to)).toEqual(["win@example.com", "lose1@example.com", "lose2@example.com"]);
    expect(emails[0].subject).toMatch(/won/i);
    expect(emails[1].subject).toMatch(/not selected/i);
    expect(emails[0].text).toMatch(/Never change bank details/);
  });

  it("does not email the winner twice or the same loser twice", () => {
    const emails = planAwardEmails({
      ...base,
      posterCompany: "Poster Co",
      winner: { email: "win@example.com", company: "W" },
      losers: [
        { email: "WIN@example.com", company: "W2" },
        { email: "a@example.com", company: "A" },
        { email: "A@example.com", company: "A again" },
      ],
    });
    expect(emails.map((e) => e.to)).toEqual(["win@example.com", "a@example.com"]);
  });

  it("contact details are never put in email", () => {
    const emails = planAwardEmails({
      ...base,
      posterCompany: "Poster Co",
      winner: { email: "win@example.com", company: "W" },
      losers: [],
    });
    expect(emails[0].text).not.toContain("+61");
  });
});

describe("sendEmail", () => {
  afterEach(() => vi.restoreAllMocks());

  it("adds the footer with sender name and reply STOP", () => {
    const text = withFooter("Hello");
    expect(text.endsWith(EMAIL_FOOTER)).toBe(true);
    expect(text).toContain("Sent by Southbound");
    expect(text).toContain("reply STOP");
  });

  it("logs to the console, with the footer and a masked recipient, when there is no RESEND_API_KEY", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const create = vi.fn();
    const result = await sendEmail(
      { to: "person@example.com", subject: "Hi", text: "Body" },
      { apiKey: undefined, createResend: create },
    );
    expect(result).toEqual({ ok: true, provider: "console" });
    expect(create).not.toHaveBeenCalled();
    const output = String(log.mock.calls[0][0]);
    expect(output).toContain("reply STOP");
    expect(output).toContain("Subject: Hi");
    expect(output).not.toContain("person@example.com");
    expect(output).toContain(maskEmail("person@example.com"));
  });

  it("sends through Resend with the footer when a key is set", async () => {
    const send = vi.fn().mockResolvedValue({ error: null });
    const result = await sendEmail(
      { to: "person@example.com", subject: "Hi", text: "Body" },
      { apiKey: "re_test", from: "Southbound <no-reply@example.com>", createResend: async () => ({ emails: { send } }) },
    );
    expect(result).toEqual({ ok: true, provider: "resend" });
    expect(send).toHaveBeenCalledOnce();
    const payload = send.mock.calls[0][0];
    expect(payload.to).toBe("person@example.com");
    expect(payload.text).toContain("reply STOP");
  });

  it("does not throw when Resend fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await sendEmail(
      { to: "person@example.com", subject: "Hi", text: "Body" },
      {
        apiKey: "re_test",
        createResend: async () => {
          throw new Error("network down");
        },
      },
    );
    expect(result.ok).toBe(false);
  });
});
