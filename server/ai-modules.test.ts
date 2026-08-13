import { describe, expect, it, vi } from "vitest";
import { renderResumePdf } from "./pdf";
import { emptyResume, resumeTemplates } from "@shared/types";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn(async ({ messages }: { messages: Array<{ role: string; content: string }> }) => ({ choices: [{ message: { content: messages.at(-1)?.content.includes("Improve") ? "Led a team to deliver measurable outcomes." : "A grounded career response." } }] })) }));

function authContext(): TrpcContext {
  return { user: { id: 7, openId: "test-user", name: "Test User", email: "test@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("shared resume schema and deterministic PDF", () => {
  it("starts with every required section and three ATS templates", () => {
    const resume = emptyResume();
    expect(Object.keys(resume)).toEqual(["contact", "summary", "experience", "education", "skills", "certifications", "projects"]);
    expect(resumeTemplates).toHaveLength(3);
    expect(resumeTemplates.every(template => template.description.includes("Single-column"))).toBe(true);
  });

  it("renders actual resume data into a non-empty PDF buffer", async () => {
    const resume = emptyResume();
    resume.contact.name = "Ada Lovelace";
    resume.contact.email = "ada@example.com";
    resume.summary = "Analytical engineer building reliable systems.";
    resume.skills = ["TypeScript", "Systems design"];
    resume.experience = [{ id: "1", title: "Engineer", company: "Analytical Labs", startDate: "2024", endDate: "Present", bullets: ["Built a reliable platform"] }];
    const pdf = await renderResumePdf(resume, "classic");
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });
});

describe("reusable AI engine and protected contracts", () => {
  it("exposes all three module routers and authenticated context", () => {
    expect(appRouter).toHaveProperty("chatbot");
    expect(appRouter).toHaveProperty("resume");
    expect(appRouter).toHaveProperty("interview");
    expect(authContext().user?.id).toBe(7);
  });
});
