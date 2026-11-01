import { ConversationManager, WorkflowState } from "./conversationManager";
import { Business } from "../../models/Business";
import { Appointment } from "../../models/Appointment";
import { OpenRouterService } from "../openrouter";

export interface WorkflowHandlerResponse {
  response: string;
  shouldContinue: boolean;
  workflowComplete: boolean;
  workflowData?: any;
}

export class WorkflowHandler {
  /**
   * Handle business registration workflow
   */
  static async handleBusinessRegistration(
    transcript: string,
    conversationManager: ConversationManager,
    userId?: string
  ): Promise<WorkflowHandlerResponse> {
    const workflow = conversationManager.getWorkflow();
    const context = conversationManager.getContext();

    // Required fields from Business model
    const requiredFields = [
      "businessName",
      "category",
      "contactPerson",
      "phone",
      "address",
      "district",
      "state",
      "cropsPurchased",
    ];

    // Start workflow if not started
    if (workflow.type === "none") {
      conversationManager.startWorkflow("business_registration", requiredFields);
      return {
        response: this.getGreeting(context.language),
        shouldContinue: true,
        workflowComplete: false,
      };
    }

    // If awaiting confirmation
    if (workflow.awaitingConfirmation) {
      if (this.isConfirmation(transcript, context.language)) {
        // Submit registration
        try {
          const business = new Business({
            ownerId: userId,
            ...workflow.collectedFields,
            location: {
              type: "Point",
              coordinates: [77.006, 15.024], // Default coordinates for demo
            },
            consentToPublish: true,
            verificationStatus: "pending",
            isActive: true,
          });

          await business.save();

          conversationManager.completeWorkflow();

          return {
            response: this.getSuccessMessage(context.language, business._id.toString()),
            shouldContinue: true,
            workflowComplete: true,
            workflowData: { businessId: business._id.toString() },
          };
        } catch (error: any) {
          conversationManager.cancelWorkflow();
          return {
            response: this.getErrorMessage(context.language, error.message),
            shouldContinue: true,
            workflowComplete: true,
          };
        }
      } else if (this.isCancellation(transcript, context.language)) {
        conversationManager.cancelWorkflow();
        return {
          response: this.getCancelMessage(context.language),
          shouldContinue: true,
          workflowComplete: true,
        };
      } else {
        return {
          response: this.getConfirmationReminder(context.language),
          shouldContinue: true,
          workflowComplete: false,
        };
      }
    }

    // Collect next missing field
    const nextField = workflow.missingFields[0];
    if (!nextField) {
      // All fields collected, ask for confirmation
      conversationManager.setAwaitingConfirmation(true);
      return {
        response: this.getConfirmationSummary(context.language, workflow.collectedFields),
        shouldContinue: true,
        workflowComplete: false,
      };
    }

    // Extract field value from transcript using LLM or fallback
    const extractedValue = await this.extractFieldValue(transcript, nextField, context.language);
    if (extractedValue) {
      conversationManager.updateWorkflowField(nextField, extractedValue);
      return {
        response: this.getNextQuestion(context.language, workflow.missingFields),
        shouldContinue: true,
        workflowComplete: false,
      };
    }

    return {
      response: this.getRetryMessage(context.language, nextField),
      shouldContinue: true,
      workflowComplete: false,
    };
  }

