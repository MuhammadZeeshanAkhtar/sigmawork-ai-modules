import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, FileText, Video, ArrowRight, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

const modules = [
  { path: "/coach", icon: Bot, title: "Career Coach", body: "A persistent coach grounded in your profile and saved resume." },
  { path: "/resume", icon: FileText, title: "Resume Maker", body: "Build an ATS-safe resume, get controlled writing help, and export a real PDF." },
  { path: "/interview", icon: Video, title: "Interview Prep", body: "Practice a five-question interview with answer-specific feedback." },
];

export default function Home() {
  return <DashboardLayout><div className="mx-auto max-w-6xl space-y-8 py-4">
    <div className="rounded-3xl bg-slate-950 px-8 py-10 text-white shadow-xl md:px-12"><p className="text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">SigmaWork career studio</p><h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">Turn your experience into your next opportunity.</h1><p className="mt-4 max-w-2xl text-slate-300">One workspace for thoughtful career guidance, evidence-based resume building, and interview practice that remembers what you have already shared.</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/coach"><Button className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">Open career coach <ArrowRight className="ml-2 h-4 w-4" /></Button></Link></div></div>
    <div className="grid gap-5 md:grid-cols-3">{modules.map(({ path, icon: Icon, title, body }) => <Card key={path} className="group border-slate-200/70 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><CardHeader><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700"><Icon className="h-5 w-5" /></div><CardTitle>{title}</CardTitle></CardHeader><CardContent className="space-y-5"><p className="text-sm leading-6 text-muted-foreground">{body}</p><Link href={path}><Button variant="outline" className="w-full">Open module <ArrowRight className="ml-2 h-4 w-4" /></Button></Link></CardContent></Card>)}</div>
    <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p><strong>Private by default.</strong> Your conversations, drafts, and interview sessions are stored behind your authenticated account and are not shared between users.</p></div>
  </div></DashboardLayout>;
}
