export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  status?: number;
  [key: string]: any;
}

const API_BASE = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_API_URL is required in production. Set it in Vercel environment variables.");
    }
    console.warn("⚠️ NEXT_PUBLIC_API_URL not set, falling back to localhost (development only)");
    return "http://localhost:4000/api/v1";
  }
  // Normalize URL: remove trailing slash and ensure /api/v1 suffix
  const normalized = url.replace(/\/+$/, "");
  if (!normalized.endsWith("/api/v1")) {
    return `${normalized}/api/v1`;
  }
  return normalized;
})();

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("krishisetu_token");
    }
  }

  public setToken(token: string | null) {
    this.token = token;
    if (typeof window !== "undefined") {
      if (token) {
        localStorage.setItem("krishisetu_token", token);
      } else {
        localStorage.removeItem("krishisetu_token");
      }
    }
  }

  public getToken(): string | null {
    if (!this.token && typeof window !== "undefined") {
      this.token = localStorage.getItem("krishisetu_token");
    }
    return this.token;
  }

  private getHeaders(isMultipart = false): Record<string, string> {
    const headers: Record<string, string> = {};
    if (!isMultipart) {
      headers["Content-Type"] = "application/json";
    }
    const t = this.getToken();
    if (t) {
      headers["Authorization"] = `Bearer ${t}`;
    }
    return headers;
  }

  public async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const url = new URL(`${API_BASE}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") {
          url.searchParams.append(k, String(v));
        }
      });
    }

    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: this.getHeaders(),
        credentials: "include",
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        let message = `HTTP ${res.status}: ${res.statusText}`;
        if (contentType.includes("application/json")) {
          try {
            const errorData = await res.json();
            message = errorData.message || message;
          } catch {
            // Ignore JSON parse errors
          }
        }
        return { success: false, message, status: res.status };
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        return { success: false, message: `Response is not JSON (Content-Type: ${contentType})` };
      }

      return await res.json();
    } catch (err: any) {
      if (err instanceof TypeError && err.message.includes("fetch")) {
        return { success: false, message: "Network error: Backend server may be unreachable. Check NEXT_PUBLIC_API_URL configuration." };
      }
      return { success: false, message: err.message || "Network request failed" };
    }
  }

  public async post<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(body || {}),
        credentials: "include",
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        let message = `HTTP ${res.status}: ${res.statusText}`;
        if (contentType.includes("application/json")) {
          try {
            const errorData = await res.json();
            message = errorData.message || message;
          } catch {
            // Ignore JSON parse errors
          }
        }
        return { success: false, message, status: res.status };
      }

      const payload = await this.readJson(res);
      return payload ?? { success: res.ok, message: res.statusText };
    } catch (err: any) {
      if (err instanceof TypeError && err.message.includes("fetch")) {
        return { success: false, message: "Network error: Backend server may be unreachable. Check NEXT_PUBLIC_API_URL configuration." };
      }
      return { success: false, message: err.message || "Network request failed" };
    }
  }

  public async synthesizeSpeech(body: {
    text: string;
    languageCode?: string;
    voiceGender?: "female" | "male";
  }): Promise<{ success: boolean; audioBlob?: Blob; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/voice/speak`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        credentials: "include",
      });
      const contentType = res.headers.get("content-type") || "";

      if (!res.ok || !contentType.startsWith("audio/")) {
        const payload = await this.readJson(res);
        return {
          success: false,
          message: payload?.message || `Speech service returned HTTP ${res.status}.`,
        };
      }

      return { success: true, audioBlob: await res.blob() };
    } catch (err: any) {
      return { success: false, message: err.message || "Speech request failed" };
    }
  }

  public async patch<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "PATCH",
        headers: this.getHeaders(),
        body: JSON.stringify(body || {}),
        credentials: "include",
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        let message = `HTTP ${res.status}: ${res.statusText}`;
        if (contentType.includes("application/json")) {
          try {
            const errorData = await res.json();
            message = errorData.message || message;
          } catch {
            // Ignore JSON parse errors
          }
        }
        return { success: false, message, status: res.status };
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        return { success: false, message: `Response is not JSON (Content-Type: ${contentType})` };
      }

      return await res.json();
    } catch (err: any) {
      if (err instanceof TypeError && err.message.includes("fetch")) {
        return { success: false, message: "Network error: Backend server may be unreachable. Check NEXT_PUBLIC_API_URL configuration." };
      }
      return { success: false, message: err.message || "Network request failed" };
    }
  }

  public async uploadAudio(audioBlob: Blob, languageCode = "kn"): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.wav");
    formData.append("languageCode", languageCode);
    formData.append("userConsent", "true");

    try {
      const res = await fetch(`${API_BASE}/voice/transcribe`, {
        method: "POST",
        headers: this.getHeaders(true),
        body: formData,
        credentials: "include",
      });
      const payload = await this.readJson(res);
      return payload ?? { success: res.ok, message: res.statusText };
    } catch (err: any) {
      return { success: false, message: err.message || "Upload failed" };
    }
  }

  private async readJson(res: Response): Promise<ApiResponse | null> {
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return null;
    }
    return (await res.json()) as ApiResponse;
  }
}

export const api = new ApiClient();
