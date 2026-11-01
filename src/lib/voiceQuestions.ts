export type SupportedLanguage = "en" | "kn" | "hi";

export type VoiceQuestion = {
  id: string;
  en: string;
  kn: string;
  hi: string;
};

export const VOICE_QUESTIONS: VoiceQuestion[] = [
  {
    id: "tomato-price-near-location",
    en: "whats price of tomato near to my location",
    kn: "ನನ್ನ ಸ್ಥಳದ ಹತ್ತಿರ ಟೊಮೇಟೊ ಬೆಲೆ ಎಷ್ಟು?",
    hi: "मेरे स्थान के पास टमाटर का भाव क्या है?",
  },
];

export function getVoiceQuestion(language: SupportedLanguage, id = VOICE_QUESTIONS[0]?.id): string {
  const question = VOICE_QUESTIONS.find((item) => item.id === id);
  if (!question) throw new Error(`Voice question is not configured: ${id || "unknown"}`);
  const text = question[language];
  if (!text?.trim()) throw new Error(`Voice question translation is missing: ${id} (${language})`);
  return text;
}
