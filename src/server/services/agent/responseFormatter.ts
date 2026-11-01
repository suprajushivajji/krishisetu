/**
 * Response Formatter
 * Formats agent responses in the correct language and style
 */

import { IntentResult } from "../intentRouter";
import { ConversationContext } from "./conversationManager";

export class ResponseFormatter {
  private language: "kn-IN" | "hi-IN" | "en-IN";

  constructor(language: "kn-IN" | "hi-IN" | "en-IN") {
    this.language = language;
  }

  /**
   * Format response based on intent, tool result, and context
   */
  async formatResponse(
    intentResult: IntentResult,
    toolResult: any,
    context: ConversationContext
  ): Promise<string> {
    const intent = intentResult.intent;

    // Handle different intents with language-specific responses
    switch (intent) {
      case "crop_price":
        return this.formatPriceResponse(toolResult, context);
      case "nearby_markets":
        return this.formatMarketsResponse(toolResult, context);
      case "buyer_search":
        return this.formatBuyerResponse(toolResult, context);
      case "net_return_calculation":
        return this.formatEarningsResponse(toolResult, context);
      case "clarification_required":
        return this.formatClarification(intentResult, context);
      default:
        return this.formatGeneralResponse(toolResult, context);
    }
  }

  private formatPriceResponse(data: any, context: ConversationContext): string {
    if (!data.found) {
      return this.getResponse("price_not_found", { crop: data.crop });
    }

    if (this.language === "kn-IN") {
      return `${data.market}, ${data.district} ನಲ್ಲಿ ${data.crop} ಮಾದರಿ ದರ ಪ್ರತಿ ಕಿಲೋಗೆ ₹${data.modalPricePerKg}. ${new Date(data.arrivalDate).toLocaleDateString()} ರಂದು ವರದಿ.`;
    } else if (this.language === "hi-IN") {
      return `${data.market}, ${data.district} में ${data.crop} का मॉडल दर ₹${data.modalPricePerKg} प्रति किलोग्राम है। ${new Date(data.arrivalDate).toLocaleDateString()} को रिपोर्ट किया गया।`;
    } else {
      return `${data.crop} is ₹${data.modalPricePerKg} per kg at ${data.market}, ${data.district}. Reported on ${new Date(data.arrivalDate).toLocaleDateString()}.`;
    }
  }

  private formatMarketsResponse(data: any, context: ConversationContext): string {
    if (!data.found) {
      return this.getResponse("markets_not_found");
    }

    if (this.language === "kn-IN") {
      return `${data.count} ಮಾರುಕಟ್ಟೆಗಳು ಲಭ್ಯವಿವೆ. ${data.markets[0]?.name}, ${data.markets[0]?.district}.`;
    } else if (this.language === "hi-IN") {
      return `${data.count} मंडियां उपलब्ध हैं। ${data.markets[0]?.name}, ${data.markets[0]?.district}.`;
    } else {
      return `Found ${data.count} markets. ${data.markets[0]?.name}, ${data.markets[0]?.district}.`;
    }
  }

  private formatBuyerResponse(data: any, context: ConversationContext): string {
    if (!data.found) {
      return this.getResponse("buyers_not_found", { crop: context.currentCrop });
    }

    if (this.language === "kn-IN") {
      return `${data.count} ಖರೀದಿದಾರರು ಲಭ್ಯವಿದ್ದಾರೆ. ${data.buyers[0]?.district} ನಲ್ಲಿ ${data.buyers[0]?.name}.`;
    } else if (this.language === "hi-IN") {
      return `${data.count} खरीदार मिले। ${data.buyers[0]?.district} में ${data.buyers[0]?.name}.`;
    } else {
      return `Found ${data.count} buyers. ${data.buyers[0]?.name} in ${data.buyers[0]?.district}.`;
    }
  }

  private formatEarningsResponse(data: any, context: ConversationContext): string {
    if (!data.found) {
      return this.getResponse("earnings_not_found");
    }

    if (this.language === "kn-IN") {
      return `${data.quantityKg} ಕಿಲೋ ${data.crop}ಗೆ ₹${data.priceData.modalPricePerKg}/kg ದರದಲ್ಲಿ, ಅಂದಾಜು ನಿವ್ವಳ: ₹${data.calculation.estimatedNetReturn}.`;
    } else if (this.language === "hi-IN") {
      return `${data.quantityKg} किलो ${data.crop} के लिए ₹${data.priceData.modalPricePerKg}/kg दर पर, अनुमानित शुद्ध: ₹${data.calculation.estimatedNetReturn}.`;
    } else {
      return `For ${data.quantityKg} kg of ${data.crop} at ₹${data.priceData.modalPricePerKg}/kg, estimated take-home is ₹${data.calculation.estimatedNetReturn}.`;
    }
  }

