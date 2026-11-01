/**
 * Localization + deterministic alias tables for the voice-driven
 * business registration flow (Kannada / Hindi / English).
 *
 * Shared by client (questions, read-back) and server (extraction fallback,
 * value normalization). Contains NO browser/node-only code.
 */

import type { RegistrationLanguage } from "./registrationSchema";
import { CATEGORIES, DISTRICTS_KARNATAKA } from "./registrationSchema";

export type LocalizedText = Record<RegistrationLanguage, string>;

/** Spoken question for each registration field, per language. */
export const FIELD_QUESTIONS: Record<string, LocalizedText> = {
  businessName: {
    "en-IN": "What is your business name?",
    "kn-IN": "ನಿಮ್ಮ ವ್ಯಾಪಾರದ ಹೆಸರೇನು?",
    "hi-IN": "आपके व्यवसाय का नाम क्या है?",
  },
  category: {
    "en-IN": "What is your business category? For example: wholesale trader, retailer, distributor, exporter, or FPO.",
    "kn-IN": "ನಿಮ್ಮ ವ್ಯಾಪಾರದ ವಿಭಾಗ ಯಾವುದು? ಉದಾಹರಣೆಗೆ: ತುರಿಕೆದಾರ, ಚಿಲ್ಲರೆ, ವಿತರಕ, ರಫ್ತುದಾರ ಅಥವಾ ಎಫ್‌ಪಿಒ.",
    "hi-IN": "आपके व्यवसाय की श्रेणी क्या है? उदाहरण: थोक व्यापारी, खुदरा, वितरक, निर्यातक या एफपीओ।",
  },
  contactPerson: {
    "en-IN": "What is the contact person's name?",
    "kn-IN": "ಸಂಪರ್ಕ ವ್ಯಕ್ತಿಯ ಹೆಸರೇನು?",
    "hi-IN": "संपर्क व्यक्ति का नाम क्या है?",
  },
  phone: {
    "en-IN": "What is your 10-digit mobile phone number?",
    "kn-IN": "ನಿಮ್ಮ 10 ಅಂಕಿಯ ಮೊಬೈಲ್ ದೂರವಾಣಿ ಸಂಖ್ಯೆ ಎಷ್ಟು?",
    "hi-IN": "आपका 10 अंकों का मोबाइल फोन नंबर क्या है?",
  },
  email: {
    "en-IN": "What is your email address? You can say skip if you don't have one.",
    "kn-IN": "ನಿಮ್ಮ ಇ-ಮೇಲ್ ವಿಳಾಸ ಏನು? ಇಲ್ಲದಿದ್ದರೆ 'ಬಿಡಿ' ಎಂದು ಹೇಳಿ.",
    "hi-IN": "आपका ईमेल पता क्या है? नहीं है तो 'छोड़ें' बोलिए।",
  },
  address: {
    "en-IN": "What is your business address or mandi shop number?",
    "kn-IN": "ನಿಮ್ಮ ವ್ಯವಹಾರದ ವಿಳಾಸ ಅಥವಾ ಮಂಡಿ ಅಂಗಡಿಯ ಸಂಖ್ಯೆ ಏನು?",
    "hi-IN": "आपके व्यवसाय का पता या मंडी दुकान नंबर क्या है?",
  },
  district: {
    "en-IN": "Which district is your business in? For example: Davanagere, Kolar or Mysuru.",
    "kn-IN": "ನಿಮ್ಮ ವ್ಯವಹಾರ ಯಾವ ಜಿಲ್ಲೆಯಲ್ಲಿದೆ? ಉದಾಹರಣೆಗೆ: ದಾವಣಗೆರೆ, ಕೋಲಾರ ಅಥವಾ ಮೈಸೂರು.",
    "hi-IN": "आपका व्यवसाय किस जिले में है? उदाहरण: दवांगरे, कोलार या मैसूर।",
  },
  taluk: {
    "en-IN": "Which taluk or locality is your business in? You can say skip.",
    "kn-IN": "ನಿಮ್ಮ ವ್ಯವಹಾರ ಯಾವ ತಾಲೂಕು ಅಥವಾ ಊರಿನಲ್ಲಿದೆ? 'ಬಿಡಿ' ಎಂದು ಹೇಳಬಹುದು.",
    "hi-IN": "आपका व्यवसाय किस तहसील या इलाके में है? 'छोड़ें' भी बोल सकते हैं।",
  },
  locality: {
    "en-IN": "Which locality or yard is your shop in? You can say skip.",
    "kn-IN": "ನಿಮ್ಮ ಅಂಗಡಿ ಯಾವ ಲೊಕಾಲಿಟಿ ಅಥವಾ ಯಾರ್ಡ್‌ನಲ್ಲಿದೆ? 'ಬಿಡಿ' ಎಂದು ಹೇಳಬಹುದು.",
    "hi-IN": "आपकी दुकान किस मोहल्ले या यार्ड में है? 'छोड़ें' भी बोल सकते हैं।",
  },
  pincode: {
    "en-IN": "What is your 6-digit PIN code? You can say skip.",
    "kn-IN": "ನಿಮ್ಮ 6 ಅಂಕಿಯ ಪಿನ್ ಕೋಡ್ ಎಷ್ಟು? 'ಬಿಡಿ' ಎಂದು ಹೇಳಬಹುದು.",
    "hi-IN": "आपका 6 अंकों का पिन कोड क्या है? 'छोड़ें' भी बोल सकते हैं।",
  },
  latitude: {
    "en-IN": "Should I use the district GPS coordinates for your business, or will you fetch the location manually? Say yes to use them.",
    "kn-IN": "ನಿಮ್ಮ ವ್ಯವಹಾರಕ್ಕೆ ಜಿಲ್ಲೆಯ ಜಿಪಿಎಸ್ ನಿರ್ದೇಶಾಂಕಗಳನ್ನು ಬಳಸಲೇ? ಬಳಸಬೇಕಾದರೆ 'ಹೌದು' ಎಂದು ಹೇಳಿ.",
    "hi-IN": "क्या मैं आपके व्यवसाय के लिए जिले के GPS निर्देशांक उपयोग करूँ? उपयोग करना हो तो 'हाँ' बोलिए।",
  },
  longitude: {
    "en-IN": "Please confirm the GPS coordinates for your business location.",
    "kn-IN": "ನಿಮ್ಮ ವ್ಯವಹಾರ ಸ್ಥಳದ ಜಿಪಿಎಸ್ ನಿರ್ದೇಶಾಂಕ ದೃಢೀಕರಿಸಿ.",
    "hi-IN": "कृपया अपने व्यवसाय स्थान के GPS निर्देशांक की पुष्टि करें।",
  },
  serviceCoverage: {
    "en-IN": "How far do you buy crops: only your taluk, the whole district, nearby districts, or statewide?",
    "kn-IN": "ನೀವು ಎಲ್ಲಿಯವರೆಗೆ ಬೆಳೆ ಖರೀದಿಸುತ್ತೀರಿ: ತಾಲೂಕು, ಇಡೀ ಜಿಲ್ಲೆ, ಸುತ್ತಮುತ್ತಲ ಜಿಲ್ಲೆಗಳಾ ಅಥವಾ ರಾಜ್ಯಮಟ್ಟಿಗೆ?",
    "hi-IN": "आप कितनी दूर तक फसल खरीदते हैं: तहसील, पूरा जिला, आस-पास के जिले, या पूरे राज्य?",
  },
  selectedCrops: {
    "en-IN": "Which crops do you purchase? For example: tomato, onion, potato, maize or cotton.",
    "kn-IN": "ನೀವು ಯಾವ ಬೆಳೆಗಳನ್ನು ಖರೀದಿಸುತ್ತೀರಿ? ಉದಾಹರಣೆಗೆ: ಟೊಮೇಟೊ, ಈರುಳ್ಳಿ, ಆಲೂಗಡ್ಡೆ, ಮೈಕಾ ಅಥವಾ ಹತ್ತಿ.",
    "hi-IN": "आप कौन-कौन सी फसलें खरीदते हैं? उदाहरण: टमाटर, प्याज, आलू, मक्का या कपास।",
  },
  minQuantityKg: {
    "en-IN": "What is the minimum quantity in kilograms you purchase?",
    "kn-IN": "ನೀವು ಕನಿಷ್ಠ ಎಷ್ಟು ಕಿಲೋಗ್ರಾನ್ ಖರೀದಿಸುತ್ತೀರಿ?",
    "hi-IN": "आप न्यूनतम कितने किलोग्राम खरीदते हैं?",
  },
  maxQuantityKg: {
    "en-IN": "What is your maximum daily purchase capacity in kilograms?",
    "kn-IN": "ದಿನಕ್ಕೆ ಗರಿಷ್ಠ ಎಷ್ಟು ಕಿಲೋಗ್ರಾನ್ ಖರೀದಿ ಸಾಮರ್ಥ್ಯ ಇದೆ?",
    "hi-IN": "दिन में अधिकतम कितने किलोग्राम खरीदने की क्षमता है?",
  },
  transportPreference: {
    "en-IN": "Do you pick up crops from the farm gate, do farmers deliver to your yard, or both?",
    "kn-IN": "ನೀವು ಕಡ್ಡೆಯನ್ನು ಹೊಲದಿಂದ ಎತ್ತಿಕೊಳ್ಳುತ್ತೀರಾ, ರೈತರು ನಿಮ್ಮ ವಸತಿಗನ್ನು ತರುತ್ತಾರೋ, ಅಥವಾ ಎರಡೂ?",
    "hi-IN": "आप फसल खेत से उठाते हैं, किसान आपके यार्ड में लाते हैं, या दोनों?",
  },
  paymentTerms: {
    "en-IN": "On what terms do you pay farmers? For example: immediate cash or UPI. Say skip to keep the default.",
    "kn-IN": "ರೈತರಿಗೆ ನೀವು ಯಾವ ಷರತ್ತಿನಲ್ಲಿ ಪಾವತಿ ಮಾಡುತ್ತೀರಿ? ಉದಾಹರಣೆಗೆ: ತಕ್ಷಣ ನಗದ ಅಥವಾ ಯುಪಿಐ. ಡೀಫಾಲ್ಟ್ ಬೇಕಾದರೆ 'ಬಿಡಿ' ಎಂದು ಹೇಳಿ.",
    "hi-IN": "किसानों को आप किस शर्त पर भुगतान करते हैं? उदाहरण: तुरंत नकद या यूपीआई। डिफ़ॉल्ट चाहिए तो 'छोड़ें' बोलिए।",
  },
  description: {
    "en-IN": "Anything else farmers should know about your business or quality needs? You can say skip.",
    "kn-IN": "ನಿಮ್ಮ ವ್ಯವಹಾರ ಅಥವಾ ಗುಣಮಟ್ಟದ ಬಗ್ಗೆ ರೈತರಿಗೆ ಬೇರೆ ಏನಾದರೂ ತಿಳಿಸಬೇಕೆ? 'ಬಿಡಿ' ಎಂದು ಹೇಳಬಹುದು.",
    "hi-IN": "आपके व्यवसाय या गुणवत्ता के बारे में किसानों को और कुछ बताना है? 'छोड़ें' भी बोल सकते हैं।",
  },
  consentToPublish: {
    "en-IN": "Do you consent to publishing this business listing so farmers can find you? Say yes or no.",
    "kn-IN": "ರೈತರು ನಿಮ್ಮನ್ನು ಕಂಡುಹಿಡಿಯಲು ಈ ವ್ಯವಹಾರ ಲಿಸ್ಟಿಂಗ್ ಪ್ರಕಟಿಸಲು ನೀವು ಒಪ್ಪಿಗೆ ನೀಡುತ್ತೀರಾ? 'ಹೌದು' ಅಥವಾ 'ಇಲ್ಲ' ಎಂದು ಹೇಳಿ.",
    "hi-IN": "क्या आप इस व्यवसाय लिस्टिंग को प्रकाशित करने की अनुमति देते हैं ताकि किसान आपको खोज सकें? 'हाँ' या 'नहीं' बोलिए।",
  },
};

