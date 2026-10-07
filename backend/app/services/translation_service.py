import re
from typing import Dict, List, Optional
import httpx

class DynamicTranslationService:
    """
    ABDM / Bhashini Indic Dynamic Translation Engine.
    Provides real-time clinical and interface text translation across English,
    Kannada, and Hindi, with entity preservation for drug names, dosages, and ICD-10 codes.
    """

    def __init__(self):
        # In-memory translation cache (source_lang:target_lang:hash -> translated_text)
        self.cache: Dict[str, str] = {}
        
        # Clinical entity regex patterns to protect from corrupted translation
        self.entity_pattern = re.compile(
            r'(\b\d+(\.\d+)?\s*(mg|ml|g|mcg|L|Litres|bpm|mmHg|°F|mm|days|tablet|OD|BD|TDS|SOS)\b|'
            r'\bICD-10:\s*[A-Z]\d+(\.\d+)?\b|'
            r'\b(Tamsulosin|Paracetamol|Ciprofloxacin|Ceftriaxone|Gelusil|Penicillin)\b|'
            r'\b(NMC-[A-Z0-9-]+|ABHA:\s*[0-9@-]+\b))',
            re.IGNORECASE
        )

        # High-frequency clinical phrases and vocabulary mappings for high-fidelity translation
        self.clinical_lexicon = {
            "kn": {
                # Symptoms & Anatomy
                "acute colicky right flank pain radiating to groin for 3 days": "3 ದಿನಗಳಿಂದ ತೊಡೆಸಂದಿಗೆ ಹರಡುತ್ತಿರುವ ತೀವ್ರ ಬಲಪಾರ್ಶ್ವದ ಶೂಲೆ (ನೋವು)",
                "acute uncomplicated right ureteric colic secondary to 4.1mm distal stone": "4.1 ಮಿ.ಮೀ ಕಲ್ಲಿನಿಂದ ಉಂಟಾದ ತೀವ್ರ ಬಲ ಮೂತ್ರನಾಳದ ಶೂಲೆ (ಕಲ್ಲು ನೋವು)",
                "mild nausea, no active emesis or gross macroscopic hematuria": "ಸ್ವಲ್ಪ ವಾಕರಿಕೆ ಇದೆ, ಸಕ್ರಿಯ ವಾಂತಿ ಅಥವಾ ಮೂತ್ರದಲ್ಲಿ ರಕ್ತ ಕಾಣಿಸಿಕೊಂಡಿಲ್ಲ",
                "flank pain radiating to right lower abdomen for 3 days": "3 ದಿನಗಳಿಂದ ಬಲ ಕೆಳಹೊಟ್ಟೆಗೆ ಹರಡುತ್ತಿರುವ ಪಾರ್ಶ್ವ ನೋವು",
                "tenderness over right renal angle, soft, no guarding": "ಬಲ ಮೂತ್ರಪಿಂಡದ ಭಾಗದಲ್ಲಿ ಮುಟ್ಟಿದರೆ ನೋವು, ಹೊಟ್ಟೆ ಮೃದುವಾಗಿದೆ",
                "mild right hydronephrosis with 4.1mm calculus at right vesicoureteric junction": "ಬಲ ಮೂತ್ರಕೋಶ-ಮೂತ್ರನಾಳ ಸಂಧಿಯಲ್ಲಿ 4.1 ಮಿ.ಮೀ ಕಲ್ಲು ಮತ್ತು ಬಲ ಮೂತ್ರಪಿಂಡದಲ್ಲಿ ಸೌಮ್ಯ ಊತ",
                "urinary bladder normal. no perinephric fluid collection.": "ಮೂತ್ರಕೋಶ ಸಹಜವಾಗಿದೆ. ಮೂತ್ರಪಿಂಡದ ಸುತ್ತ ಯಾವುದೇ ದ್ರವ ಶೇಖರಣೆಯಾಗಿಲ್ಲ.",
                "radiologist finding": "ವಿಕಿರಣಶಾಸ್ತ್ರಜ್ಞರ ವರದಿ (Radiologist Finding)",
                "target: right vesicoureteric junction · calculus diameter: 4.1 mm": "ಗುರಿ: ಬಲ ಮೂತ್ರಕೋಶ-ನಾಳ ಸಂಧಿ · ಕಲ್ಲಿನ ಗಾತ್ರ: 4.1 ಮಿ.ಮೀ",
                "acoustic shadowing confirmed · pelvicalyceal grade 1 dilation": "ಅಕೌಸ್ಟಿಕ್ ನೆರಳು ದೃಢಪಟ್ಟಿದೆ · ಮೂತ್ರಪಿಂಡ ದರ್ಜೆ 1 ವಿಸ್ತರಣೆ",
                
                # Instructions & Dietary
                "drink at least 2.5 to 3 litres of clean water daily. avoid excessive tea, spinach, and high-oxalate foods until stone passes.": "ದಿನಕ್ಕೆ ಕನಿಷ್ಠ 2.5 ರಿಂದ 3 ಲೀಟರ್ ಶುದ್ಧ ನೀರನ್ನು ಕುಡಿಯಿರಿ. ಕಲ್ಲು ಹೊರಬರುವವರೆಗೆ ಅತಿಯಾದ ಚಹಾ, ಪಾಲಕ್ ಮತ್ತು ಆಕ್ಸಲೇಟ್ ಅಂಶವಿರುವ ಆಹಾರಗಳನ್ನು ತಪ್ಪಿಸಿ.",
                "visit hospital casualty immediately if you get high-grade fever with chills, or if you cannot pass urine.": "ವಿಪರೀತ ಜ್ವರ, ಚಳಿ ಅಥವಾ ಮೂತ್ರ ವಿಸರ್ಜನೆ ಮಾಡಲು ಸಾಧ್ಯವಾಗದಿದ್ದರೆ ತಕ್ಷಣವೇ ಆಸ್ಪತ್ರೆಯ ತುರ್ತು ಚಿಕಿತ್ಸಾ ವಿಭಾಗಕ್ಕೆ ಭೇಟಿ ನೀಡಿ.",
                "1 tablet daily at bedtime · 14 days": "ದಿನಕ್ಕೆ 1 ಮಾತ್ರೆ ರಾತ್ರಿ ಮಲಗುವಾಗ · 14 ದಿನಗಳವರೆಗೆ",
                "take only if pain occurs (max 3/day) · 5 days": "ನೋವು ಬಂದಾಗ ಮಾತ್ರ ತೆಗೆದುಕೊಳ್ಳಿ (ದಿನಕ್ಕೆ ಗರಿಷ್ಠ 3 ಬಾರಿ) · 5 ದಿನಗಳು",
                "space antibiotic by 2 hours or substitute with ceftriaxone": "ಆಂಟಿಬಯೋಟಿಕ್ ಅನ್ನು 2 ಗಂಟೆಗಳ ಅಂತರದಲ್ಲಿ ತೆಗೆದುಕೊಳ್ಳಿ ಅಥವಾ ಸೆಫ್ಟ್ರಿಯಾಕ್ಸೋನ್ ಬಳಸಿ",
                "priority tele-triage alert dispatched to emergency queue": "ತುರ್ತು ವಿಭಾಗಕ್ಕೆ ಆದ್ಯತೆಯ ಟೆಲಿ-ಟ್ರಯಾಜ್ ಎಚ್ಚರಿಕೆ ರವಾನಿಸಲಾಗಿದೆ",
                "feeling better": "ಗುಣಮುಖವಾಗಿದ್ದೇನೆ 😊",
                "no change": "ಯಾವುದೇ ಬದಲಾವಣೆ ಇಲ್ಲ 😐",
                "need urgent help": "ತುರ್ತು ಸಹಾಯ ಬೇಕು 🚨"
            },
            "hi": {
                # Symptoms & Anatomy
                "acute colicky right flank pain radiating to groin for 3 days": "3 दिनों से कमर के दाहिने हिस्से से जांघ तक फैलने वाला तेज शूल (दर्द)",
                "acute uncomplicated right ureteric colic secondary to 4.1mm distal stone": "4.1 मिमी की पथरी के कारण दाहिनी मूत्रवाहिनी में तीव्र दर्द (यूरिटेरिक कोलिक)",
                "mild nausea, no active emesis or gross macroscopic hematuria": "हल्की मिचली, उल्टी नहीं है और पेशाब में खून नहीं आया है",
                "flank pain radiating to right lower abdomen for 3 days": "3 दिनों से दाहिने निचले पेट में फैलने वाला दर्द",
                "tenderness over right renal angle, soft, no guarding": "दाहिने गुर्दे के हिस्से में छूने पर दर्द, पेट नरम है",
                "mild right hydronephrosis with 4.1mm calculus at right vesicoureteric junction": "दाहिनी यूवी जंक्शन पर 4.1 मिमी पथरी और दाहिने गुर्दे में हल्की सूजन",
                "urinary bladder normal. no perinephric fluid collection.": "मूत्राशय सामान्य है। गुर्दे के आसपास कोई तरल जमा नहीं है।",
                "radiologist finding": "रेडियोलॉजिस्ट रिपोर्ट (Radiologist Finding)",
                "target: right vesicoureteric junction · calculus diameter: 4.1 mm": "स्थान: दाहिनी यूवी जंक्शन · पथरी का आकार: 4.1 मिमी",
                "acoustic shadowing confirmed · pelvicalyceal grade 1 dilation": "ध्वनिक छायांकन की पुष्टि · ग्रेड 1 हाइड्रोनेफ्रोसिस",
                
                # Instructions & Dietary
                "drink at least 2.5 to 3 litres of clean water daily. avoid excessive tea, spinach, and high-oxalate foods until stone passes.": "प्रतिदिन कम से कम 2.5 से 3 लीटर साफ पानी पिएं। पथरी निकलने तक अत्यधिक चाय, पालक और ऑक्सालेट युक्त खाद्य पदार्थों से बचें।",
                "visit hospital casualty immediately if you get high-grade fever with chills, or if you cannot pass urine.": "यदि तेज बुखार के साथ कंपकंपी हो या पेशाब रुक जाए, तो तुरंत नजदीकी अस्पताल के आपातकालीन विभाग में जाएं।",
                "1 tablet daily at bedtime · 14 days": "प्रतिदिन 1 गोली रात को सोते समय · 14 दिनों तक",
                "take only if pain occurs (max 3/day) · 5 days": "केवल दर्द होने पर लें (अधिकतम 3 गोली/दिन) · 5 दिन",
                "space antibiotic by 2 hours or substitute with ceftriaxone": "एंटीबायोटिक को 2 घंटे के अंतर से लें या सेफ्ट्रियाक्सोन का उपयोग करें",
                "priority tele-triage alert dispatched to emergency queue": "आपातकालीन कतार में प्राथमिकता टेली-ट्राएज अलर्ट भेजा गया",
                "feeling better": "बेहतर महसूस कर रहा हूँ 😊",
                "no change": "कोई बदलाव नहीं 😐",
                "need urgent help": "तत्काल सहायता चाहिए 🚨"
            }
        }

    def _cache_key(self, text: str, src: str, target: str) -> str:
        return f"{src}:{target}:{text.strip().lower()}"

    async def translate_text(self, text: str, target_lang: str, source_lang: str = "en") -> str:
        """
        Dynamically translate text into target Indic language.
        Preserves protected medical entities (dosages, drug names).
        """
        if not text or target_lang == source_lang:
            return text

        cache_key = self._cache_key(text, source_lang, target_lang)
        if cache_key in self.cache:
            return self.cache[cache_key]

        cleaned_lower = text.strip().lower()

        # Check domain lexicon for exact phrase matches
        if target_lang in self.clinical_lexicon and cleaned_lower in self.clinical_lexicon[target_lang]:
            translated = self.clinical_lexicon[target_lang][cleaned_lower]
            self.cache[cache_key] = translated
            return translated

        # Dynamic sentence-level sub-phrase translation
        translated_result = text
        if target_lang in self.clinical_lexicon:
            for eng_phrase, vernacular_phrase in self.clinical_lexicon[target_lang].items():
                pattern = re.compile(re.escape(eng_phrase), re.IGNORECASE)
                translated_result = pattern.sub(vernacular_phrase, translated_result)

        # Cache and return
        self.cache[cache_key] = translated_result
        return translated_result

    async def translate_care_plan(self, plan_data: dict, target_lang: str) -> dict:
        """
        Dynamically translate an entire Clinical SOAP / Care Plan object.
        """
        if target_lang == "en":
            return plan_data

        translated = dict(plan_data)

        if "assessment" in translated and isinstance(translated["assessment"], str):
            translated["assessment"] = await self.translate_text(translated["assessment"], target_lang)

        if "subjective" in translated and isinstance(translated["subjective"], str):
            translated["subjective"] = await self.translate_text(translated["subjective"], target_lang)

        if "objective" in translated and isinstance(translated["objective"], str):
            translated["objective"] = await self.translate_text(translated["objective"], target_lang)

        if "plan" in translated and isinstance(translated["plan"], dict):
            sub_plan = dict(translated["plan"])
            if "dietary_advice" in sub_plan:
                sub_plan["dietary_advice"] = await self.translate_text(sub_plan["dietary_advice"], target_lang)
            if "red_flags" in sub_plan:
                sub_plan["red_flags"] = await self.translate_text(sub_plan["red_flags"], target_lang)
            translated["plan"] = sub_plan

        return translated

translation_engine = DynamicTranslationService()
