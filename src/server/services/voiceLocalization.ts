type VoiceLanguage = "kn" | "hi" | "en";

const hindiUnits = [
  "शून्य", "एक", "दो", "तीन", "चार", "पाँच", "छह", "सात", "आठ", "नौ",
  "दस", "ग्यारह", "बारह", "तेरह", "चौदह", "पंद्रह", "सोलह", "सत्रह",
  "अठारह", "उन्नीस", "बीस", "इक्कीस", "बाईस", "तेईस", "चौबीस", "पच्चीस",
  "छब्बीस", "सत्ताईस", "अट्ठाईस", "उनतीस", "तीस", "इकतीस", "बत्तीस",
  "तैंतीस", "चौंतीस", "पैंतीस", "छत्तीस", "सैंतीस", "अड़तीस", "उनतालीस",
  "चालीस", "इकतालीस", "बयालीस", "तैंतालीस", "चवालीस", "पैंतालीस",
  "छियालीस", "सैंतालीस", "अड़तालीस", "उनचास", "पचास", "इक्यावन",
  "बावन", "तिरेपन", "चौवन", "पचपन", "छप्पन", "सत्तावन", "अट्ठावन",
  "उनसठ", "साठ", "इकसठ", "बासठ", "तिरसठ", "चौंसठ", "पैंसठ", "छियासठ",
  "सड़सठ", "अड़सठ", "उनहत्तर", "सत्तर", "इकहत्तर", "बहत्तर", "तिहत्तर",
  "चौहत्तर", "पचहत्तर", "छिहत्तर", "सतहत्तर", "अठहत्तर", "उन्यासी",
  "अस्सी", "इक्यासी", "बयासी", "तिरासी", "चौरासी", "पचासी", "छियासी",
  "सतासी", "अट्ठासी", "नवासी", "नब्बे", "इक्यानवे", "बानवे", "तिरानवे",
  "चौरानवे", "पचानवे", "छियानवे", "सत्तानवे", "अट्ठानवे", "निन्यानवे",
];

const kannadaUnits = [
  "ಸೊನ್ನೆ", "ಒಂದು", "ಎರಡು", "ಮೂರು", "ನಾಲ್ಕು", "ಐದು", "ಆರು", "ಏಳು", "ಎಂಟು", "ಒಂಬತ್ತು",
  "ಹತ್ತು", "ಹನ್ನೊಂದು", "ಹನ್ನೆರಡು", "ಹದಿಮೂರು", "ಹದಿನಾಲ್ಕು", "ಹದಿನೈದು", "ಹದಿನಾರು",
  "ಹದಿನೇಳು", "ಹದಿನೆಂಟು", "ಹತ್ತೊಂಬತ್ತು", "ಇಪ್ಪತ್ತು", "ಇಪ್ಪತ್ತೊಂದು", "ಇಪ್ಪತ್ತೆರಡು",
  "ಇಪ್ಪತ್ತಮೂರು", "ಇಪ್ಪತ್ತನಾಲ್ಕು", "ಇಪ್ಪತ್ತೈದು", "ಇಪ್ಪತ್ತಾರು", "ಇಪ್ಪತ್ತೇಳು",
  "ಇಪ್ಪತ್ತೆಂಟು", "ಇಪ್ಪತ್ತೊಂಬತ್ತು", "ಮೂವತ್ತು", "ಮೂವತ್ತೊಂದು", "ಮೂವತ್ತೆರಡು",
  "ಮೂವತ್ತಮೂರು", "ಮೂವತ್ತನಾಲ್ಕು", "ಮೂವತ್ತೈದು", "ಮೂವತ್ತಾರು", "ಮೂವತ್ತೇಳು",
  "ಮೂವತ್ತೆಂಟು", "ಮೂವತ್ತೊಂಬತ್ತು", "ನಲವತ್ತು", "ನಲವತ್ತೊಂದು", "ನಲವತ್ತೆರಡು",
  "ನಲವತ್ತಮೂರು", "ನಲವತ್ತನಾಲ್ಕು", "ನಲವತ್ತೈದು", "ನಲವತ್ತಾರು", "ನಲವತ್ತೇಳು",
  "ನಲವತ್ತೆಂಟು", "ನಲವತ್ತೊಂಬತ್ತು", "ಐವತ್ತು", "ಐವತ್ತೊಂದು", "ಐವತ್ತೆರಡು",
  "ಐವತ್ತಮೂರು", "ಐವತ್ತನಾಲ್ಕು", "ಐವತ್ತೈದು", "ಐವತ್ತಾರು", "ಐವತ್ತೇಳು",
  "ಐವತ್ತೆಂಟು", "ಐವತ್ತೊಂಬತ್ತು", "ಅರವತ್ತು", "ಅರವತ್ತೊಂದು", "ಅರವತ್ತೆರಡು",
  "ಅರವತ್ತಮೂರು", "ಅರವತ್ತನಾಲ್ಕು", "ಅರವತ್ತೈದು", "ಅರವತ್ತಾರು", "ಅರವತ್ತೇಳು",
  "ಅರವತ್ತೆಂಟು", "ಅರವತ್ತೊಂಬತ್ತು", "ಎಪ್ಪತ್ತು", "ಎಪ್ಪತ್ತೊಂದು", "ಎಪ್ಪತ್ತೆರಡು",
  "ಎಪ್ಪತ್ತಮೂರು", "ಎಪ್ಪತ್ತನಾಲ್ಕು", "ಎಪ್ಪತ್ತೈದು", "ಎಪ್ಪತ್ತಾರು", "ಎಪ್ಪತ್ತೇಳು",
  "ಎಪ್ಪತ್ತೆಂಟು", "ಎಪ್ಪತ್ತೊಂಬತ್ತು", "ಎಂಭತ್ತು", "ಎಂಭತ್ತೊಂದು", "ಎಂಭತ್ತೆರಡು",
  "ಎಂಭತ್ತಮೂರು", "ಎಂಭತ್ತನಾಲ್ಕು", "ಎಂಭತ್ತೈದು", "ಎಂಭತ್ತಾರು", "ಎಂಭತ್ತೇಳು",
  "ಎಂಭತ್ತೆಂಟು", "ಎಂಭತ್ತೊಂಬತ್ತು", "ತೊಂಬತ್ತು", "ತೊಂಬತ್ತೊಂದು", "ತೊಂಬತ್ತೆರಡು",
  "ತೊಂಬತ್ತಮೂರು", "ತೊಂಬತ್ತನಾಲ್ಕು", "ತೊಂಬತ್ತೈದು", "ತೊಂಬತ್ತಾರು", "ತೊಂಬತ್ತೇಳು",
  "ತೊಂಬತ್ತೆಂಟು", "ತೊಂಬತ್ತೊಂಬತ್ತು",
];