/** Short localized label for each field (used in the review read-back). */
export const FIELD_LABELS: Record<string, LocalizedText> = {
  businessName: { "en-IN": "Business name", "kn-IN": "ವ್ಯಾಪಾರದ ಹೆಸರು", "hi-IN": "व्यवसाय का नाम" },
  category: { "en-IN": "Category", "kn-IN": "ವಿಭಾಗ", "hi-IN": "श्रेणी" },
  contactPerson: { "en-IN": "Contact person", "kn-IN": "ಸಂಪರ್ಕ ವ್ಯಕ್ತಿ", "hi-IN": "संपर्क व्यक्ति" },
  phone: { "en-IN": "Phone", "kn-IN": "ದೂರವಾಣಿ", "hi-IN": "फोन" },
  email: { "en-IN": "Email", "kn-IN": "ಇ-ಮೇಲ್", "hi-IN": "ईमेल" },
  address: { "en-IN": "Address", "kn-IN": "ವಿಳಾಸ", "hi-IN": "पता" },
  district: { "en-IN": "District", "kn-IN": "ಜಿಲ್ಲಾ", "hi-IN": "जिला" },
  taluk: { "en-IN": "Taluk", "kn-IN": "ತಾಲೂಕು", "hi-IN": "तहसील" },
  locality: { "en-IN": "Locality", "kn-IN": "ಒಳನಾಡು", "hi-IN": "इलाका" },
  pincode: { "en-IN": "PIN code", "kn-IN": "ಪಿನ್ ಕೋಡ್", "hi-IN": "पिन कोड" },
  latitude: { "en-IN": "Latitude", "kn-IN": "ಅಕ್ಷಾಂಶ", "hi-IN": "अक्षांश" },
  longitude: { "en-IN": "Longitude", "kn-IN": "ರೇಖಾಂಶ", "hi-IN": "रेखांश" },
  serviceCoverage: { "en-IN": "Service area", "kn-IN": "ಸೇವಾ ವಿಸ್ತೀರ್ಣ", "hi-IN": "सेवा क्षेत्र" },
  selectedCrops: { "en-IN": "Crops purchased", "kn-IN": "ಖರೀದಿಸಿದ ಬೆಳೆಗಳು", "hi-IN": "खरीदी फसलें" },
  minQuantityKg: { "en-IN": "Minimum quantity", "kn-IN": "ಕನಿಷ್ಠ ಪ್ರಮಾಣ", "hi-IN": "न्यूनतम मात्रा" },
  maxQuantityKg: { "en-IN": "Maximum quantity", "kn-IN": "ಗರಿಷ್ಠ ಪ್ರಮಾಣ", "hi-IN": "अधिकतम मात्रा" },
  transportPreference: { "en-IN": "Transport", "kn-IN": "ಸಾರಿಗೆ", "hi-IN": "परिवहन" },
  paymentTerms: { "en-IN": "Payment terms", "kn-IN": "ಪಾವತಿ ಷರತ್ತು", "hi-IN": "भुगतान शर्तें" },
  description: { "en-IN": "Description", "kn-IN": "ವಿವರಣೆ", "hi-IN": "विवरण" },
  consentToPublish: { "en-IN": "Publishing consent", "kn-IN": "ಪ್ರಕಟಣೆ ಒಪ್ಪಿಗೆ", "hi-IN": "प्रकाशन अनुमति" },
};

