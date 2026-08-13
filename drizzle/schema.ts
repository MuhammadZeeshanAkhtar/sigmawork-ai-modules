import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  headline: varchar("headline", { length: 255 }),
  profileExperience: text("profileExperience"),
  profileEducation: text("profileEducation"),
  profileSkills: text("profileSkills"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  mode: varchar("mode", { length: 64 }).notNull().default("coaching"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ userIdx: index("conversations_user_id_idx").on(table.userId) }));

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ conversationIdx: index("messages_conversation_id_idx").on(table.conversationId) }));

export const resumeDrafts = mysqlTable("resumeDrafts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull().default("Untitled resume"),
  data: text("data").notNull(),
  templateId: varchar("templateId", { length: 64 }).notNull().default("classic"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ userIdx: index("resume_drafts_user_id_idx").on(table.userId) }));

export const interviewSessions = mysqlTable("interviewSessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetRole: varchar("targetRole", { length: 255 }).notNull(),
  seniority: varchar("seniority", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["active", "completed", "failed"]).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ userIdx: index("interview_sessions_user_id_idx").on(table.userId) }));

export const interviewQAs = mysqlTable("interviewQAs", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull().references(() => interviewSessions.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  userAnswer: text("userAnswer"),
  feedback: text("feedback"),
  orderIndex: int("orderIndex").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ sessionIdx: index("interview_qas_session_id_idx").on(table.sessionId) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type ResumeDraft = typeof resumeDrafts.$inferSelect;
export type InterviewSession = typeof interviewSessions.$inferSelect;
export type InterviewQA = typeof interviewQAs.$inferSelect;