const cropAliases: Record<string, string[]> = {
  ajwan: ["ajwan", "ajwain", "ajvan", "अजवाइन", "ಓಮ"],
  "alasande gram": ["alasande gram", "alasand gram", "alasandhe", "लोबिया", "ಅಲಸಂದೆ ಕಾಳು"],
  "almond(badam)": ["almond(badam)", "almond badam", "almond", "badam", "बादाम", "ಬಾದಾಮಿ"],
  alsandikai: ["alsandikai", "alasandikai", "alsand kai", "लोबिया", "ಅಲಸಂದೆಕಾಯಿ"],
  amaranthus: ["amaranthus", "amaranth", "amaranths", "चौलाई", "ದಂಟಿನ ಸೊಪ್ಪು"],
  "ambady/mesta/patson": ["ambady", "ambadi", "mesta", "patson", "अंबाड़ी", "ಅಂಬಾಡಿ ಸೊಪ್ಪು"],
  "amla(nelli kai)": ["amla", "amla nelli", "nelli kai", "आंवला", "ನೆಲ್ಲಿಕಾಯಿ"],
  "amranthas red": ["amranthas red", "red amaranthus", "red amaranth", "लाल चौलाई", "ಕೆಂಪು ದಂಟಿನ ಸೊಪ್ಪು"],
  tomato: ["tomato", "tomatoes", "टमाटर", "ಟೊಮ್ಯಾಟೊ"],
};

function normalizeCropKey(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

const normalizedCropAliases = Object.fromEntries(
  Object.entries(cropAliases).map(([key, aliases]) => [normalizeCropKey(key), aliases]),
);

function editDistance(left: string, right: string): number {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const previous = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      diagonal = previous;
    }
  }
  return row[right.length];
}

function similarity(left: string, right: string): number {
  if (left === right) return 1;
  const length = Math.max(left.length, right.length);
  return length === 0 ? 1 : 1 - editDistance(left, right) / length;
}

function transcriptCandidates(transcript: string): string[] {
  const words = normalizeCropKey(transcript).split(" ").filter(Boolean);
  const candidates = new Set(words);
  for (let size = 2; size <= 3; size += 1) {
    for (let index = 0; index <= words.length - size; index += 1) {
      candidates.add(words.slice(index, index + size).join(" "));
    }
  }
  return [...candidates];
}

