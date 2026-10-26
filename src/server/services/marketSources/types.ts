/**
 * Multi-source Mandi, APMC and Buyer Discovery System
 * Common types and interfaces for all source adapters
 */

export type SourceType = "data_gov_in" | "agmarknet" | "apmc_directory" | "google_places" | "krishisetu_buyers";

export type RecordType = "price_observation" | "market_directory" | "place_result" | "buyer_offer";

export type VerificationState = "official" | "verified_source" | "public_listing" | "registered" | "pending" | "unverified";

export interface SourceSyncResult {
  sourceType: SourceType;
  sourceName: string;
  status: "success" | "unconfigured" | "failed" | "partial";
  recordsFetched: number;
  recordsInserted: number;
  recordsSkipped: number;
  recordsUpdated: number;
  retrievedAt: Date;
  sourceDate?: Date;
  message?: string;
  errorDetails?: string;
}

export interface SourceHealth {
  sourceType: SourceType;
  sourceName: string;
  isConfigured: boolean;
  lastSyncAt?: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  lastError?: string;
  recordsInDatabase: number;
  mostRecentRecordDate?: Date;
  status: "healthy" | "stale" | "error" | "unconfigured";
}

export interface NormalizedPriceObservation {
  sourceType: SourceType;
  sourceName: string;
  sourceRecordId?: string;
  sourceUrl?: string;
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  grade: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  originalUnit: string;
  modalPricePerKg: number;
  arrivalDate: Date;
  reportedDate?: Date;
  retrievedAt: Date;
  verificationState: VerificationState;
  isStale: boolean;
}

export interface NormalizedMarketDirectory {
  sourceType: SourceType;
  sourceName: string;
  sourceRecordId?: string;
  sourceUrl?: string;
  marketName: string;
  officialIdentifier?: string;
  state: string;
  district: string;
  taluk?: string;
  locality?: string;
  fullAddress?: string;
  phone?: string;
  email?: string;
  website?: string;
  marketType?: string;
  openingHours?: string;
  latitude?: number;
  longitude?: number;
  coordinates?: [number, number]; // [longitude, latitude]
  coordinateProvenance?: string;
  coordinateResolutionStatus?: "verified" | "approximate" | "unknown";
  lastVerifiedDate?: Date;
  verificationState: VerificationState;
  retrievedAt: Date;
}

export interface NormalizedPlaceResult {
  sourceType: SourceType;
  sourceName: string;
  placeId: string;
  displayName: string;
  formattedAddress: string;
  location: {
    latitude: number;
    longitude: number;
  };
  coordinates: [number, number]; // [longitude, latitude]
  phone?: string;
  website?: string;
  googleMapsUri?: string;
  businessStatus?: string;
  types?: string[];
  retrievedAt: Date;
}

export interface SourceAdapter {
  sourceType: SourceType;
  sourceName: string;
  isConfigured(): boolean;
  sync(options?: any): Promise<SourceSyncResult>;
  getHealth(): SourceHealth;
}
