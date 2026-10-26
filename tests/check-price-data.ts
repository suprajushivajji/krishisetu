/**
 * Check what price data is available in database
 * Run with: npx tsx tests/check-price-data.ts
 */

import { connectDB } from "../src/server/db";
import { MarketPrice } from "../src/server/models/MarketPrice";

async function checkPriceData() {
  console.log("🔍 Checking available price data...\n");

  await connectDB();

  // Get all unique commodities
  const commodities = await MarketPrice.distinct("commodity");
  console.log("📦 Available commodities:", commodities);

  // Get all unique states
  const states = await MarketPrice.distinct("state");
  console.log("📍 Available states:", states);

  // Get all unique districts
  const districts = await MarketPrice.distinct("district");
  console.log("🏘️ Available districts:", districts);

  // Count total records
  const totalCount = await MarketPrice.countDocuments();
  console.log(`\n📊 Total price records: ${totalCount}`);

  // Sample some records
  const sampleRecords = await MarketPrice.find().limit(5).lean();
  console.log("\n📝 Sample records:");
  sampleRecords.forEach((r) => {
    console.log(`   ${r.commodity} in ${r.market}, ${r.district}, ${r.state} - ₹${r.modalPricePerKg}/kg (${r.arrivalDate.toISOString().split('T')[0]})`);
  });

  // Check if we have Karnataka data
  const karnatakaRecords = await MarketPrice.find({ state: { $regex: /karnataka/i } }).limit(5).lean();
  console.log(`\n🇮🇳 Karnataka records found: ${karnatakaRecords.length}`);
  karnatakaRecords.forEach((r) => {
    console.log(`   ${r.commodity} in ${r.market}, ${r.district} - ₹${r.modalPricePerKg}/kg`);
  });

  process.exit(0);
}

checkPriceData().catch((error) => {
  console.error("❌ Check failed:", error);
  process.exit(1);
});