export function findCropInTranscript(crops: string[], transcript: string): string | undefined {
  const normalizedTranscript = normalizeCropKey(transcript);
  const exact = crops.find((crop) => {
    const key = normalizeCropKey(crop);
    const aliases = normalizedCropAliases[key] || [key];
    return aliases.some((alias) => normalizedTranscript.includes(normalizeCropKey(alias)));
  });
  if (exact) return exact;

  const candidates = transcriptCandidates(transcript);
  const matches = crops.map((crop) => {
    const key = normalizeCropKey(crop);
    const aliases = normalizedCropAliases[key] || [key];
    const score = Math.max(
      ...aliases
        .map((alias) => normalizeCropKey(alias))
        .filter((alias) => alias.length >= 4)
        .map((alias) => Math.max(...candidates.map((candidate) => similarity(candidate, alias)))),
      0,
    );
    return { crop, score };
  }).sort((left, right) => right.score - left.score);

  const best = matches[0];
  const second = matches[1];
  if (best && best.score >= 0.68 && (!second || best.score - second.score >= 0.04)) {
    console.info("[voice] fuzzy crop match", {
      transcript,
      crop: best.crop,
      score: Number(best.score.toFixed(2)),
    });
    return best.crop;
  }
  return undefined;
}

function integerWords(value: number, language: VoiceLanguage): string {
  const units = language === "hi" ? hindiUnits : kannadaUnits;
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) return String(value);
  if (value < 100) return units[value];
  if (value < 1000) {
    const hundreds = Math.floor(value / 100);
    const remainder = value % 100;
    const hundred = language === "hi" ? "सौ" : "ನೂರು";
    return `${units[hundreds]} ${hundred}${remainder ? ` ${integerWords(remainder, language)}` : ""}`;
  }
  if (value < 100000) {
    const thousands = Math.floor(value / 1000);
    const remainder = value % 1000;
    const thousand = language === "hi" ? "हज़ार" : "ಸಾವಿರ";
    return `${integerWords(thousands, language)} ${thousand}${remainder ? ` ${integerWords(remainder, language)}` : ""}`;
  }
  const lakhs = Math.floor(value / 100000);
  const remainder = value % 100000;
  const lakh = language === "hi" ? "लाख" : "ಲಕ್ಷ";
  return `${integerWords(lakhs, language)} ${lakh}${remainder ? ` ${integerWords(remainder, language)}` : ""}`;
}

export function numberWords(value: number, language: VoiceLanguage): string {
  if (language === "en" || !Number.isFinite(value)) return String(value);
  const [whole, fraction] = String(value).split(".");
  const result = integerWords(Number(whole), language);
  if (!fraction) return result;
  const fractionWords = fraction
    .split("")
    .map((digit) => integerWords(Number(digit), language))
    .join(" ");
  return `${result} ${language === "hi" ? "दशमलव" : "ದಶಮಾಂಶ"} ${fractionWords}`;
}

export function localizedMoney(value: number, language: VoiceLanguage): string {
  if (language === "en") return `₹${value}`;
  return `${numberWords(value, language)} ${language === "hi" ? "रुपये" : "ರೂಪಾಯಿ"}`;
}

export function localizedCrop(crop: string, language: VoiceLanguage): string {
  if (language === "en") return crop;
  const normalized = normalizeCropKey(crop);
  const translations: Record<string, { kn: string; hi: string }> = {
    ajwan: { kn: "ಓಮ", hi: "अजवाइन" },
    "alasande gram": { kn: "ಅಲಸಂದೆ ಕಾಳು", hi: "लोबिया" },
    "almond(badam)": { kn: "ಬಾದಾಮಿ", hi: "बादाम" },
    "almond (badam)": { kn: "ಬಾದಾಮಿ", hi: "बादाम" },
    alsandikai: { kn: "ಅಲಸಂದೆಕಾಯಿ", hi: "लोबिया" },
    amaranthus: { kn: "ದಂಟಿನ ಸೊಪ್ಪು", hi: "चौलाई" },
    "ambady/mesta/patson": { kn: "ಅಂಬಾಡಿ ಸೊಪ್ಪು", hi: "अंबाड़ी" },
    "amla(nelli kai)": { kn: "ನೆಲ್ಲಿಕಾಯಿ", hi: "आंवला" },
    "amranthas red": { kn: "ಕೆಂಪು ದಂಟಿನ ಸೊಪ್ಪು", hi: "लाल चौलाई" },
    tomato: { kn: "ಟೊಮ್ಯಾಟೊ", hi: "टमाटर" },
  };
  const translation = Object.entries(translations).find(([key]) => normalizeCropKey(key) === normalized)?.[1];
  return translation?.[language] || crop;
}

export function localizedCropList(crops: string[], language: VoiceLanguage): string {
  return crops.map((crop) => localizedCrop(crop, language)).join(", ");
}

export function normalizeVoiceLanguage(value: string): VoiceLanguage {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("kn")) return "kn";
  if (normalized.includes("hi")) return "hi";
  return "en";
}
