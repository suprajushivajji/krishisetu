import assert from "node:assert/strict";
import {
  calculateNetReturn,
  normalizePriceToPerKg,
  normalizeToKg,
  calculateHaversineDistanceKm,
} from "../src/server/utils/calculator";

console.log("🧪 [Test Suite] Running deterministic unit & calculation tests...\n");

// Test 1: Unit Normalization
console.log("Test 1: normalizeToKg()");
assert.equal(normalizeToKg(5, "quintal"), 500, "5 quintals should be 500 kg");
assert.equal(normalizeToKg(2, "ton"), 2000, "2 tons should be 2000 kg");
assert.equal(normalizeToKg(10, "crates"), 250, "10 crates should be 250 kg");
assert.equal(normalizeToKg(100, "kg"), 100, "100 kg should be 100 kg");
console.log("  ✅ Unit conversions to kg passed.");

// Test 2: Price Normalization
console.log("Test 2: normalizePriceToPerKg()");
assert.equal(normalizePriceToPerKg(3200, "quintal"), 32, "₹3200/quintal should be ₹32/kg");
assert.equal(normalizePriceToPerKg(30000, "ton"), 30, "₹30,000/ton should be ₹30/kg");
assert.equal(normalizePriceToPerKg(35, "kg"), 35, "₹35/kg should be ₹35/kg");
console.log("  ✅ Price conversions to per kg passed.");

// Test 3: Haversine distance
console.log("Test 3: calculateHaversineDistanceKm()");
// Davanagere (14.4644, 75.9218) to Harihar (14.5126, 75.8078) is ~13.5 km
const dist = calculateHaversineDistanceKm(14.4644, 75.9218, 14.5126, 75.8078);
assert.ok(dist >= 12 && dist <= 16, `Distance should be ~13.5km, got ${dist}`);
console.log(`  ✅ Haversine distance calculated accurately: ${dist} km.`);

// Test 4: Net return calculation with known values
console.log("Test 4: calculateNetReturn()");
// 500 kg at ₹34/kg, 18 km distance, ₹1.20 handling/kg, ₹15/km/ton transport
const res1 = calculateNetReturn({
  pricePerKg: 34,
  quantityKg: 500,
  distanceKm: 18,
  handlingCostPerKg: 1.2,
  transportRatePerKmPerTon: 15,
});

assert.equal(res1.grossValue, 17000, "Gross should be 500 * 34 = 17,000");
assert.equal(res1.estimatedHandlingCost, 600, "Handling should be 500 * 1.2 = 600");
// Tonnage: 500 / 1000 = 0.5 ton. Transport: 18 * 15 * 0.5 = 135
assert.equal(res1.estimatedTransportCost, 135, "Transport should be 135");
assert.equal(res1.estimatedNetReturn, 16265, "Net should be 17000 - 735 = 16,265");
assert.equal(res1.netReturnPerKg, 32.53, "Net per kg should be 32.53");
console.log("  ✅ Net return arithmetic verified with deterministic test cases.");

console.log("\n🎉 ALL UNIT & CALCULATION TESTS PASSED SUCCESSFULLY!\n");
