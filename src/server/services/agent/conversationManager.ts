/**
 * Conversation Manager
 * Manages conversation state, context, and history
 */

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  language?: string;
}

export interface ConversationContext {
  language: "kn-IN" | "hi-IN" | "en-IN";
  district?: string;
  state?: string;
  userId?: string;
  sessionId?: string;
  currentCrop?: string;
  currentMarket?: string;
  currentBuyer?: string;
  lastIntent?: string;
  lastToolResult?: any;
  pendingConfirmation?: any;
}

export type WorkflowType = "business_registration" | "appointment_booking" | "none";

export interface WorkflowState {
  type: WorkflowType;
  step: number;
  collectedFields: Record<string, any>;
  missingFields: string[];
  awaitingConfirmation: boolean;
}

export class ConversationManager {
  private history: ConversationMessage[] = [];
  private context: ConversationContext;
  private workflow: WorkflowState;

  constructor(config: Partial<ConversationContext>) {
    this.context = {
      language: config.language || "kn-IN",
      district: config.district,
      state: config.state || "Karnataka",
      userId: config.userId,
      sessionId: config.sessionId,
    };
    this.workflow = {
      type: "none",
      step: 0,
      collectedFields: {},
      missingFields: [],
      awaitingConfirmation: false,
    };
  }

  /**
   * Add a message to the conversation history
   */
  addMessage(role: "user" | "assistant" | "system", content: string, language?: string) {
    this.history.push({
      role,
      content,
      timestamp: new Date(),
      language: language || this.context.language,
    });
  }

  /**
   * Get conversation history
   */
  getHistory(): ConversationMessage[] {
    return this.history;
  }

  /**
   * Get recent messages (last N messages)
   */
  getRecentMessages(count: number = 5): ConversationMessage[] {
    return this.history.slice(-count);
  }

  /**
   * Get current context
   */
  getContext(): ConversationContext {
    return { ...this.context };
  }

  /**
   * Update context
   */
  updateContext(updates: Partial<ConversationContext>) {
    this.context = { ...this.context, ...updates };
  }

  /**
   * Set language
   */
  setLanguage(language: "kn-IN" | "hi-IN" | "en-IN") {
    this.context.language = language;
  }

  /**
   * Clear conversation history
   */
  clear() {
    this.history = [];
    this.context = {
      language: this.context.language,
      state: "Karnataka",
    };
  }

  /**
   * Get conversation summary
   */
  getSummary(): string {
    const userMessages = this.history.filter(m => m.role === "user");
    const assistantMessages = this.history.filter(m => m.role === "assistant");
    
    return `Session with ${userMessages.length} user messages and ${assistantMessages.length} assistant responses in ${this.context.language}`;
  }

  /**
   * Start a workflow
   */
  startWorkflow(type: WorkflowType, missingFields: string[]): void {
    this.workflow = {
      type,
      step: 0,
      collectedFields: {},
      missingFields,
      awaitingConfirmation: false,
    };
  }

  /**
   * Get the current workflow
   */
  getWorkflow(): WorkflowState {
    return { ...this.workflow };
  }

  /**
   * Update workflow field
   */
  updateWorkflowField(field: string, value: any): void {
    this.workflow.collectedFields[field] = value;
    this.workflow.missingFields = this.workflow.missingFields.filter(f => f !== field);
    this.workflow.step++;
  }

  /**
   * Set awaiting confirmation
   */
  setAwaitingConfirmation(value: boolean): void {
    this.workflow.awaitingConfirmation = value;
  }

  /**
   * Complete workflow
   */
  completeWorkflow(): void {
    this.workflow = {
      type: "none",
      step: 0,
      collectedFields: {},
      missingFields: [],
      awaitingConfirmation: false,
    };
  }

  /**
   * Cancel workflow
   */
  cancelWorkflow(): void {
    this.completeWorkflow();
  }
}
