/**
 * Import APMC Directory Data
 * Run with: npx tsx tests/import-markets.ts
 */

import path from "path";
import { connectDB } from "../src/server/db";
import { ApmcDirectoryAdapter } from "../src/server/services/marketSources/apmcDirectoryAdapter";

async function importMarketData() {
  console.log("📥 Importing APMC Directory Data...");

  await connectDB();

  const adapter = new ApmcDirectoryAdapter();
  const csvPath = path.resolve(process.cwd(), "src/source/apmc_directory.csv");
  const result = await adapter.sync({
    csvPath,
    overwrite: true,
  });

  console.log("✅ Import Result:", result);

  process.exit(0);
}

importMarketData().catch((error) => {
  console.error("❌ Import failed:", error);
  process.exit(1);
});
