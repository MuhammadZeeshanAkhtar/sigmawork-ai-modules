import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { conversations, interviewQAs, interviewSessions, messages, resumeDrafts, users } from "../drizzle/schema";
import { getDb, getDraft, getSession, getSessionQAs, getUserProfileContext, listConversations, listMessages, listSessions, parseDraft, saveDraft } from "./db";
import { runCareerAI, suggestBullet } from "./aiEngine";
import { emptyResume, ResumeData, resumeTemplates } from "@shared/types";
import { renderResumePdf } from "./pdf";
import { storagePut } from "./storage";

const rateBuckets = new Map<number, { count: number; resetAt: number }>();
const MAX_MESSAGES_PER_MINUTE = 20;
const chatInput = z.object({ conversationId: z.number().int().positive().optional(), message: z.string().trim().min(1).max(4000), mode: z.enum(["coaching", "interview", "resume"]).default("coaching") });
const resumeSchema = z.object({
  contact: z.object({ name: z.string(), email: z.string(), phone: z.string(), location: z.string(), links: z.array(z.object({ label: z.string().optional(), url: z.string() })) }),
  summary: z.string(),
  experience: z.array(z.object({ id: z.string(), title: z.string(), company: z.string(), startDate: z.string(), endDate: z.string(), bullets: z.array(z.string()) })),
  education: z.array(z.object({ id: z.string(), institution: z.string(), degree: z.string(), startDate: z.string(), endDate: z.string() })),
  skills: z.array(z.string()),
  certifications: z.array(z.object({ id: z.string(), name: z.string(), issuer: z.string(), date: z.string() })),
  projects: z.array(z.object({ id: z.string(), name: z.string(), description: z.string(), link: z.string() })),
});

function enforceRateLimit(userId: number) {
  const now = Date.now(); const bucket = rateBuckets.get(userId);
  if (!bucket || bucket.resetAt <= now) { rateBuckets.set(userId, { count: 1, resetAt: now + 60_000 }); return; }
  if (bucket.count >= MAX_MESSAGES_PER_MINUTE) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "You have reached the chat limit for this minute. Please try again shortly." });
  bucket.count += 1;
}

