/**
 * Shared Voice Agent Orchestrator
 * Centralizes voice agent logic for both in-app assistant and call interface
 */

import { GnaniService } from "../gnani";
import { IntentRouter } from "../intentRouter";
import { ConversationManager } from "./conversationManager";
import { ToolRegistry } from "./toolRegistry";
import { ResponseFormatter } from "./responseFormatter";
import { OpenRouterService } from "../openrouter";
import { WorkflowHandler } from "./workflowHandler";

export interface AgentConfig {
  language: "kn-IN" | "hi-IN" | "en-IN";
  district?: string;
  state?: string;
  userId?: string;
  sessionId?: string;
}

export interface AgentResponse {
  text: string;
  audioBuffer?: Buffer;
  intent?: string;
  data?: any;
  shouldContinue: boolean;
  requiresConfirmation?: boolean;
  confirmationDetails?: any;
}

export class AgentOrchestrator {
  private conversationManager: ConversationManager;
  private toolRegistry: ToolRegistry;
  private responseFormatter: ResponseFormatter;

  constructor(config: AgentConfig) {
    this.conversationManager = new ConversationManager(config);
    this.toolRegistry = new ToolRegistry();
    this.responseFormatter = new ResponseFormatter(config.language);
  }

  /**
   * Process user input and generate agent response
   */
  async processUserInput(transcript: string, audioContext?: any): Promise<AgentResponse> {
    try {
      // 1. Add user message to conversation
      this.conversationManager.addMessage("user", transcript);

      // 2. Check for active workflow
      const workflow = this.conversationManager.getWorkflow();
      const context = this.conversationManager.getContext();

      if (workflow.type === "business_registration") {
        const workflowResponse = await WorkflowHandler.handleBusinessRegistration(
          transcript,
          this.conversationManager,
          context.userId
        );
        
        this.conversationManager.addMessage("assistant", workflowResponse.response);
        
        return {
          text: workflowResponse.response,
          shouldContinue: workflowResponse.shouldContinue,
          data: workflowResponse.workflowData,
        };
      }

      if (workflow.type === "appointment_booking") {
        const workflowResponse = await WorkflowHandler.handleAppointmentBooking(
          transcript,
          this.conversationManager,
          context.userId
        );
        
        this.conversationManager.addMessage("assistant", workflowResponse.response);
        
        return {
          text: workflowResponse.response,
          shouldContinue: workflowResponse.shouldContinue,
          data: workflowResponse.workflowData,
        };
      }

      // 3. Detect workflow intents
      const lowerTranscript = transcript.toLowerCase();
      if (this.isRegistrationIntent(lowerTranscript)) {
        const workflowResponse = await WorkflowHandler.handleBusinessRegistration(
          transcript,
          this.conversationManager,
          context.userId
        );
        
        this.conversationManager.addMessage("assistant", workflowResponse.response);
        
        return {
          text: workflowResponse.response,
          shouldContinue: workflowResponse.shouldContinue,
          data: workflowResponse.workflowData,
        };
      }

      if (this.isAppointmentIntent(lowerTranscript)) {
        const workflowResponse = await WorkflowHandler.handleAppointmentBooking(
          transcript,
          this.conversationManager,
          context.userId
        );
        
        this.conversationManager.addMessage("assistant", workflowResponse.response);
        
        return {
          text: workflowResponse.response,
          shouldContinue: workflowResponse.shouldContinue,
          data: workflowResponse.workflowData,
        };
      }

      // 4. Use OpenRouter for intelligent response with tool calling
      const tools = this.toolRegistry.getAvailableTools().map(t => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: "object",
          properties: {
            transcript: { type: "string" },
            district: { type: "string" },
            state: { type: "string" },
          },
        },
      }));

      const prompt = `User said: "${transcript}". Current context: ${JSON.stringify(context)}. Help the user by selecting appropriate tools if needed.`;
      
      let responseText: string;
      let toolResult: any;

      try {
        const llmResponse = await OpenRouterService.generateResponseWithTools(
          prompt,
          context.language,
          tools
        );

        responseText = llmResponse.response;

        // Execute tool call if present
        if (llmResponse.toolCall) {
          const toolName = llmResponse.toolCall.tool_name;
          const toolArgs = llmResponse.toolCall.arguments;
          
          // Validate tool is allowed
          const allowedTool = this.toolRegistry.getAvailableTools().find(t => t.name === toolName);
          if (!allowedTool) {
            throw new Error(`Tool ${toolName} is not allowed`);
          }
          
          // Execute the tool
          const result = await this.toolRegistry.execute(
            { 
              intent: toolName as any, 
              confidence: 1, 
              missingFields: [],
              crop: toolArgs.crop,
              district: toolArgs.district,
              state: toolArgs.state,
              ...toolArgs 
            },
            context
          );
          
          toolResult = result;

          // Generate final response with tool results
          const finalResponse = await OpenRouterService.generateResponseWithTools(
            `Tool results: ${JSON.stringify(result)}. Please explain the results naturally.`,
            context.language,
            [],
            { [toolName]: result }
          );
          
          responseText = finalResponse.response;
        }
      } catch (llmError) {
        console.warn("LLM failed, falling back to intent router:", llmError);
        
        // Fallback to intent router
        const intentResult = await IntentRouter.classify(
          transcript,
          context.district || "Davanagere",
          context.state || "Karnataka"
        );

        toolResult = await this.toolRegistry.execute(intentResult, context);

        responseText = await this.responseFormatter.formatResponse(
          intentResult,
          toolResult,
          context
        );
      }

      // 5. Add assistant message to conversation
      this.conversationManager.addMessage("assistant", responseText);

      // 6. Generate audio using Gnani TTS
      let audioBuffer: Buffer | undefined;
      try {
        const audioResult = await GnaniService.synthesize({
          text: responseText,
          languageCode: context.language,
        });
        audioBuffer = audioResult.audioBuffer;
      } catch (err) {
        console.warn("TTS failed, will use browser fallback:", err);
      }

      return {
        text: responseText,
        audioBuffer,
        data: toolResult,
        shouldContinue: true,
      };
    } catch (error: any) {
      console.error("Agent orchestration error:", error);
      
      const errorResponse = this.responseFormatter.formatError(error);
      this.conversationManager.addMessage("assistant", errorResponse);

      return {
        text: errorResponse,
        shouldContinue: true,
      };
    }
  }

  /**
   * Detect business registration intent
   */
  private isRegistrationIntent(transcript: string): boolean {
    const keywords = [
      "register",
      "registration",
      "sign up",
      "create business",
      "add business",
      "register business",
      "ನೋಂದಣಿ",
      "ನೋಂದಾವಣಿ",
      "पंजीकरण",
      "रजिस्टर",
    ];
    return keywords.some(keyword => transcript.includes(keyword));
  }

  /**
   * Detect appointment booking intent
   */
  private isAppointmentIntent(transcript: string): boolean {
    const keywords = [
      "appointment",
      "book",
      "schedule",
      "meeting",
      "visit",
      "meet",
      "ಅಪಾಯಿಂಟ್ಮೆಂಟ್",
      "ಭೇಟಿ",
      "मुलाकात",
      "अपॉइंटमेंट",
    ];
    return keywords.some(keyword => transcript.includes(keyword));
  }

  /**
   * Get conversation history
   */
  getConversationHistory() {
    return this.conversationManager.getHistory();
  }

  /**
   * Get current context
   */
  getContext() {
    return this.conversationManager.getContext();
  }

  /**
   * Clear conversation
   */
  clearConversation() {
    this.conversationManager.clear();
  }

  /**
   * End session and save to database
   */
  async endSession() {
    const history = this.conversationManager.getHistory();
    const context = this.conversationManager.getContext();
    
    // TODO: Save to ConversationSession model
    console.log("Session ended. Messages:", history.length);
    
    return {
      messageCount: history.length,
      context,
    };
  }
}
