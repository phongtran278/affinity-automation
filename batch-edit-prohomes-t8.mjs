import path from "node:path";
import { fileURLToPath } from "node:url";
import profile from "./profiles/prohomes-t8.mjs";
import { loadSourceData } from "./core/source-data.mjs";
import { runBatch } from "./core/run-batch.mjs";

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);

async function main(){
  const source=loadSourceData(profile,__dirname);
  await runBatch(profile,source);
}

main().catch(err=>{
  console.error("\nLỖI:");
  console.error(err?.stack||err?.message||String(err));
  process.exitCode=1;
});
