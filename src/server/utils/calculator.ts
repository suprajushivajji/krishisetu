/**
 * KrishiSetu Fair Price Advisor & Unit Calculation Utilities
 * 
 * Rules:
 * - 1 Quintal = 100 kg
 * - 1 Ton / Metric Tonne = 1,000 kg
 * - Standard mandi commission / cess / handling: defaults to ₹1.20/kg
 * - Transport cost estimated as: distanceKm * transportRatePerKmPerKg (or fixed rate per ton-km)
 */

export interface UnitConversionResult {
  pricePerKg: number;
  totalKg: number;
}

export function normalizeToKg(
  quantity: number,
  unit: string
): number {
  const cleanUnit = unit.toLowerCase().trim();
  switch (cleanUnit) {
    case "quintal":
    case "qtl":
    case "quintals":
      return quantity * 100;
    case "ton":
    case "tonne":
    case "tons":
      return quantity * 1000;
    case "crate":
    case "crates":
      // Standard tomato crate is ~25kg in Karnataka APMC
      return quantity * 25;
    case "bag":
    case "bags":
      // Standard onion/potato bag is ~50kg
      return quantity * 50;
    case "kg":
    case "kilogram":
    case "kgs":
    default:
      return quantity;
  }
}

export function normalizePriceToPerKg(
  price: number,
  unit: string
): number {
  const cleanUnit = unit.toLowerCase().trim();
  switch (cleanUnit) {
    case "quintal":
    case "qtl":
    case "quintals":
    case "rs/quintal":
      return price / 100;
    case "ton":
    case "tonne":
    case "tons":
      return price / 1000;
    case "crate":
      return price / 25;
    case "bag":
      return price / 50;
    case "kg":
    case "rs/kg":
    default:
      return price;
  }
}

export interface NetReturnCalculationInput {
  pricePerKg: number;
  quantityKg: number;
  distanceKm?: number;
  handlingCostPerKg?: number; // default ₹1.20
  transportRatePerKmPerTon?: number; // default ₹12/km per 1000kg (~₹0.012/kg/km)
  additionalCosts?: number; // e.g., sorting, loading, packaging lumpsum
}

export interface NetReturnCalculationResult {
  grossValue: number;
  quantityKg: number;
  pricePerKg: number;
  estimatedHandlingCost: number;
  estimatedTransportCost: number;
  additionalCosts: number;
  totalEstimatedDeductions: number;
  estimatedNetReturn: number;
  netReturnPerKg: number;
  netReturnPerQuintal: number;
}

export function calculateNetReturn(
  input: NetReturnCalculationInput
): NetReturnCalculationResult {
  const {
    pricePerKg,
    quantityKg,
    distanceKm = 0,
    handlingCostPerKg = 1.2,
    transportRatePerKmPerTon = 15,
    additionalCosts = 0,
  } = input;

  const grossValue = Number((pricePerKg * quantityKg).toFixed(2));
  const estimatedHandlingCost = Number((handlingCostPerKg * quantityKg).toFixed(2));
  
  // Transport: (distance * ratePerTonKm * (quantity / 1000))
  const tonnage = Math.max(quantityKg / 1000, 0.1);
  const estimatedTransportCost = distanceKm > 0
    ? Number((distanceKm * transportRatePerKmPerTon * tonnage).toFixed(2))
    : 0;

  const totalEstimatedDeductions = Number(
    (estimatedHandlingCost + estimatedTransportCost + additionalCosts).toFixed(2)
  );

  const estimatedNetReturn = Number(
    Math.max(grossValue - totalEstimatedDeductions, 0).toFixed(2)
  );

  const netReturnPerKg = quantityKg > 0
    ? Number((estimatedNetReturn / quantityKg).toFixed(2))
    : 0;

  const netReturnPerQuintal = Number((netReturnPerKg * 100).toFixed(2));

  return {
    grossValue,
    quantityKg,
    pricePerKg,
    estimatedHandlingCost,
    estimatedTransportCost,
    additionalCosts,
    totalEstimatedDeductions,
    estimatedNetReturn,
    netReturnPerKg,
    netReturnPerQuintal,
  };
}

/**
 * Calculates Haversine straight-line distance in km between two lat/lng points
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}
