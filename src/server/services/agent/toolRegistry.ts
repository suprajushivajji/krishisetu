/**
 * Tool Registry
 * Manages available tools for the agent and executes them
 */

import { MarketPrice } from "../../models/MarketPrice";
import { Market } from "../../models/Market";
import { Business } from "../../models/Business";
import { BuyerOffer } from "../../models/BuyerOffer";
import { calculateNetReturn } from "../../utils/calculator";
import { IntentResult } from "../intentRouter";
import { ConversationContext } from "./conversationManager";

export interface Tool {
  name: string;
  description: string;
  execute: (params: any, context: ConversationContext) => Promise<any>;
}

export class ToolRegistry {
  private tools: Map<string, Tool>;

  constructor() {
    this.tools = new Map();
    this.registerCoreTools();
  }

  private registerCoreTools() {
    // Crop Price Lookup
    this.tools.set("crop_price", {
      name: "crop_price",
      description: "Get current crop prices from markets",
      execute: async (params: any, context: ConversationContext) => {
        const crop = params.crop || context.currentCrop;
        const district = params.district || context.district;
        
        if (!crop) {
          return { found: false, message: "Please specify which crop you want to check" };
        }

        const price = await MarketPrice.findOne({
          commodity: crop,
          district: district || "Davanagere",
        }).sort({ arrivalDate: -1 });

        if (!price) {
          return { found: false, message: `No price data found for ${crop}` };
        }

        return {
          found: true,
          crop: price.commodity,
          market: price.market,
          district: price.district,
          modalPricePerKg: price.modalPrice,
          minPricePerKg: price.minPrice,
          maxPricePerKg: price.maxPrice,
          arrivalDate: price.arrivalDate,
        };
      },
    });

    // Nearby Markets
    this.tools.set("nearby_markets", {
      name: "nearby_markets",
      description: "Find nearby APMC markets",
      execute: async (params: any, context: ConversationContext) => {
        const district = params.district || context.district;
        
        const markets = await Market.find({
          district: district || "Davanagere",
        }).limit(10);

        if (markets.length === 0) {
          return { found: false, message: "No markets found in this district" };
        }

        return {
          found: true,
          count: markets.length,
          markets: markets.map((m: any) => ({
            name: m.marketName,
            district: m.district,
            address: m.address,
            phone: m.contactPhone,
          })),
        };
      },
    });

    // Buyer Search
    this.tools.set("buyer_search", {
      name: "buyer_search",
      description: "Find registered buyers for a crop",
      execute: async (params: any, context: ConversationContext) => {
        const crop = params.crop || context.currentCrop;
        const district = params.district || context.district;
        
        if (!crop) {
          return { found: false, message: "Please specify which crop" };
        }

        const businesses = await Business.find({
          categories: { $in: [crop] },
          district: district || "Davanagere",
        }).limit(10);

        if (businesses.length === 0) {
          return { found: false, message: `No buyers found for ${crop} in this area` };
        }

        return {
          found: true,
          count: businesses.length,
          buyers: businesses.map((b: any) => ({
            name: b.businessName,
            district: b.district,
            phone: b.contactPhone,
            verified: b.verified,
          })),
        };
      },
    });

    // Net Return Calculation
    this.tools.set("net_return_calculation", {
      name: "net_return_calculation",
      description: "Calculate estimated net return for a crop",
      execute: async (params: any, context: ConversationContext) => {
        const crop = params.crop || context.currentCrop;
        const quantity = params.quantity || 100; // default 100 kg
        const district = params.district || context.district;

        if (!crop) {
          return { found: false, message: "Please specify which crop" };
        }

        const price = await MarketPrice.findOne({
          commodity: crop,
          district: district || "Davanagere",
        }).sort({ arrivalDate: -1 });

        if (!price) {
          return { found: false, message: `No price data available for ${crop}` };
        }

        const calculation = calculateNetReturn({
          pricePerKg: price.modalPrice,
          quantityKg: quantity,
        });

        return {
          found: true,
          crop,
          quantityKg: quantity,
          priceData: {
            modalPricePerKg: price.modalPrice,
            market: price.market,
          },
          calculation,
        };
      },
    });

    // General Question
    this.tools.set("general_agriculture_question", {
      name: "general_agriculture_question",
      description: "Handle general agricultural questions",
      execute: async (params: any, context: ConversationContext) => {
        return {
          found: true,
          message: "I can help with crop prices, buyer search, earnings calculation, and more. Please ask a specific question.",
        };
      },
    });
  }

  /**
   * Execute a tool based on intent
   */
  async execute(intentResult: IntentResult, context: ConversationContext): Promise<any> {
    const toolName = this.mapIntentToTool(intentResult.intent);
    const tool = this.tools.get(toolName);

    if (!tool) {
      return {
        found: false,
        message: `I'm not sure how to help with that. Please try asking about crop prices, buyers, or earnings.`,
      };
    }

    try {
      const params = {
        crop: intentResult.crop,
        district: intentResult.district,
        quantity: intentResult.quantity,
        distance: intentResult.distance,
        market: intentResult.market,
      };

      return await tool.execute(params, context);
    } catch (error: any) {
      console.error(`Tool execution error for ${toolName}:`, error);
      return {
        found: false,
        message: "Sorry, I encountered an error while processing your request. Please try again.",
      };
    }
  }

  /**
   * Map intent to tool name
   */
  private mapIntentToTool(intent: string): string {
    const mapping: Record<string, string> = {
      crop_price: "crop_price",
      market_comparison: "crop_price",
      nearby_markets: "nearby_markets",
      buyer_search: "buyer_search",
      buyer_contact: "buyer_search",
      net_return_calculation: "net_return_calculation",
      general_agriculture_question: "general_agriculture_question",
      clarification_required: "general_agriculture_question",
    };

    return mapping[intent] || "general_agriculture_question";
  }

  /**
   * Get available tools
   */
  getAvailableTools(): Tool[] {
    return Array.from(this.tools.values());
  }
}