  private formatClarification(intentResult: IntentResult, context: ConversationContext): string {
    const missingFields = intentResult.missingFields.join(" and ");
    
    if (this.language === "kn-IN") {
      return `ದಯವಿಟ್ಟು ${missingFields} ಅನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ಹೇಳಿ.`;
    } else if (this.language === "hi-IN") {
      return `कृपया ${missingFields} स्पष्ट करें।`;
    } else {
      return `Please specify the ${missingFields}.`;
    }
  }

  private formatGeneralResponse(data: any, context: ConversationContext): string {
    if (this.language === "kn-IN") {
      return "ನಾನು ಬೆಳೆ ದರಗಳು, ಖರೀದಿದಾರರು, ಲಾಭದ ಲೆಕ್ಕಾಚಾರ ಮುಂತಾದವುಗಳಲ್ಲಿ ಸಹಾಯ ಮಾಡಬಹುದು. ದಯವಿಟ್ಟು ನಿರ್ದಿಷ್ಟ ಪ್ರಶ್ನೆ ಕೇಳಿ.";
    } else if (this.language === "hi-IN") {
      return "मैं फसल की कीमतें, खरीदार, लाभ की गणना आदि में मदद कर सकता हूं। कृपया विशिष्ट प्रश्न पूछें।";
    } else {
      return "I can help with crop prices, buyer search, earnings calculation, and more. Please ask a specific question.";
    }
  }

  /**
   * Format error message
   */
  formatError(error: any): string {
    if (this.language === "kn-IN") {
      return "ದೋಷ ಸಂಭವಿಸಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.";
    } else if (this.language === "hi-IN") {
      return "त्रुटि हुई। कृपया पुनः प्रयास करें।";
    } else {
      return "An error occurred. Please try again.";
    }
  }

  /**
   * Get localized response
   */
  private getResponse(key: string, params: any = {}): string {
    const responses: Record<string, Record<string, string>> = {
      price_not_found: {
        "kn-IN": `${params.crop || "ಈ ಬೆಳೆಗೆ"} ದರ ದಾಖಲೆ ಸಿಗಲಿಲ್ಲ.`,
        "hi-IN": `${params.crop || "इस फसल के लिए"} कीमत डेटा नहीं मिला।`,
        "en-IN": `No price record found for ${params.crop || "this crop"}.`,
      },
      markets_not_found: {
        "kn-IN": "ಈ ಪ್ರದೇಶದಲ್ಲಿ ಮಾರುಕಟ್ಟೆಗಳು ಸಿಗಲಿಲ್ಲ.",
        "hi-IN": "इस क्षेत्र में मंडियां नहीं मिलीं।",
        "en-IN": "No markets found in this area.",
      },
      buyers_not_found: {
        "kn-IN": `${params.crop || "ಈ ಬೆಳೆಗೆ"} ನಿಮ್ಮ ಪ್ರದೇಶದಲ್ಲಿ ಸಕ್ರಿಯ ಖರೀದಿದಾರರು ಸಿಗಲಿಲ್ಲ.`,
        "hi-IN": `${params.crop || "इस फसल के लिए"} आपके क्षेत्र में खरीदार नहीं मिले।`,
        "en-IN": `No active buyers found for ${params.crop || "this crop"} in your area.`,
      },
      earnings_not_found: {
        "kn-IN": "ಲೆಕ್ಕ ಮಾಡಲು ದರ ದತ್ತಾಂಶವಿಲ್ಲ.",
        "hi-IN": "गणना के लिए कीमत डेटा नहीं है।",
        "en-IN": "No price data available for calculation.",
      },
    };

    return responses[key]?.[this.language] || responses[key]?.["en-IN"] || key;
  }

  /**
   * Set language
   */
  setLanguage(language: "kn-IN" | "hi-IN" | "en-IN") {
    this.language = language;
  }
}
