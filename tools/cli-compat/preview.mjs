// 이메일 미리보기 — 실제 핀 vs 최신으로 verify + 릴리즈 노트 수집 후 이메일 조립.
// 발송은 안 함. plaintext 는 stdout, HTML 은 /tmp/compat-email-<pkg>.html.
//   node tools/cli-compat/preview.mjs ccusage
//   FROM_OVERRIDE=0.9.7 TO_OVERRIDE=0.9.11 node tools/cli-compat/preview.mjs codeburn

import { writeFileSync } from "node:fs";
import { verifyPackage, cmpVer } from "./verify.mjs";
import { collectReleaseNotes } from "./release-notes.mjs";
import { composeEmail } from "./email.mjs";
import { CONTRACT } from "./manifest.mjs";

const pkg = process.argv[2] ?? "ccusage";
const v = await verifyPackage(pkg, process.env.FROM_OVERRIDE, process.env.TO_OVERRIDE);
if (!v.changed) { console.log(`[${pkg}] ${v.from} = latest — 변경 없음 (이메일 없음)`); process.exit(0); }

const notes = await collectReleaseNotes(CONTRACT[pkg].githubRepo, v.from, v.to, cmpVer);
const mail = composeEmail({ pkg, from: v.from, to: v.to, verify: v, notes });

const htmlPath = `/tmp/compat-email-${pkg}.html`;
writeFileSync(htmlPath, mail.html);
console.log("================ PLAINTEXT ================");
console.log(mail.text);
console.log("\n================ META ================");
console.log("subject:", mail.subject);
console.log("verdict:", mail.verdict);
console.log("html   :", htmlPath);