/** Localized validation / clarification messages. */
export const VALIDATION_MESSAGES: Record<string, LocalizedText> = {
  REQUIRED: {
    "en-IN": "I didn't catch that. Please tell me this detail.",
    "kn-IN": "ನನಗೆ ಅರ್ಥ ಆಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಈ ವಿವರ ಹೇಳಿ.",
    "hi-IN": "मुझे समझ नहीं आया। कृपया यह विवरण बताइए।",
  },
  INVALID_PHONE: {
    "en-IN": "That doesn't sound like a valid 10-digit Indian mobile number starting with 6 to 9. Please say the number again.",
    "kn-IN": "ಅದು 6-9 ರಿಂದ ಪ್ರಾರಂಭವಾಗುವ 10 ಅಂಕಿಯ ಭಾರತೀಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ಎಂದು ತೋರುವುದಿಲ್ಲ. ದಯವಿಟ್ಟು ಸಂಖ್ಯೆಯನ್ನು ಪುನಃ ಹೇಳಿ.",
    "hi-IN": "यह 6-9 से शुरू होने वाला 10 अंकों का भारतीय मोबाइल नंबर नहीं लगता। कृपया नंबर दोबारा बोलिए।",
  },
  INVALID_EMAIL: {
    "en-IN": "That email address doesn't look correct. Please say it again or skip.",
    "kn-IN": "ಆ ಇ-ಮೇಲ್ ವಿಳಾಸ ಸರಿಯಾಗಿ ಕಾಣಿಸುವುದಿಲ್ಲ. ದಯವಿಟ್ಟು ಪುನಃ ಹೇಳಿ ಅಥವಾ ಬಿಡಿ.",
    "hi-IN": "यह ईमेल पता सही नहीं लग रहा। कृपया दोबारा बोलिए या छोड़िए।",
  },
  INVALID_CATEGORY: {
    "en-IN": "I couldn't match that category. Please choose from: local vendor, wholesaler, retailer, distributor, processor, exporter, cooperative, FPO or bulk purchaser.",
    "kn-IN": "ಆ ವಿಭಾಗವನ್ನು ಹೊಂದಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಆಯ್ಕೆ ಮಾಡಿ: ಸ್ಥಳೀಯ ಮಾರಾಟಗಾರ, ತುರಿಕೆದಾರ, ಚಿಲ್ಲರೆ, ವಿತರಕ, ಪ್ರಕ್ರಿಯೆ, ರಫ್ತುದಾರ, ಸಹಕಾರ, ಎಫ್‌ಪಿಒ ಅಥವಾ ಒಕ್ಕೂಟ.",
    "hi-IN": "यह श्रेणी मेल नहीं खाई। कृपया चुनिए: स्थानीय विक्रेता, थोक व्यापारी, खुदरा, वितरक, प्रोसेसर, निर्यातक, सहकारी, एफपीओ या बल्क खरीदार।",
  },
  INVALID_CROP: {
    "en-IN": "I couldn't recognise those crops. Please choose from: tomato, onion, potato, green chilli, maize, ragi, cotton, turmeric, ginger, arecanut, coconut or banana.",
    "kn-IN": "ಆ ಬೆಳೆಗಳನ್ನು ಗುರುತಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಆಯ್ಕೆ ಮಾಡಿ: ಟೊಮೇಟೊ, ಈರುಳ್ಳಿ, ಆಲೂಗಡ್ಡೆ, ಹಸಿ ಮೆನೆಸಕಾಯಿ, ಮೈಕಾ, ರಾಗೀ, ಹತ್ತಿ, ಅರಿಶಿನ, ಶುಂಠಿ, ಅಕ್ನಿ, ಕೊಬ್ಬರಿ ಅಥವಾ ಬಾಳೆ.",
    "hi-IN": "ये फसलें पहचान नहीं पाए। कृपया चुनिए: टमाटर, प्याज, आलू, हरी मिर्च, मक्का, रागी, कपास, हल्दी, अदरक, अकॉट, नारियल या केला।",
  },
  INVALID_DISTRICT: {
    "en-IN": "I couldn't match that district. Please choose a Karnataka district, for example Davanagere, Kolar or Mysuru.",
    "kn-IN": "ಆ ಜಿಲ್ಲೆಯನ್ನು ಹೊಂದಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಕರ್ನಾಟಕದ ಜಿಲ್ಲೆ ಆಯ್ಕೆ ಮಾಡಿ, ಉದಾಹರಣೆಗೆ ದಾವಣಗೆರೆ, ಕೋಲಾರ ಅಥವಾ ಮೈಸೂರು.",
    "hi-IN": "यह जिला मेल नहीं खाया। कृपया कर्नाटक का जिला चुनिए, जैसे दवांगरे, कोलार या मैसूर।",
  },
  INVALID_COORDINATES: {
    "en-IN": "Those GPS coordinates are not valid. You can say yes to use the district location instead.",
    "kn-IN": "ಆ ಜಿಪಿಎಸ್ ನಿರ್ದೇಶಾಂಕಗಳು ಮಾನ್ಯವಾಗಿವೆ. ಬದಲಾಗಿ ಜಿಲ್ಲೆಯ ಸ್ಥಳವನ್ನು ಬಳಸಲು 'ಹೌದು' ಎಂದು ಹೇಳಿ.",
    "hi-IN": "ये GPS निर्देशांक मान्य नहीं हैं। इसके बजाय जिले का स्थान उपयोग करने के लिए 'हाँ' बोलिए।",
  },
  INVALID_QUANTITY: {
    "en-IN": "Please give a quantity in kilograms greater than zero, and make sure the maximum is not less than the minimum.",
    "kn-IN": "ದಯವಿಟ್ಟು ಶೂನ್ಯಕ್ಕಿಂತ ಹೆಚ್ಚಿನ ಕಿಲೋಗ್ರಾನ್ ಪ್ರಮಾಣ ನೀಡಿ, ಮತ್ತು ಗರಿಷ್ಠ ಕನಿಷ್ಠಕ್ಕಿಂತ ಕಡಿಮೆ ಇರದಂತೆ ನೋಡಿ.",
    "hi-IN": "कृपया शून्य से अधिक किलोग्राम मात्रा दीजिए, और अधिकतम न्यूनतम से कम न हो इसका ध्यान रखिए।",
  },
  INVALID_TRANSPORT: {
    "en-IN": "Please answer: farm pickup, farmer delivery, or both.",
    "kn-IN": "ದಯವಿಟ್ಟು ಉತ್ತರಿಸಿ: ಹೊಲದ ಎತ್ತಿಕೊಳ್ಳುವಿಕೆ, ರೈತ ಡೆಲಿವರಿ, ಅಥವಾ ಎರಡೂ.",
    "hi-IN": "कृपया उत्तर दीजिए: फार्म पिकअप, किसान डिलीवरी, या दोनों।",
  },
  INVALID_COVERAGE: {
    "en-IN": "Please answer: taluk, whole district, neighbouring districts or statewide.",
    "kn-IN": "ದಯವಿಟ್ಟು ಉತ್ತರಿಸಿ: ತಾಲೂಕು, ಇಡೀ ಜಿಲ್ಲೆ, ಸುತ್ತಮುತ್ತ ಜಿಲ್ಲೆಗಳು ಅಥವಾ ರಾಜ್ಯಮಟ್ಟಿಗೆ.",
    "hi-IN": "कृपया उत्तर दीजिए: तहसील, पूरा जिला, पड़ोसी जिले या पूरा राज्य।",
  },
  INVALID_PINCODE: {
    "en-IN": "A PIN code should be 6 digits. Please say it again or skip.",
    "kn-IN": "ಪಿನ್ ಕೋಡ್ 6 ಅಂಕಿಯಾಗಿರಬೇಕು. ದಯವಿಟ್ಟು ಪುನಃ ಹೇಳಿ ಅಥವಾ ಬಿಡಿ.",
    "hi-IN": "पिन कोड 6 अंकों का होना चाहिए। कृपया दोबारा बोलिए या छोड़िए।",
  },
};

