import axios from "axios";
import { config } from "../config";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface StructuredToolCall {
  tool_name: string;
  arguments: Record<string, any>;
}

export interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
      tool_calls?: any[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterService {
  private static isConfigured(): boolean {
    return Boolean(config.OPENROUTER_API_KEY && config.OPENROUTER_API_KEY.trim().length > 0);
  }

  /**
   * Make a chat completion request to OpenRouter
   */
  public static async chat(messages: OpenRouterMessage[], tools?: OpenRouterTool[]): Promise<OpenRouterResponse> {
    if (!this.isConfigured()) {
      throw new Error("OPENROUTER_API_KEY is not configured. Set it in server environment.");
    }

    try {
      const payload: any = {
        model: config.OPENROUTER_MODEL,
        messages: messages,
      };

      if (tools && tools.length > 0) {
        payload.tools = tools;
      }

      const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", payload, {
        headers: {
          "Authorization": `Bearer ${config.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": config.CLIENT_URL,
          "X-Title": "KrishiSetu",
        },
        timeout: 30000,
      });

      return response.data;
    } catch (error: any) {
      console.error("❌ [OpenRouter Error]:", error?.response?.data || error?.message);
      throw new Error(
        `OpenRouter request failed: ${error?.response?.data?.error?.message || error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Generate a simple response without tools
   */
  public static async generateResponse(prompt: string, language: string): Promise<string> {
    const systemPrompt = `You are KrishiSetu, an agricultural AI assistant. ${language === "kn-IN" ? "Respond in Kannada." : language === "hi-IN" ? "Respond in Hindi." : "Respond in English."}`;

    const messages: OpenRouterMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ];

    const response = await this.chat(messages);

    return response.choices[0]?.message?.content || "I apologize, but I couldn't generate a response.";
  }

  /**
   * Generate response with structured JSON tool calling
   * Uses JSON approach for models that don't support native tool calling
   */
  public static async generateResponseWithTools(
    prompt: string,
    language: string,
    tools: OpenRouterTool[],
    toolResults?: Record<string, any>
  ): Promise<{ response: string; toolCall?: StructuredToolCall }> {
    const toolDescriptions = tools
      .map(t => `- ${t.name}: ${t.description}`)
      .join("\n");

    const systemPrompt = `You are KrishiSetu, an agricultural AI assistant. ${language === "kn-IN" ? "Respond in Kannada." : language === "hi-IN" ? "Respond in Hindi." : "Respond in English."}

Available tools:
${toolDescriptions}

When you need to use a tool, respond with a JSON object in this format:
{
  "tool_name": "tool_name_here",
  "arguments": {
    "param1": "value1",
    "param2": "value2"
  }
}

If you don't need to use a tool, respond naturally without JSON.`;

    const messages: OpenRouterMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ];

    // If tool results are provided, add them as assistant messages
    if (toolResults) {
      for (const [toolName, result] of Object.entries(toolResults)) {
        messages.push({
          role: "assistant",
          content: `Tool ${toolName} returned: ${JSON.stringify(result)}`,
        });
      }
      messages.push({
        role: "user",
        content: "Based on the tool results, please provide a natural response.",
      });
    }

    const response = await this.chat(messages);
    const content = response.choices[0]?.message?.content || "";

    // Try to parse JSON tool call
    let toolCall: StructuredToolCall | undefined;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.tool_name && parsed.arguments) {
          toolCall = {
            tool_name: parsed.tool_name,
            arguments: parsed.arguments,
          };
        }
      }
    } catch (e) {
      // Not a tool call, just a normal response
    }

    return {
      response: content,
      toolCall,
    };
  }
}