  /**
   * Handle appointment booking workflow
   */
  static async handleAppointmentBooking(
    transcript: string,
    conversationManager: ConversationManager,
    userId?: string
  ): Promise<WorkflowHandlerResponse> {
    const workflow = conversationManager.getWorkflow();
    const context = conversationManager.getContext();

    const requiredFields = ["businessName", "purpose", "scheduledDate", "scheduledTime"];

    if (workflow.type === "none") {
      conversationManager.startWorkflow("appointment_booking", requiredFields);
      return {
        response: this.getAppointmentGreeting(context.language),
        shouldContinue: true,
        workflowComplete: false,
      };
    }

    if (workflow.awaitingConfirmation) {
      if (this.isConfirmation(transcript, context.language)) {
        try {
          const appointment = new Appointment({
            appointmentId: `apt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            farmerId: userId,
            businessName: workflow.collectedFields.businessName,
            purpose: workflow.collectedFields.purpose,
            scheduledDate: new Date(workflow.collectedFields.scheduledDate),
            scheduledTime: workflow.collectedFields.scheduledTime,
            timezone: "Asia/Kolkata",
            status: "pending",
            contactMethod: "phone",
          });

          await appointment.save();

          conversationManager.completeWorkflow();

          return {
            response: this.getAppointmentSuccessMessage(context.language, appointment.appointmentId),
            shouldContinue: true,
            workflowComplete: true,
            workflowData: { appointmentId: appointment.appointmentId },
          };
        } catch (error: any) {
          conversationManager.cancelWorkflow();
          return {
            response: this.getErrorMessage(context.language, error.message),
            shouldContinue: true,
            workflowComplete: true,
          };
        }
      } else if (this.isCancellation(transcript, context.language)) {
        conversationManager.cancelWorkflow();
        return {
          response: this.getCancelMessage(context.language),
          shouldContinue: true,
          workflowComplete: true,
        };
      } else {
        return {
          response: this.getConfirmationReminder(context.language),
          shouldContinue: true,
          workflowComplete: false,
        };
      }
    }

    const nextField = workflow.missingFields[0];
    if (!nextField) {
      conversationManager.setAwaitingConfirmation(true);
      return {
        response: this.getAppointmentConfirmationSummary(context.language, workflow.collectedFields),
        shouldContinue: true,
        workflowComplete: false,
      };
    }

    const extractedValue = await this.extractFieldValue(transcript, nextField, context.language);
    
    // Validate date/time fields
    if (nextField === "scheduledDate") {
      const validationResult = this.validateDate(extractedValue);
      if (!validationResult.valid) {
        return {
          response: validationResult.message || this.getRetryMessage(context.language, nextField),
          shouldContinue: true,
          workflowComplete: false,
        };
      }
    }
    
    if (nextField === "scheduledTime") {
      const validationResult = this.validateTime(extractedValue);
      if (!validationResult.valid) {
        return {
          response: validationResult.message || this.getRetryMessage(context.language, nextField),
          shouldContinue: true,
          workflowComplete: false,
        };
      }
    }
    
    if (extractedValue) {
      conversationManager.updateWorkflowField(nextField, extractedValue);
      return {
        response: this.getAppointmentNextQuestion(context.language, workflow.missingFields),
        shouldContinue: true,
        workflowComplete: false,
      };
    }

    return {
      response: this.getRetryMessage(context.language, nextField),
      shouldContinue: true,
      workflowComplete: false,
    };
  }

  // Helper methods
  private static getGreeting(language: string): string {
    if (language === "kn-IN") return "ಹಲೋ! ನಾನು ನಿಮ್ಮ ವ್ಯಾಪಾರ ನೋಂದಣಿಗೆ ಸಹಾಯ ಮಾಡಲಿದ್ದೇನೆ. ನಿಮ್ಮ ವ್ಯಾಪಾರದ ಹೆಸರು ಏನು?";
    if (language === "hi-IN") return "नमस्ते! मैं आपके व्यवसाय पंजीकरण में मदद करूंगा। आपके व्यवसाय का नाम क्या है?";
    return "Hello! I'll help you register your business. What is your business name?";
  }

  private static getNextQuestion(language: string, missingFields: string[]): string {
    const nextField = missingFields[0];
    const questions: Record<string, Record<string, string>> = {
      category: {
        "kn-IN": "ನಿಮ್ಮ ವ್ಯಾಪಾರದ ವರ್ಗ ಏನು? (ಉದಾ: wholesaler, retailer, distributor)",
        "hi-IN": "आपके व्यवसाय की श्रेणी क्या है? (जैसे: wholesaler, retailer, distributor)",
        "en-IN": "What is your business category? (e.g., wholesaler, retailer, distributor)",
      },
      contactPerson: {
        "kn-IN": "ಸಂಪರ್ಕ ವ್ಯಕ್ತಿಯ ಹೆಸರು ಏನು?",
        "hi-IN": "संपर्क व्यक्ति का नाम क्या है?",
        "en-IN": "What is the contact person's name?",
      },
      phone: {
        "kn-IN": "ದೂರವಾಣಿ ಸಂಖ್ಯೆ ಏನು?",
        "hi-IN": "फोन नंबर क्या है?",
        "en-IN": "What is the phone number?",
      },
      address: {
        "kn-IN": "ವಿಳಾಸ ಏನು?",
        "hi-IN": "पता क्या है?",
        "en-IN": "What is the address?",
      },
      district: {
        "kn-IN": "ಜಿಲ್ಲೆ ಏನು?",
        "hi-IN": "जिला क्या है?",
        "en-IN": "What is the district?",
      },
      state: {
        "kn-IN": "ರಾಜ್ಯ ಏನು?",
        "hi-IN": "राज्य क्या है?",
        "en-IN": "What is the state?",
      },
      cropsPurchased: {
        "kn-IN": "ಯಾವ ಬೆಳೆಗಳನ್ನು ಖರೀದಿಸುತ್ತೀರಿ?",
        "hi-IN": "आप कौन सी फसलें खरीदते हैं?",
        "en-IN": "Which crops do you purchase?",
      },
    };

    return questions[nextField]?.[language] || `Please provide ${nextField}`;
  }

  private static getConfirmationSummary(language: string, fields: Record<string, any>): string {
    const summary = Object.entries(fields)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    
    if (language === "kn-IN") return `ನಿಮ್ಮ ವಿವರಗಳು: ${summary}. ದಯವಿಟ್ಟು ದೃಢೀಕರಿಸಿ.`;
    if (language === "hi-IN") return `आपके विवरण: ${summary}. कृपया पुष्टि करें।`;
    return `Your details: ${summary}. Please confirm.`;
  }

  private static getSuccessMessage(language: string, id: string): string {
    if (language === "kn-IN") return `ನೋಂದಣಿ ಯಶಸ್ವಿಯಾಗಿದೆ. ID: ${id}. ಪರಿಶೀಲನೆ ಬಾಕಿ ಇದೆ.`;
    if (language === "hi-IN") return `पंजीकरण सफल हो गया। ID: ${id}. सत्यापन लंबित है।`;
    return `Registration successful. ID: ${id}. Verification is pending.`;
  }

  private static getErrorMessage(language: string, error: string): string {
    if (language === "kn-IN") return `ದೋಷ: ${error}. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.`;
    if (language === "hi-IN") return `त्रुटि: ${error}. कृपया पुनः प्रयास करें।`;
    return `Error: ${error}. Please try again.`;
  }

  private static getCancelMessage(language: string): string {
    if (language === "kn-IN") return "ನೋಂದಣಿ ರದ್ದುಗೊಳಿಸಲಾಗಿದೆ.";
    if (language === "hi-IN") return "पंजीकरण रद्द कर दिया गया।";
    return "Registration cancelled.";
  }

  private static getConfirmationReminder(language: string): string {
    if (language === "kn-IN") return "ದಯವಿಟ್ಟು 'ಹೌದು' ಅಥವಾ 'ಇಲ್ಲ' ಎಂದು ಹೇಳಿ.";
    if (language === "hi-IN") return "कृपया 'हां' या 'नहीं' कहें।";
    return "Please say 'yes' or 'no'.";
  }

  private static getRetryMessage(language: string, field: string): string {
    if (language === "kn-IN") return `ದಯವಿಟ್ಟು ${field} ಅನ್ನು ಪುನಃ ಒದಗಿಸಿ.`;
    if (language === "hi-IN") return `कृपया ${field} पुनः प्रदान करें।`;
    return `Please provide ${field} again.`;
  }

  private static isConfirmation(transcript: string, language: string): boolean {
    const yesWords = ["yes", "yeah", "confirm", "haan", "ha", "ಹೌದು", "ಹಾ", "सही"];
    return yesWords.some(word => transcript.toLowerCase().includes(word));
  }

  private static isCancellation(transcript: string, language: string): boolean {
    const noWords = ["no", "cancel", "nahi", "na", "ಇಲ್ಲ", "ನಹಿ", "नहीं"];
    return noWords.some(word => transcript.toLowerCase().includes(word));
  }

  private static async extractFieldValue(transcript: string, field: string, language: string): Promise<string> {
    // Try to use LLM for extraction
    try {
      const prompt = `Extract the value for field "${field}" from this user message: "${transcript}". ${language === "kn-IN" ? "Respond in Kannada." : language === "hi-IN" ? "Respond in Hindi." : "Respond in English."} Return only the extracted value, nothing else.`;
      
      const response = await OpenRouterService.generateResponse(prompt, language);
      
      // Clean up the response
      const cleaned = response.trim().replace(/["']/g, "").replace(/^The .* is /i, "").replace(/^.*: /i, "");
      
      return cleaned || transcript;
    } catch (error) {
      // Fallback to returning the transcript
      console.warn("LLM extraction failed, using fallback:", error);
      return transcript;
    }
  }

  private static getAppointmentGreeting(language: string): string {
    if (language === "kn-IN") return "ನಾನು ನಿಮಗೆ ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಬುಕ್ ಮಾಡಲು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ. ಯಾವ ವ್ಯಾಪಾರಿಯೊಂದಿಗೆ ಭೇಟಿ ಬೇಕು?";
    if (language === "hi-IN") return "मैं आपके लिए अपॉइंटमेंट बुक करने में मदद करूंगा। किस व्यापारी से मिलना है?";
    return "I'll help you book an appointment. Which business do you want to meet?";
  }

  private static getAppointmentNextQuestion(language: string, missingFields: string[]): string {
    const nextField = missingFields[0];
    const questions: Record<string, Record<string, string>> = {
      purpose: {
        "kn-IN": "ಭೇಟಿಯ ಉದ್ದೇಶ ಏನು?",
        "hi-IN": "मुलाकात का उद्देश्य क्या है?",
        "en-IN": "What is the purpose of the meeting?",
      },
      scheduledDate: {
        "kn-IN": "ಯಾವ ದಿನಾಂಕ?",
        "hi-IN": "कौन सी तारीख?",
        "en-IN": "What date?",
      },
      scheduledTime: {
        "kn-IN": "ಯಾವ ಸಮಯ?",
        "hi-IN": "कौन सा समय?",
        "en-IN": "What time?",
      },
    };

    return questions[nextField]?.[language] || `Please provide ${nextField}`;
  }

  private static getAppointmentConfirmationSummary(language: string, fields: Record<string, any>): string {
    const summary = Object.entries(fields)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    
    if (language === "kn-IN") return `ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ವಿವರಗಳು: ${summary}. ದೃಢೀಕರಿಸಿ.`;
    if (language === "hi-IN") return `अपॉइंटमेंट विवरण: ${summary}. पुष्टि करें।`;
    return `Appointment details: ${summary}. Please confirm.`;
  }

  private static getAppointmentSuccessMessage(language: string, id: string): string {
    if (language === "kn-IN") return `ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಬುಕ್ ಆಗಿದೆ. ID: ${id}. ಸ್ಥಿತಿ: ಬಾಕಿ.`;
    if (language === "hi-IN") return `अपॉइंटमेंट बुक हो गया। ID: ${id}. स्थिति: लंबित।`;
    return `Appointment booked. ID: ${id}. Status: pending.`;
  }

  private static validateDate(dateStr: string): { valid: boolean; message?: string } {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      
      if (isNaN(date.getTime())) {
        return { valid: false, message: "Invalid date format. Please provide a valid date." };
      }
      
      if (date < now) {
        return { valid: false, message: "Cannot book appointments in the past. Please provide a future date." };
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, message: "Invalid date. Please try again." };
    }
  }

  private static validateTime(timeStr: string): { valid: boolean; message?: string } {
    try {
      // Simple validation for HH:MM format
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(timeStr)) {
        return { valid: false, message: "Invalid time format. Please use HH:MM format (e.g., 14:30)." };
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, message: "Invalid time. Please try again." };
    }
  }
}
