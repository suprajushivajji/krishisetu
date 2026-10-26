/**
 * Source D: Google Places API Adapter
 *
 * This adapter integrates Google Places API for interactive business discovery.
 * Requires GOOGLE_MAPS_API_KEY to be configured.
 *
 * Usage:
 * - Location-based search for APMCs, agricultural markets, vegetable wholesale markets
 * - Place details retrieval
 * - Business discovery near farmer's location
 *
 * Important: Follow Google Maps Platform terms:
 * - Display Google Places results with required Google Map and attribution
 * - Respect content caching and storage restrictions
 * - Do not build a permanent Google-derived business directory by bulk copying
 * - Store Place IDs where permitted for caching
 */

import axios, { AxiosError } from "axios";
import { config } from "../../config";
import {
  SourceAdapter,
  SourceSyncResult,
  SourceHealth,
  SourceType,
  NormalizedPlaceResult,
} from "./types";

export class GooglePlacesAdapter implements SourceAdapter {
  sourceType: SourceType = "google_places";
  sourceName = "Google Places API";

  private readonly BASE_URL = "https://maps.googleapis.com/maps/api/place";
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY_MS = 1000;
  private readonly TIMEOUT_MS = 15000;

  isConfigured(): boolean {
    return Boolean(config.GOOGLE_MAPS_API_KEY && config.GOOGLE_MAPS_API_KEY.length > 0);
  }

  async sync(): Promise<SourceSyncResult> {
    // Google Places is not a bulk sync source - it's queried on-demand
    return {
      sourceType: this.sourceType,
      sourceName: this.sourceName,
      status: "success",
      recordsFetched: 0,
      recordsInserted: 0,
      recordsSkipped: 0,
      recordsUpdated: 0,
      retrievedAt: new Date(),
      message: "Google Places API is queried on-demand, not bulk synced",
    };
  }

  async searchNearbyPlaces(options: {
    latitude: number;
    longitude: number;
    radiusKm?: number;
    query?: string;
    types?: string[];
  }): Promise<NormalizedPlaceResult[]> {
    if (!this.isConfigured()) {
      throw new Error("GOOGLE_MAPS_API_KEY is not configured");
    }

    const { latitude, longitude, radiusKm = 10, query = "APMC agricultural market", types } = options;
    const radiusMeters = radiusKm * 1000;

    try {
      // Use Places API text search or nearby search
      const response = await this.fetchWithRetry(
        `${this.BASE_URL}/nearbysearch/json`,
        {
          key: config.GOOGLE_MAPS_API_KEY,
          location: `${latitude},${longitude}`,
          radius: radiusMeters,
          keyword: query,
          type: types?.[0] || "establishment",
        }
      );

      if (response.data.status !== "OK") {
        console.warn(`⚠️ [Google Places] API returned status: ${response.data.status}`);
        return [];
      }

      const results = response.data.results || [];
      return results.map((place: any) => this.normalizePlace(place));
    } catch (error: any) {
      console.error("❌ [Google Places Search Error]:", error?.message);
      throw error;
    }
  }

  async getPlaceDetails(placeId: string): Promise<NormalizedPlaceResult | null> {
    if (!this.isConfigured()) {
      throw new Error("GOOGLE_MAPS_API_KEY is not configured");
    }

    try {
      const response = await this.fetchWithRetry(
        `${this.BASE_URL}/details/json`,
        {
          key: config.GOOGLE_MAPS_API_KEY,
          place_id: placeId,
          fields: "place_id,name,formatted_address,geometry,formatted_phone_number,website,url,business_status,types",
        }
      );

      if (response.data.status !== "OK") {
        console.warn(`⚠️ [Google Places Details] API returned status: ${response.data.status}`);
        return null;
      }

      return this.normalizePlace(response.data.result);
    } catch (error: any) {
      console.error("❌ [Google Places Details Error]:", error?.message);
      throw error;
    }
  }

  getHealth(): SourceHealth {
    const isConfigured = this.isConfigured();
    return {
      sourceType: this.sourceType,
      sourceName: this.sourceName,
      isConfigured,
      status: isConfigured ? "healthy" : "unconfigured",
      recordsInDatabase: 0, // Not stored permanently, queried on-demand
    };
  }

  private async fetchWithRetry(url: string, params: any, attempt = 1): Promise<any> {
    try {
      const response = await axios.get(url, {
        params,
        timeout: this.TIMEOUT_MS,
      });

      return response;
    } catch (error: any) {
      if (attempt < this.MAX_RETRIES && this.isRetryableError(error)) {
        console.warn(`⚠️ [Google Places] Retry ${attempt}/${this.MAX_RETRIES} after error: ${error.message}`);
        await this.delay(this.RETRY_DELAY_MS * attempt);
        return this.fetchWithRetry(url, params, attempt + 1);
      }
      throw error;
    }
  }

  private isRetryableError(error: AxiosError): boolean {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") return true;
    if (error.response) {
      const status = error.response.status;
      return status >= 500 || status === 429;
    }
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private normalizePlace(place: any): NormalizedPlaceResult {
    const geometry = place.geometry || {};
    const location = geometry.location || {};
    const latitude = location.lat;
    const longitude = location.lng;

    return {
      sourceType: this.sourceType,
      sourceName: this.sourceName,
      placeId: place.place_id,
      displayName: place.name || "Unknown",
      formattedAddress: place.formatted_address || "",
      location: {
        latitude: latitude || 0,
        longitude: longitude || 0,
      },
      coordinates: [longitude || 0, latitude || 0],
      phone: place.formatted_phone_number || undefined,
      website: place.website || undefined,
      googleMapsUri: place.url || undefined,
      businessStatus: place.business_status || undefined,
      types: place.types || [],
      retrievedAt: new Date(),
    };
  }
}
