export type ResumeLink = { label?: string; url: string };
export type ExperienceEntry = { id: string; title: string; company: string; startDate: string; endDate: string; bullets: string[] };
export type EducationEntry = { id: string; institution: string; degree: string; startDate: string; endDate: string };
export type CertificationEntry = { id: string; name: string; issuer: string; date: string };
export type ProjectEntry = { id: string; name: string; description: string; link: string };

export type ResumeData = {
  contact: { name: string; email: string; phone: string; location: string; links: ResumeLink[] };
  summary: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  skills: string[];
  certifications: CertificationEntry[];
  projects: ProjectEntry[];
};

export const emptyResume = (): ResumeData => ({
  contact: { name: "", email: "", phone: "", location: "", links: [] },
  summary: "",
  experience: [],
  education: [],
  skills: [],
  certifications: [],
  projects: [],
});

export const resumeTemplates = [
  { id: "classic", name: "Classic ATS", description: "Single-column, conservative hierarchy with strong extraction order." },
  { id: "modern", name: "Modern ATS", description: "Single-column layout with restrained accent rules and compact spacing." },
  { id: "compact", name: "Compact ATS", description: "Single-column format optimized for dense, senior-level experience." },
] as const;

export type ChatMode = "coaching" | "interview" | "resume";