/** UI helper strings for the voice conversation screen. */
export const UI_STRINGS: Record<string, LocalizedText> = {
  title: { "en-IN": "Register your business by voice", "kn-IN": "ಧ್ವನಿಯ ಮೂಲಕ ನಿಮ್ಮ ವ್ಯವಹಾರ ನೋಂದಾಯಿಸಿ", "hi-IN": "आवाज़ से अपना व्यवसाय पंजीकृत करें" },
  chooseLanguage: { "en-IN": "Choose your language", "kn-IN": "ನಿಮ್ಮ ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ", "hi-IN": "अपनी भाषा चुनें" },
  listening: { "en-IN": "Listening… speak your answer, then tap to finish", "kn-IN": "ಆಲಿಸುತ್ತಿದೆ… ಉತ್ತರ ಹೇಳಿ, ಮುಗಿಸಲು ಒತ್ತಿ", "hi-IN": "सुन रहा हूँ… उत्तर बोलिए, फिर समाप्त करने के लिए दबाइए" },
  processing: { "en-IN": "Processing with Gnani AI…", "kn-IN": "ಞಾನಿ AI ನಿಂದ ಪ್ರಕ್ರಿಯೆ…", "hi-IN": "Gnani AI से प्रोसेस हो रहा है…" },
  speaking: { "en-IN": "Agent is speaking…", "kn-IN": "ಏಜೆಂಟ್ ಮಾತನಾಡುತ್ತಿದೆ…", "hi-IN": "एजेंट बोल रहा है…" },
  youSaid: { "en-IN": "You said", "kn-IN": "ನೀವು ಹೇಳಿದ್ದು", "hi-IN": "आपने कहा" },
  filledSoFar: { "en-IN": "Filled so far", "kn-IN": "ಈವರೆಗೆ ಭರ್ತಿ ಮಾಡಿದ್ದು", "hi-IN": "अब तक भरा गया" },
  repeatQuestion: { "en-IN": "Repeat question", "kn-IN": "ಪ್ರಶ್ನೆ ಪುನರಾವರ್ತಿಸಿ", "hi-IN": "प्रश्न दोहराइए" },
  retryRecording: { "en-IN": "Retry recording", "kn-IN": "ಮತ್ತೆ ದಾಖಲಿಸಿ", "hi-IN": "रिकॉर्डिंग दोबारा करें" },
  typeAnswer: { "en-IN": "Type your answer", "kn-IN": "ಉತ್ತರ ಟೈಪ್ ಮಾಡಿ", "hi-IN": "उत्तर टाइप करें" },
  skip: { "en-IN": "Skip", "kn-IN": "ಬಿಡಿ", "hi-IN": "छोड़ें" },
  edit: { "en-IN": "Edit", "kn-IN": "ಬದಲಾಯಿಸಿ", "hi-IN": "संपादित करें" },
  pause: { "en-IN": "Pause", "kn-IN": "ತಾಳಿಕೊಡಿ", "hi-IN": "रोकें" },
  resume: { "en-IN": "Resume", "kn-IN": "ಮುಂದುವರಿಸಿ", "hi-IN": "जारी रखें" },
  cancel: { "en-IN": "Cancel registration", "kn-IN": "ನೋಂದಾವಣೆ ರದ್ದುಮಾಡಿ", "hi-IN": "पंजीकरण रद्द करें" },
  manualEntry: { "en-IN": "Switch to manual entry", "kn-IN": "ಕೈಬರಹಕ್ಕೆ ಬದಲಾಯಿಸಿ", "hi-IN": "मैनुअल भरना चुनें" },
  reviewTitle: { "en-IN": "Please review your details", "kn-IN": "ದಯವಿಟ್ಟು ನಿಮ್ಮ ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ", "hi-IN": "कृपया अपना विवरण समीक्षा करें" },
  confirm: { "en-IN": "Confirm & register", "kn-IN": "ದೃಢೀಕರಿಸಿ ಮತ್ತು ನೋಂದಾಯಿಸಿ", "hi-IN": "पुष्टि करें और पंजीकृत करें" },
  correctField: { "en-IN": "Correct a field", "kn-IN": "ತಪ್ಪು ತಿದ್ದಿ", "hi-IN": "कोई field सुधारें" },
  submitting: { "en-IN": "Submitting your registration…", "kn-IN": "ನಿಮ್ಮ ನೋಂದಾವಣೆ ಸಲ್ಲಿಸಲಾಗುತ್ತಿದೆ…", "hi-IN": "आपका पंजीकरण जमा हो रहा है…" },
  completed: { "en-IN": "Business registered and submitted for verification!", "kn-IN": "ವ್ಯವಹಾರ ನೋಂದಾಯಿಸಲ್ಪಟ್ಟಿದೆ ಮತ್ತು ಪರಿಶೀಲನೆಗೆ ಸಲ್ಲಿಸಲಾಗಿದೆ!", "hi-IN": "व्यवसाय पंजीकृत और सत्यापन के लिए जमा किया गया!" },
  ttsUnavailable: {
    "en-IN": "Voice playback is unavailable, so I'll show the question as text. You can speak or type your answer.",
    "kn-IN": "ಧ್ವನಿ ಪ್ರಸರಣ ಲಭ್ಯವಿಲ್ಲ, ಆದ್ದರಿಂದ ಪ್ರಶ್ನೆಯನ್ನು ಪಠ್ಯವಾಗಿ ತೋರಿಸುತ್ತೇನೆ. ನೀವು ಮಾತನಾಡಬಹುದು ಅಥವಾ ಟೈಪ್ ಮಾಡಬಹುದು.",
    "hi-IN": "आवाज़ चल नहीं पा रही, इसलिए प्रश्न टेक्स्ट में दिखा रहा हूँ। आप बोल सकते हैं या टाइप कर सकते हैं।",
  },
  sttUnavailable: {
    "en-IN": "Speech recognition failed. Please retry or type your answer.",
    "kn-IN": "ಮಾತು ಗುರುತಿಸುವಿಕೆ ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ಉತ್ತರ ಟೈಪ್ ಮಾಡಿ.",
    "hi-IN": "आवाज़ पहचान विफल। कृपया दोबारा कोशिश करें या उत्तर टाइप कीजिए।",
  },
  modelUnavailable: {
    "en-IN": "AI extraction is temporarily unavailable. Your answer was kept — you can retry or type it.",
    "kn-IN": "AI ಹೊರತೆಗೆಯುವಿಕೆ ತಾಂತ್ರಿಕವಾಗಿ ಲಭ್ಯವಿಲ್ಲ. ನಿಮ್ಮ ಉತ್ತರ ಉಳಿಸಲಾಗಿದೆ — ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.",
    "hi-IN": "AI निष्कर्षण अस्थायी रूप से अनुपलब्ध है। आपका उत्तर सुरक्षित है — दोबारा कोशिश करें या टाइप कीजिए।",
  },
  confirmSpoken: {
    "en-IN": "Please say 'confirm' to register your business now, or choose an option below.",
    "kn-IN": "ನಿಮ್ಮ ವ್ಯವಹಾರ ಇದೇ ಕ್ಷಣ ನೋಂದಾಯಿಸಲು 'ದೃಢೀಕರಿಸಿ' ಎಂದು ಹೇಳಿ, ಅಥವಾ ಕೆಳಗೆ ಆಯ್ಕೆ ಮಾಡಿ.",
    "hi-IN": "अभी अपना व्यवसाय पंजीकृत करने के लिए 'पुष्टि करें' बोलिए, या नीचे विकल्प चुनिए।",
  },
};