function currentUserId(ctx: { user: { id: number } }) { return ctx.user.id; }
function parseProfileArray<T>(raw: string | null | undefined, fallback: T[]): T[] { if (!raw?.trim()) return fallback; try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed as T[] : fallback; } catch { return fallback; } }

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  chatbot: router({
    conversations: protectedProcedure.query(({ ctx }) => listConversations(currentUserId(ctx))),
    messages: protectedProcedure.input(z.object({ conversationId: z.number().int().positive() })).query(({ ctx, input }) => listMessages(currentUserId(ctx), input.conversationId)),
    send: protectedProcedure.input(chatInput).mutation(async ({ ctx, input }) => {
      const userId = currentUserId(ctx); enforceRateLimit(userId); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      let conversationId = input.conversationId; let conversation;
      if (conversationId) conversation = (await db.select().from(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId))).limit(1))[0];
      if (!conversation) { const result = await db.insert(conversations).values({ userId, mode: input.mode }); conversationId = Number(result[0].insertId); }
      if (!conversationId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Conversation could not be created" });
      const resolvedConversationId = conversationId;
      const historyRows = await db.select().from(messages).where(eq(messages.conversationId, resolvedConversationId)).orderBy(asc(messages.createdAt));
      await db.insert(messages).values({ conversationId: resolvedConversationId, role: "user", content: input.message });
      try {
        const reply = await runCareerAI({ userId, mode: input.mode, history: historyRows.filter(m => m.role !== "system").map(m => ({ role: m.role as "user" | "assistant", content: m.content })), userMessage: input.message });
        await db.insert(messages).values({ conversationId: resolvedConversationId, role: "assistant", content: reply });
        return { conversationId: resolvedConversationId, reply };
      } catch (error) {
        console.error("[Chatbot] isolated request failure", { userId, conversationId, error });
        throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "The AI coach is temporarily unavailable. Your message was saved; please try again." });
      }
    }),
  }),
  resume: router({
    getDraft: protectedProcedure.query(async ({ ctx }) => { const draft = await getDraft(currentUserId(ctx)); return { draft, data: parseDraft(draft), templates: resumeTemplates }; }),
    saveDraft: protectedProcedure.input(z.object({ data: resumeSchema, templateId: z.string(), title: z.string().max(255).optional() })).mutation(({ ctx, input }) => saveDraft(currentUserId(ctx), input.data as ResumeData, input.templateId, input.title)),
    importFromProfile: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" }); const user = (await db.select().from(users).where(eq(users.id, currentUserId(ctx))).limit(1))[0]; const draft = parseDraft(await getDraft(currentUserId(ctx)));
      const profileExperience = parseProfileArray(user?.profileExperience, draft.experience).map((entry: any, index) => ({ id: entry.id ?? `profile-experience-${index}`, title: entry.title ?? "", company: entry.company ?? "", startDate: entry.startDate ?? "", endDate: entry.endDate ?? "", bullets: Array.isArray(entry.bullets) ? entry.bullets : [] }));
      const profileEducation = parseProfileArray(user?.profileEducation, draft.education).map((entry: any, index) => ({ id: entry.id ?? `profile-education-${index}`, institution: entry.institution ?? "", degree: entry.degree ?? "", startDate: entry.startDate ?? "", endDate: entry.endDate ?? "" }));
      const data = { ...emptyResume(), ...draft, contact: { ...draft.contact, name: user?.name ?? draft.contact.name, email: user?.email ?? draft.contact.email }, summary: draft.summary || user?.headline || "", experience: draft.experience.length ? draft.experience : profileExperience, education: draft.education.length ? draft.education : profileEducation, skills: draft.skills.length ? draft.skills : (user?.profileSkills ?? "").split(",").map(x => x.trim()).filter(Boolean) };
      return saveDraft(currentUserId(ctx), data, "classic");
    }),
    suggestBullet: protectedProcedure.input(z.object({ currentText: z.string().min(1).max(1000), targetRole: z.string().min(1).max(255) })).mutation(async ({ ctx, input }) => { try { return { suggestion: await suggestBullet({ userId: currentUserId(ctx), ...input }) }; } catch { throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "AI writing help is temporarily unavailable." }); } }),
    exportPdf: protectedProcedure.input(z.object({ templateId: z.string(), data: resumeSchema.optional() })).mutation(async ({ ctx, input }) => { const userId = currentUserId(ctx); const draft = await getDraft(userId); const data = (input.data as ResumeData | undefined) ?? parseDraft(draft); try { const pdf = await renderResumePdf(data, input.templateId); const stored = await storagePut(`${userId}-resumes/${Date.now()}-${input.templateId}.pdf`, pdf, "application/pdf"); return { url: stored.url, key: stored.key, fileName: "sigmawork-resume.pdf" }; } catch (error) { console.error("[Resume] PDF export failure", { userId, error }); throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "PDF export failed. Please try again." }); } }),
  }),
  interview: router({
    sessions: protectedProcedure.query(({ ctx }) => listSessions(currentUserId(ctx))),
    session: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).query(async ({ ctx, input }) => { const session = await getSession(currentUserId(ctx), input.sessionId); if (!session) throw new TRPCError({ code: "NOT_FOUND" }); return { session, qas: await getSessionQAs(currentUserId(ctx), input.sessionId) }; }),
    start: protectedProcedure.input(z.object({ targetRole: z.string().min(1).max(255), seniority: z.string().min(1).max(64) })).mutation(async ({ ctx, input }) => {
      const userId = currentUserId(ctx); let question: string; try { question = await runCareerAI({ userId, mode: "interview", history: [], promptOverride: `Start a five-question mock interview for ${input.targetRole} at ${input.seniority} level. Return only the first question.`, userMessage: "Begin the interview." }); } catch { throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Interview AI is temporarily unavailable." }); }
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" }); const result = await db.insert(interviewSessions).values({ userId, targetRole: input.targetRole, seniority: input.seniority }); const sessionId = Number(result[0].insertId); await db.insert(interviewQAs).values({ sessionId, question, orderIndex: 1 }); return { sessionId, question, questionNumber: 1, totalQuestions: 5 };
    }),
    answer: protectedProcedure.input(z.object({ sessionId: z.number().int().positive(), answer: z.string().trim().min(1).max(5000) })).mutation(async ({ ctx, input }) => {
      const userId = currentUserId(ctx); const session = await getSession(userId, input.sessionId); if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Interview session not found" }); const qas = await getSessionQAs(userId, input.sessionId); const current = qas[qas.length - 1]; if (!current || current.userAnswer) throw new TRPCError({ code: "BAD_REQUEST", message: "No unanswered question is available." });
      const history = qas.flatMap(q => [{ role: "user" as const, content: q.userAnswer ?? "" }, { role: "assistant" as const, content: q.feedback ?? "" }]).filter(x => x.content);
      let feedback: string; try { feedback = await runCareerAI({ userId, mode: "interview", history, promptOverride: `Evaluate the actual answer below for the interview question. Give three labeled paragraphs: What was strong, What was missing, and How to improve. Then, if this is not question 5, add a concise next question after a line starting NEXT QUESTION:. If it is question 5, do not add a next question. Question: ${current.question}\nAnswer: ${input.answer}`, userMessage: "Evaluate this answer specifically." }); } catch { throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Interview feedback is temporarily unavailable. Your answer was not lost; please retry." }); }
      const nextMarker = "NEXT QUESTION:"; const markerIndex = feedback.indexOf(nextMarker); const feedbackText = markerIndex >= 0 ? feedback.slice(0, markerIndex).trim() : feedback.trim(); const nextQuestion = markerIndex >= 0 ? feedback.slice(markerIndex + nextMarker.length).trim() : undefined; const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" }); await db.update(interviewQAs).set({ userAnswer: input.answer, feedback: feedbackText }).where(eq(interviewQAs.id, current.id)); if (nextQuestion && qas.length < 5) { await db.insert(interviewQAs).values({ sessionId: input.sessionId, question: nextQuestion, orderIndex: qas.length + 1 }); return { feedback: feedbackText, nextQuestion, questionNumber: qas.length + 1, totalQuestions: 5, complete: false }; } await db.update(interviewSessions).set({ status: "completed" }).where(eq(interviewSessions.id, input.sessionId)); return { feedback: feedbackText, nextQuestion: null, questionNumber: qas.length, totalQuestions: 5, complete: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
