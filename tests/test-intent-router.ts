/**
 * Test Intent Router
 * Run with: npx tsx tests/test-intent-router.ts
 */

import { connectDB } from "../src/server/db";
import { IntentRouter } from "../src/server/services/intentRouter";

async function testIntentRouter() {
  console.log("🧪 Testing Intent Router...\n");

  await connectDB();

  const testCases = [
    { transcript: "tomato price", district: "Davanagere" },
    { transcript: "what is the price of tomato", district: "Davanagere" },
    { transcript: "onion rate", district: "Davanagere" },
    { transcript: "calculate earnings for 500 kg", district: "Davanagere" },
    { transcript: "calculate earnings for 500 kg tomato", district: "Davanagere" },
    { transcript: "buyers for tomato", district: "Davanagere" },
    { transcript: "price", district: "Davanagere" }, // Should ask for crop
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 Transcript: "${testCase.transcript}"`);
    const intentResult = await IntentRouter.classify(testCase.transcript, testCase.district);
    console.log(`   Intent: ${intentResult.intent}`);
    console.log(`   Crop: ${intentResult.crop || "not detected"}`);
    console.log(`   Missing Fields: ${intentResult.missingFields.join(", ") || "none"}`);
    console.log(`   Confidence: ${intentResult.confidence}`);

    if (intentResult.intent !== "clarification_required") {
      const data = await IntentRouter.execute(intentResult);
      console.log(`   Data:`, JSON.stringify(data, null, 2));
    }
  }

  console.log("\n✅ Intent Router Test Complete");
  process.exit(0);
}

testIntentRouter().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