/** Words that mean "skip this optional question". */
export const SKIP_WORDS = [
  "skip", "not needed", "no", "none", "don't have", "dont have", "no email",
  "ಬಿಡಿ", "ಬಿಟ್ಟರೇ ಸುಮ್ಮ", "ಬೇಡ", "ಇಲ್ಲ",
  "छोड़ें", "छोड़", "नहीं", "नहीं है", "बाद में",
];

/** Spoken yes/no tokens for boolean fields. */
export const YES_WORDS = ["yes", "yeah", "yep", "correct", "ok", "haan", "ಹೌದು", "ಆಗುತ್ತೆ", "ಸರಿ", "हाँ", "जी हाँ", "ठीक"];
export const NO_WORDS = ["no", "nope", "nah", "ಇಲ್ಲ", "ಬೇಡ", "नहीं", "ना"];

/** Confirmation words used at the review step (explicit voice confirmation). */
export const CONFIRM_WORDS = ["confirm", "submit", "yes confirm", "register", "done", "ಸರಿ ಆಗುತ್ತೆ", "ದೃಢೀಕರಿಸಿ", "ಸಲ್ಲಿಸಿ", "पुष्टि करें", "जमा करें", "ठीक है भेजिए"];

/** Localized digit words (spoken phone numbers / quantities) for deterministic normalization. */
export const SPOKEN_DIGITS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9",
  oh: "0", o: "0",
  // Kannada
  ಶೂನ್ಯ: "0", ಒಂದು: "1", ಎರಡು: "2", ಮೂರು: "3", ನಾಲ್ಕು: "4", ಐದು: "5", ಆರು: "6", ಏಳು: "7", ಎಂಟು: "8", ಒಂಬತ್ತು: "9",
  // Hindi
  शून्य: "0", एक: "1", दो: "2", तीन: "3", चार: "4", पाँच: "5", पांच: "5", छह: "6", सात: "7", आठ: "8", नौ: "9",
};

