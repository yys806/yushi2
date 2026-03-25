import { spawnSync } from "node:child_process";

const projectRef = String(process.env.SUPABASE_PROJECT_REF || "").trim();

if (!projectRef) {
  console.error("[supabase:link] Missing SUPABASE_PROJECT_REF");
  console.error("Example: SUPABASE_PROJECT_REF=yourprojectref npm run supabase:link");
  process.exit(1);
}

const result = spawnSync("npx", ["supabase", "link", "--project-ref", projectRef], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
