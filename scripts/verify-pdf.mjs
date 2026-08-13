import { writeFile } from "node:fs/promises";
import { emptyResume } from "../shared/types.ts";
import { renderResumePdf } from "../server/pdf.ts";

const data = emptyResume();
data.contact.name = "Ada Lovelace";
data.contact.email = "ada@example.com";
data.summary = "Analytical engineer building reliable systems.";
data.experience = [{ id: "1", title: "Engineer", company: "Analytical Labs", startDate: "2024", endDate: "Present", bullets: ["Built a reliable platform"] }];
const pdf = await renderResumePdf(data, "classic");
await writeFile("/tmp/sigmawork-resume.pdf", pdf);
console.log(`/tmp/sigmawork-resume.pdf ${pdf.length}`);