/** Multi-digit scale words for quantities. */
export const SPOKEN_SCALES: Record<string, number> = {
  hundred: 100, thousand: 1000, "lakh": 100000,
  ನೂರು: 100, ಸಾವಿರ: 1000, ಲಕ್ಷ: 100000,
  सौ: 100, हज़ार: 1000, हजार: 1000, लाख: 100000,
};

/** Localized aliases for category ids. */
export const CATEGORY_ALIASES: Record<string, string[]> = {
  local_vendor: ["local vendor", "mandi agent", "spotter", "ಸ್ಥಳೀಯ ಮಾರಾಟಗಾರ", "ಮಂಡಿ ಏಜೆಂಟ್", "स्थानीय विक्रेता", "मंडी एजेंट"],
  wholesaler: ["wholesaler", "wholesale trader", "wholesale", "ತುರಿಕೆದಾರ", "ಥೋಕ್", "थोक", "थोक व्यापारी"],
  retailer: ["retailer", "retail", "supermarket", "ಚಿಲ್ಲರೆ", "ಚಿಲ್ಲರೆ ಮಾರಾಟ", "खुदरा", "रिटेल"],
  distributor: ["distributor", "distribution", "ವಿತರಕ", "ವಿತರಣೆ", "वितरक", "वितरण"],
  processor: ["processor", "processing", "food processing", "ಪ್ರಕ್ರಿಯೆ", "ಆಹಾರ ಪ್ರಕ್ರಿಯೆ", "प्रोसेसिंग", "प्रक्रमण"],
  exporter: ["exporter", "export", "ರಫ್ತುದಾರ", "रफ्ता", "निर्यातक", "निर्यात"],
  cooperative: ["cooperative", "society", "ಒಕ್ಕೂಟ", "ಸಹಕಾರ", "सहकारी", "सोसाइटी"],
  fpo: ["fpo", "farmer producer organization", "farmer producer company", "ಎಫ್‌ಪಿಒ", "ರೈತ ಉತ್ಪಾದಕ ಸಂಘ", "एफपीओ", "किसान उत्पादक संगठन"],
  bulk_purchaser: ["bulk purchaser", "bulk buyer", "hotel", "restaurant", "horeca", "institution", "ಬೃಹತ್ ಖರೀದಿದಾರ", "होटल", "भारी खरीदार"],
};

