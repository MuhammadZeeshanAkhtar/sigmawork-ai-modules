import DashboardLayout from "@/components/DashboardLayout";
import { AIChatBox, Message } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useState } from "react";
import { Plus, MessageSquare, AlertCircle } from "lucide-react";

export default function Coach() {
  const conversations = trpc.chatbot.conversations.useQuery();
  const [conversationId, setConversationId] = useState<number | undefined>();
  const messages = trpc.chatbot.messages.useQuery({ conversationId: conversationId! }, { enabled: Boolean(conversationId) });
  const send = trpc.chatbot.send.useMutation({ onSuccess: result => { setConversationId(result.conversationId); messages.refetch(); conversations.refetch(); }, onError: () => messages.refetch() });
  useEffect(() => { if (!conversationId && conversations.data?.[0]) setConversationId(conversations.data[0].id); }, [conversationId, conversations.data]);
  const displayMessages = useMemo<Message[]>(() => (messages.data ?? []).map(m => ({ role: m.role as Message["role"], content: m.content })), [messages.data]);
  return <DashboardLayout><div className="mx-auto grid max-w-7xl gap-6 py-4 lg:grid-cols-[280px_1fr]">
    <Card className="h-fit"><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Conversations</CardTitle><Button size="icon" variant="outline" onClick={() => { setConversationId(undefined); }} aria-label="New conversation"><Plus className="h-4 w-4" /></Button></CardHeader><CardContent className="space-y-2">{conversations.isLoading ? <p className="text-sm text-muted-foreground">Loading history…</p> : conversations.data?.length ? conversations.data.map(c => <button key={c.id} onClick={() => setConversationId(c.id)} className={`flex w-full items-start gap-2 rounded-xl p-3 text-left text-sm transition ${conversationId === c.id ? "bg-cyan-50 text-cyan-900" : "hover:bg-muted"}`}><MessageSquare className="mt-0.5 h-4 w-4 shrink-0" /><span className="truncate">{c.mode === "coaching" ? "Career coaching" : c.mode} · {new Date(c.updatedAt).toLocaleDateString()}</span></button>) : <p className="text-sm leading-6 text-muted-foreground">No conversations yet. Start with a question about your next career move.</p>}</CardContent></Card>
    <div className="space-y-4"><div><p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-700">Career coaching</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">A coach that remembers your context.</h1><p className="mt-2 text-muted-foreground">Responses are grounded in your saved profile and resume. The coach stays focused on career development.</p></div>{send.error && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertCircle className="h-4 w-4 mt-0.5" />{send.error.message}</div>}<AIChatBox messages={displayMessages} onSendMessage={content => send.mutate({ conversationId, message: content, mode: "coaching" })} isLoading={send.isPending} height={"min(68vh, 680px)"} emptyStateMessage="Start a grounded career conversation" suggestedPrompts={["What should I focus on next in my career?", "How can I position my experience for a new role?", "Help me identify a skill gap to work on."]} /></div>
  </div></DashboardLayout>;
}
