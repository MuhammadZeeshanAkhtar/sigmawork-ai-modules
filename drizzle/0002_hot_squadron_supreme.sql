CREATE INDEX `conversations_user_id_idx` ON `conversations` (`userId`);--> statement-breakpoint
CREATE INDEX `interview_qas_session_id_idx` ON `interviewQAs` (`sessionId`);--> statement-breakpoint
CREATE INDEX `interview_sessions_user_id_idx` ON `interviewSessions` (`userId`);--> statement-breakpoint
CREATE INDEX `messages_conversation_id_idx` ON `messages` (`conversationId`);--> statement-breakpoint
CREATE INDEX `resume_drafts_user_id_idx` ON `resumeDrafts` (`userId`);