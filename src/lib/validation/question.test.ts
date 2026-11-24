import { describe, expect, it } from "vitest";
import { QUESTION_ERRORS, answerSchema, questionErrorMessage, questionSchema } from "./question";

describe("question and answer validation", () => {
  it("trims and bounds a question", () => {
    expect(questionSchema.parse({ text: "  Is the pallet stackable?  " }).text).toBe("Is the pallet stackable?");
    expect(questionSchema.safeParse({ text: "Hi" }).success).toBe(false);
    expect(questionSchema.safeParse({ text: "x".repeat(501) }).success).toBe(false);
  });
  it("needs an answer, up to 1000 characters", () => {
    expect(answerSchema.safeParse({ text: "   " }).success).toBe(false);
    expect(answerSchema.safeParse({ text: "Yes, stackable to two high." }).success).toBe(true);
    expect(answerSchema.safeParse({ text: "x".repeat(1001) }).success).toBe(false);
  });
});

describe("questionErrorMessage", () => {
  it("maps database errors to friendly messages", () => {
    expect(questionErrorMessage({ code: "22023", message: "Do not include contact details. They are shared after an award" })).toBe(QUESTION_ERRORS.contact);
    expect(questionErrorMessage({ code: "54000", message: "Too many questions in the last 24 hours" })).toBe(QUESTION_ERRORS.limit);
    expect(questionErrorMessage({ code: "22023", message: "Questions are closed for this job" })).toBe(QUESTION_ERRORS.closed);
    expect(questionErrorMessage({ code: "42501", message: "Only the requester can answer" })).toBe(QUESTION_ERRORS.denied);
    expect(questionErrorMessage(null)).toBe(QUESTION_ERRORS.failed);
  });
});
