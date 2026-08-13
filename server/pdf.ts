import PDFDocument from "pdfkit";
import { ResumeData } from "@shared/types";

const clean = (value: string) => value.trim();

export function renderResumePdf(data: ResumeData, templateId: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margins: { top: 48, bottom: 48, left: 54, right: 54 }, info: { Title: data.contact.name ? `${data.contact.name} Resume` : "Resume", Author: "SigmaWork" } });
    const chunks: Buffer[] = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const accent = templateId === "modern" ? "1f4b5f" : templateId === "compact" ? "4d5566" : "1d3557";
    const headingSize = templateId === "compact" ? 10 : 11;
    const bodySize = templateId === "compact" ? 9 : 10;
    const lineGap = templateId === "compact" ? 1 : 3;

    doc.font("Helvetica-Bold").fontSize(18).fillColor(accent).text(clean(data.contact.name) || "Your Name", { align: "center" });
    const contact = [data.contact.email, data.contact.phone, data.contact.location, ...data.contact.links.map(link => link.url)].filter(Boolean).join("  |  ");
    if (contact) doc.font("Helvetica").fontSize(9).fillColor("333333").text(contact, { align: "center" });
    doc.moveDown(0.8);

    const section = (title: string) => { doc.moveDown(0.45).font("Helvetica-Bold").fontSize(headingSize).fillColor(accent).text(title.toUpperCase()); doc.moveTo(doc.x, doc.y + 2).lineTo(558, doc.y + 2).strokeColor(accent).lineWidth(0.7).stroke(); doc.moveDown(0.25); };
    const body = (text: string) => doc.font("Helvetica").fontSize(bodySize).fillColor("222222").text(text, { lineGap });

    if (clean(data.summary)) { section("Professional Summary"); body(data.summary); }
    if (data.experience.length) { section("Experience"); for (const item of data.experience) { doc.font("Helvetica-Bold").fontSize(bodySize).fillColor("222222").text(`${clean(item.title)}${item.company ? ` — ${clean(item.company)}` : ""}`); body([item.startDate, item.endDate].filter(Boolean).join(" – ")); for (const bullet of item.bullets.filter(Boolean)) body(`• ${clean(bullet)}`); doc.moveDown(0.2); } }
    if (data.education.length) { section("Education"); for (const item of data.education) { doc.font("Helvetica-Bold").fontSize(bodySize).fillColor("222222").text(`${clean(item.degree)}${item.institution ? ` — ${clean(item.institution)}` : ""}`); body([item.startDate, item.endDate].filter(Boolean).join(" – ")); } }
    if (data.skills.length) { section("Skills"); body(data.skills.filter(Boolean).join(" • ")); }
    if (data.certifications.length) { section("Certifications"); data.certifications.forEach(item => body(`${clean(item.name)}${item.issuer ? ` — ${clean(item.issuer)}` : ""}${item.date ? ` (${clean(item.date)})` : ""}`)); }
    if (data.projects.length) { section("Projects"); data.projects.forEach(item => { doc.font("Helvetica-Bold").fontSize(bodySize).fillColor("222222").text(clean(item.name)); body(`${clean(item.description)}${item.link ? ` (${clean(item.link)})` : ""}`); }); }
    doc.end();
  });
}
