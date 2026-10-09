import path from "node:path";
import { fileURLToPath } from "node:url";
import profile from "./clients/prohomes3/vhm/profiles/t7-2026.mjs";
import { loadVhmSourceData } from "./clients/prohomes3/vhm/source-data.mjs";
import { runBatch } from "./core/run-batch.mjs";

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);

async function main(){
  const source=loadVhmSourceData(profile,__dirname);
  await runBatch(profile,source);
}

main().catch(err=>{
  console.error("\nLỖI:");
  console.error(err?.stack||err?.message||String(err));
  process.exitCode=1;
});
