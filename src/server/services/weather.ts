/**
 * Weather Service using Open-Meteo API
 * Free, no API key required
 */

import axios from "axios";

export interface WeatherForecast {
  location: string;
  latitude: number;
  longitude: number;
  current: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    weatherCode: number;
    description: string;
  };
  daily: Array<{
    date: string;
    maxTemp: number;
    minTemp: number;
    precipitation: number;
    weatherCode: number;
    description: string;
  }>;
}

export class WeatherService {
  private static readonly BASE_URL = "https://api.open-meteo.com/v1";

  /**
   * Get weather forecast for a location
   */
  static async getForecast(latitude: number, longitude: number, days: number = 7): Promise<WeatherForecast> {
    try {
      const response = await axios.get(`${this.BASE_URL}/forecast`, {
        params: {
          latitude,
          longitude,
          daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode",
          current: "temperature_2m,relative_humidity_2m,wind_speed_10m,weathercode",
          timezone: "auto",
          forecast_days: days,
        },
        timeout: 10000,
      });

      const data = response.data;

      const current = {
        temperature: data.current.temperature_2m,
        humidity: data.current.relative_humidity_2m,
        windSpeed: data.current.wind_speed_10m,
        weatherCode: data.current.weathercode,
        description: this.getWeatherDescription(data.current.weathercode),
      };

      const daily = data.daily.time.map((date: string, index: number) => ({
        date,
        maxTemp: data.daily.temperature_2m_max[index],
        minTemp: data.daily.temperature_2m_min[index],
        precipitation: data.daily.precipitation_sum[index],
        weatherCode: data.daily.weathercode[index],
        description: this.getWeatherDescription(data.daily.weathercode[index]),
      }));

      return {
        location: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
        latitude,
        longitude,
        current,
        daily,
      };
    } catch (error: any) {
      console.error("❌ Weather service error:", error?.message);
      throw new Error(`Failed to fetch weather data: ${error?.message}`);
    }
  }

  /**
   * Get weather forecast by district name (requires geocoding)
   */
  static async getForecastByDistrict(district: string, state: string = "Karnataka"): Promise<WeatherForecast> {
    // Known district coordinates for Karnataka
    const districtCoordinates: Record<string, [number, number]> = {
      bengaluru: [12.9716, 77.5946],
      davanagere: [14.4644, 75.9218],
      mysuru: [12.2958, 76.6394],
      hubballi: [15.3647, 75.124],
      belagavi: [15.8497, 74.4977],
      mangaluru: [12.8765, 74.8856],
      shivamogga: [13.9299, 75.5681],
      kalaburagi: [17.3231, 76.843],
    };

    const coords = districtCoordinates[district.toLowerCase()];
    if (!coords) {
      throw new Error(`Coordinates not found for district: ${district}`);
    }

    return this.getForecast(coords[0], coords[1]);
  }

  /**
   * Convert WMO weather code to description
   */
  private static getWeatherDescription(code: number): string {
    const codes: Record<number, string> = {
      0: "Clear sky",
      1: "Mainly clear",
      2: "Partly cloudy",
      3: "Overcast",
      45: "Fog",
      48: "Depositing rime fog",
      51: "Light drizzle",
      53: "Moderate drizzle",
      55: "Dense drizzle",
      61: "Slight rain",
      63: "Moderate rain",
      65: "Heavy rain",
      71: "Slight snow",
      73: "Moderate snow",
      75: "Heavy snow",
      80: "Slight rain showers",
      81: "Moderate rain showers",
      82: "Violent rain showers",
      95: "Thunderstorm",
      96: "Thunderstorm with hail",
      99: "Thunderstorm with heavy hail",
    };

    return codes[code] || "Unknown";
  }
}
