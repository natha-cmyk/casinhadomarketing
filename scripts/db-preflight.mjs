// Mantido por compatibilidade com paths no CI; lógica em migrate-reconcile.ts
import { execSync } from "node:child_process";

execSync("tsx scripts/migrate-reconcile.ts", { stdio: "inherit", env: process.env });
