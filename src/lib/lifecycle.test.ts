import { describe, expect, it } from "vitest";
import { checkDeadlineExtension, jobEditSchema } from "./validation/job";
import { planCancelEmails } from "./notification-plan";

const now = new Date("2026-11-19T00:00:00Z");

describe("job edit validation", () => {
  it("accepts valid edits and trims text", () => {
    const r = jobEditSchema.safeParse({
      cargoDescription: "  Ceramic tiles ",
      readyDate: "2026-12-01",
      deadlineDate: "2026-11-25",
      deadlineTime: "09:00",
      notes: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.cargoDescription).toBe("Ceramic tiles");
      expect(r.data.notes).toBeUndefined();
    }
  });

  it("rejects an empty description and a bad time", () => {
    const r = jobEditSchema.safeParse({
      cargoDescription: "",
      readyDate: "2026-12-01",
      deadlineDate: "2026-11-25",
      deadlineTime: "25:00",
    });
    expect(r.success).toBe(false);
  });
});

describe("checkDeadlineExtension", () => {
  const current = "2026-11-25T09:00:00.000Z";
  it("allows the same or a later deadline", () => {
    expect(checkDeadlineExtension({ deadlineDate: "2026-11-25", deadlineTime: "09:00" }, current, now)).toEqual({});
    expect(checkDeadlineExtension({ deadlineDate: "2026-11-30", deadlineTime: "09:00" }, current, now)).toEqual({});
  });
  it("rejects shortening and past deadlines", () => {
    expect(checkDeadlineExtension({ deadlineDate: "2026-11-22", deadlineTime: "09:00" }, current, now).deadlineDate).toMatch(/extended/);
    expect(checkDeadlineExtension({ deadlineDate: "2026-11-18", deadlineTime: "09:00" }, current, now).deadlineDate).toMatch(/future/);
  });
});

describe("planCancelEmails", () => {
  it("emails each quoting company once and never includes amounts", () => {
    const emails = planCancelEmails({
      baseUrl: "https://example.com/",
      jobId: "j1",
      route: "Shenzhen to Melbourne",
      requesterCompany: "Acme Agents",
      quoters: [
        { email: "a@x.com", company: "A" },
        { email: "A@x.com", company: "A" },
        { email: "b@x.com", company: "B" },
        { email: "", company: "C" },
      ],
    });
    expect(emails.map((e) => e.to)).toEqual(["a@x.com", "b@x.com"]);
    expect(emails[0].subject).toBe("Job cancelled: Shenzhen to Melbourne");
    expect(emails[0].text).toContain("https://example.com/jobs/j1");
    expect(emails[0].text).not.toMatch(/\$|AUD|USD/);
  });
});