/** Localized aliases for crop names (canonical CROPS_LIST entries). */
export const CROP_ALIASES: Record<string, string[]> = {
  Tomato: ["tomato", "ಟೊಮೇಟೊ", "ನೆಲ್ಲಿಕಾಯಿ", "टमाटर", "टमाटो"],
  Onion: ["onion", "ಈರುಳ್ಳಿ", "प्याज", "कांदा"],
  Potato: ["potato", "ಆಲೂಗಡ್ಡೆ", "आलू", "बटाटा"],
  "Green Chilli": ["green chilli", "green chili", "chilli", "chili", "ಹಸಿ ಮೆನೆಸಕಾಯಿ", "ಹಸಿ ಮೆಳಕಾಯಿ", "हरी मिर्च", "मिर्च"],
  Maize: ["maize", "corn", "ಮೈಕಾ", "ಮೆಕ್ಕೆಜೋಳ", "मक्का", "भुट्टा"],
  Ragi: ["ragi", "finger millet", "ರಾಗೀ", "ರಾಗಿ", "रागी", "मड़िया"],
  Cotton: ["cotton", "ಹತ್ತಿ", "कपास", "रुई"],
  Turmeric: ["turmeric", "ಅರಿಶಿನ", "हल्दी"],
  Ginger: ["ginger", "ಶುಂಠಿ", "अदरक"],
  Arecanut: ["arecanut", "areca nut", "supari", "ಅಕ್ನಿ", "ಅಡಿಕೆ", "सुपारी", "अडिके"],
  Coconut: ["coconut", "ಕೊಬ್ಬರಿ", "नारियल"],
  Banana: ["banana", "endalu", "ಬಾಳೆ", "केला", "एंडलू"],
};

