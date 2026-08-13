import { invokeLLM } from "./_core/llm";
import { getUserProfileContext } from "./db";
import { ChatMode } from "@shared/types";

const BASE_GUARDRAILS = `You are SigmaWork's career development AI. Stay focused on career development, profiles, resumes, job search preparation, and interview practice. Do not provide medical, legal, financial, unrelated personal, or general-purpose assistant advice. Politely redirect out-of-scope requests. Never fabricate a qualification, employer, credential, job title, or experience as if it were real. Use only the supplied profile and resume context, and clearly label suggestions as suggestions.`;

const MODE_PROMPTS: Record<ChatMode, string> = {
  coaching: "Act as a thoughtful career coach. Give practical, personalized guidance grounded in the user's context.",
  interview: "Act as an interview practice coach. Generate one realistic question or evaluate the user's actual answer with specific strengths, gaps, and improvements.",
  resume: "Act as a resume writing coach. Improve user-provided content without silently replacing it and keep recommendations truthful and ATS-friendly.",
};

export async function runCareerAI(params: { userId: number; mode: ChatMode; history: Array<{ role: "user" | "assistant"; content: string }>; userMessage?: string; promptOverride?: string; contextOverride?: { profile: string; resume: string } }) {
  const context = params.contextOverride ?? await getUserProfileContext(params.userId);
  const system = [BASE_GUARDRAILS, MODE_PROMPTS[params.mode], params.promptOverride ?? "", `USER PROFILE CONTEXT:\n${context.profile}\n\nSAVED RESUME CONTEXT:\n${context.resume}`].filter(Boolean).join("\n\n");
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: system },
        ...params.history.map(item => ({ role: item.role, content: item.content })),
        ...(params.userMessage ? [{ role: "user" as const, content: params.userMessage }] : []),
      ],
    });
    const content = response.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("AI returned an empty response");
    return content.trim();
  } catch (error) {
    console.error("[AIService] isolated LLM failure", { mode: params.mode, userId: params.userId, error });
    throw new Error("AI service temporarily unavailable");
  }
}

export async function suggestBullet(params: { userId: number; currentText: string; targetRole: string }) {
  return runCareerAI({
    userId: params.userId,
    mode: "resume",
    history: [],
    userMessage: `Improve this existing resume bullet for the target role. Do not invent facts; preserve the meaning and use a concise achievement-oriented style. Return only the suggested bullet.\n\nTarget role: ${params.targetRole}\nExisting bullet: ${params.currentText}`,
  });
}
