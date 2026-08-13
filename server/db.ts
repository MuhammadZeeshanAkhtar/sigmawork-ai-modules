import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { conversations, InterviewQA, interviewQAs, interviewSessions, messages, resumeDrafts, ResumeDraft, InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { emptyResume, ResumeData } from "@shared/types";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod", "headline", "profileExperience", "profileEducation", "profileSkills"] as const) {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (!Object.keys(updateSet).length) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb(); if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1); return rows[0];
}

export async function getUserProfileContext(userId: number) {
  const db = await getDb(); if (!db) return { profile: "No profile data is currently available.", resume: "No saved resume is currently available." };
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  const draft = (await db.select().from(resumeDrafts).where(eq(resumeDrafts.userId, userId)).orderBy(desc(resumeDrafts.updatedAt)).limit(1))[0];
  const profile = [
    user?.name ? `Name: ${user.name}` : "",
    user?.headline ? `Headline: ${user.headline}` : "",
    user?.profileExperience ? `Experience: ${user.profileExperience}` : "",
    user?.profileEducation ? `Education: ${user.profileEducation}` : "",
    user?.profileSkills ? `Skills: ${user.profileSkills}` : "",
  ].filter(Boolean).join("\n") || "No profile data is currently available.";
  let resume = "No saved resume is currently available.";
  if (draft?.data) {
    try {
      const data = JSON.parse(draft.data) as ResumeData;
      resume = [
        data.contact.name && `Resume name: ${data.contact.name}`,
        data.summary && `Summary: ${data.summary}`,
        data.experience.length && `Experience: ${data.experience.map(e => `${e.title} at ${e.company}: ${e.bullets.join("; ")}`).join(" | ")}`,
        data.education.length && `Education: ${data.education.map(e => `${e.degree} at ${e.institution}`).join(" | ")}`,
        data.skills.length && `Skills: ${data.skills.join(", ")}`,
      ].filter(Boolean).join("\n") || resume;
    } catch { /* malformed drafts are ignored for grounding */ }
  }
  return { profile, resume };
}

export async function listConversations(userId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.updatedAt));
}
export async function getConversation(userId: number, id: number) {
  const db = await getDb(); if (!db) return undefined;
  return (await db.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId))).limit(1))[0];
}
export async function listMessages(userId: number, conversationId: number) {
  const db = await getDb(); if (!db) return [];
  const conversation = await getConversation(userId, conversationId); if (!conversation) return [];
  return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.createdAt));
}

export async function getDraft(userId: number) {
  const db = await getDb(); if (!db) return undefined;
  return (await db.select().from(resumeDrafts).where(eq(resumeDrafts.userId, userId)).orderBy(desc(resumeDrafts.updatedAt)).limit(1))[0];
}
export async function saveDraft(userId: number, data: ResumeData, templateId: string, title?: string) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const existing = await getDraft(userId);
  if (existing) { await db.update(resumeDrafts).set({ data: JSON.stringify(data), templateId, title: title ?? existing.title }).where(and(eq(resumeDrafts.id, existing.id), eq(resumeDrafts.userId, userId))); return { ...existing, data: JSON.stringify(data), templateId, title: title ?? existing.title }; }
  const result = await db.insert(resumeDrafts).values({ userId, data: JSON.stringify(data), templateId, title: title ?? "Untitled resume" });
  return { id: Number(result[0].insertId), userId, data: JSON.stringify(data), templateId, title: title ?? "Untitled resume" } as ResumeDraft;
}
export function parseDraft(draft?: ResumeDraft): ResumeData { if (!draft) return emptyResume(); try { return JSON.parse(draft.data) as ResumeData; } catch { return emptyResume(); } }

export async function listSessions(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(interviewSessions).where(eq(interviewSessions.userId, userId)).orderBy(desc(interviewSessions.createdAt)); }
export async function getSession(userId: number, id: number) { const db = await getDb(); if (!db) return undefined; return (await db.select().from(interviewSessions).where(and(eq(interviewSessions.id, id), eq(interviewSessions.userId, userId))).limit(1))[0]; }
export async function getSessionQAs(userId: number, sessionId: number) { const db = await getDb(); if (!db) return []; if (!(await getSession(userId, sessionId))) return []; return db.select().from(interviewQAs).where(eq(interviewQAs.sessionId, sessionId)).orderBy(asc(interviewQAs.orderIndex)); }
export async function createSession(userId: number, targetRole: string, seniority: string, question: string) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const result = await db.insert(interviewSessions).values({ userId, targetRole, seniority }); const sessionId = Number(result[0].insertId); await db.insert(interviewQAs).values({ sessionId, question, orderIndex: 1 }); return sessionId; }
export async function appendInterviewQA(userId: number, sessionId: number, answer: string, feedback: string, nextQuestion?: string) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const session = await getSession(userId, sessionId); if (!session) throw new Error("Interview session not found"); const qas = await getSessionQAs(userId, sessionId); const current = qas[qas.length - 1]; if (!current || current.userAnswer) throw new Error("No unanswered question is available"); await db.update(interviewQAs).set({ userAnswer: answer, feedback }).where(eq(interviewQAs.id, current.id)); if (nextQuestion) await db.insert(interviewQAs).values({ sessionId, question: nextQuestion, orderIndex: qas.length + 1 }); else await db.update(interviewSessions).set({ status: "completed" }).where(eq(interviewSessions.id, sessionId)); }