/** Localized aliases for transportPreference values. */
export const TRANSPORT_ALIASES: Record<string, string[]> = {
  pickup: ["pickup", "farm gate pickup", "farm pickup", "i pick up", "ಹೊಲದ ಎತ್ತಿಕೊಳ್ಳುವಿಕೆ", "ಎತ್ತಿಕೊಳ್ಳುತ್ತೀರಿ", "पिकअप", "खेत से उठाते"],
  delivery: ["delivery", "farmer delivery", "farmer brings", "ನಮ್ಮ ವಸತಿಗೆ", "ರೈತರು ತರುತ್ತಾರೆ", "डिलीवरी", "किसान लाते"],
  both: ["both", "ಎರಡೂ", "दोनों", "both options"],
};

/** Localized aliases for serviceCoverage values. */
export const COVERAGE_ALIASES: Record<string, string[]> = {
  village: ["village", "our village", "ಊರು", "ಗ್ರಾಮ", "गाँव", "गांव"],
  taluk: ["taluk", "taluka", "ತಾಲೂಕು", "तहसील"],
  district: ["district", "whole district", "ಜಿಲ್ಲೆ", "ಇಡೀ ಜಿಲ್ಲೆ", "जिला", "पूरा जिला"],
  multiple_districts: ["neighbouring districts", "nearby districts", "multiple districts", "ಸುತ್ತಮುತ್ತ ಜಿಲ್ಲೆಗಳು", "पड़ोसी जिले", "आस-पास के जिले"],
  statewide: ["statewide", "state wide", "across karnataka", "all over karnataka", "ರಾಜ್ಯಮಟ್ಟಿಗೆ", "ಇಡೀ ರಾಜ್ಯ", "पूरा राज्य", "पूरे राज्य", "कर्नाटक भर"],
};

/** Localized aliases for the district select options. */
export const DISTRICT_ALIASES: Record<string, string[]> = {};
for (const d of DISTRICTS_KARNATAKA) {
  DISTRICT_ALIASES[d] = [d.toLowerCase()];
}
Object.assign(DISTRICT_ALIASES, {
  Davanagere: ["davanagere", "davanegera", "ದಾವಣಗೆರೆ", "दवांगरे", "दवणगरे"],
  Harihar: ["harihar", "ಹರಿಹರ", "हरिहर"],
  Dharwad: ["dharwad", "ಧಾರವಾಡ", "धारवाड़"],
  Hubballi: ["hubballi", "hubli", "ಹುಬ್ಬಳ್ಳಿ", "हुबली"],
  Belagavi: ["belagavi", "belgaum", "ಬೆಳಗಾವಿ", "बेलगांव"],
  Kolar: ["kolar", "ಕೋಲಾರ", "कोलार"],
  Chitradurga: ["chitradurga", "ಚಿತ್ರದುರ್ಗ", "चित्रदुर्ग"],
  Shivamogga: ["shivamogga", "shimoga", "ಶಿವಮೊಗ್ಗ", "शिमोगा"],
  Haveri: ["haveri", "ಹವೇರೀ", "हवेरी"],
  Bellary: ["bellary", "ballari", "ಬಳ್ಳಾರೀ", "बल्लारী"],
  Mandya: ["mandya", "ಮಂಡ್ಯ", "मान्ड्या"],
  Mysuru: ["mysuru", "mysore", "ಮೈಸೂರು", "मैसूर"],
  Tumakuru: ["tumakuru", "tumkur", "ತುಮಕೂರು", "तुमकुर"],
  "Bengaluru Rural": ["bengaluru rural", "bangalore rural", "ಬೆಂಗಳೂರು ಗ್ರಾಮಾಂತರ", "बेंगलुरु ग्रामीण"],
});

/** Category labels for display (from CATEGORIES). */
export function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label || id;
}
