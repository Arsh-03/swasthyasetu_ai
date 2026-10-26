"""
Clinical lexicon for the AI IntelliSense notepad.

Single source of truth for:
  - TERMS: Tier 1 prefix-completion vocabulary (drugs, symptoms, findings, diagnoses, tests, phrases)
  - SHORTHAND: Tier 2 deterministic shorthand expansions (token and regex based)
  - PUNCTUATION_RULES: vitals / sentence formatting rules
  - SECTION_HEADINGS: note heading patterns used for context detection
  - NOMENCLATURE: colloquial -> standard terminology concepts with context hints

The browser fetches this via GET /api/v1/intellisense/lexicon and runs Tier 1/2 locally.
Regex patterns are written to be valid in both Python `re` and JavaScript; replacements use `$1` syntax.

NOTE: Codes are seeded from docs/07_ai_intellisense_feature and must be reviewed by a
clinical terminologist before production use.
"""
from typing import Any, Dict, List

SNOMED = "SNOMED_CT"
ICD10 = "ICD_10"
LOINC = "LOINC"


def _c(system: str, code: str, display: str = "") -> Dict[str, str]:
    return {"system": system, "code": code, "display": display}


# ---------------------------------------------------------------------------
# Tier 1: prefix-completion vocabulary
# weight: 0-100 ranking prior. codes: optional standard codes attached on accept.
# ---------------------------------------------------------------------------
def _terms(category: str, weight: int, items: List[Any]) -> List[Dict[str, Any]]:
    out = []
    for item in items:
        if isinstance(item, tuple):
            text, codes = item
        else:
            text, codes = item, []
        out.append({"text": text, "category": category, "weight": weight, "codes": codes})
    return out


TERMS: List[Dict[str, Any]] = (
    _terms("drug", 70, [
        "Paracetamol 500mg", "Paracetamol 650mg", "Ibuprofen 400mg", "Diclofenac 50mg",
        "Aspirin 75mg", "Clopidogrel 75mg", "Atorvastatin 10mg", "Atorvastatin 40mg",
        "Rosuvastatin 10mg", "Sorbitrate 5mg sublingual", "Isosorbide Mononitrate 30mg",
        "Metoprolol 25mg", "Amlodipine 5mg", "Telmisartan 40mg", "Losartan 50mg",
        "Ramipril 5mg", "Enalapril 5mg", "Hydrochlorothiazide 12.5mg", "Furosemide 40mg",
        "Spironolactone 25mg", "Metformin 500mg", "Metformin 1000mg", "Glimepiride 1mg",
        "Gliclazide 80mg", "Sitagliptin 100mg", "Dapagliflozin 10mg", "Insulin Glargine",
        "Levothyroxine 50mcg", "Pantoprazole 40mg", "Omeprazole 20mg", "Domperidone 10mg",
        "Ondansetron 4mg", "Drotaverine 80mg", "Dicyclomine 20mg", "Loperamide 2mg",
        "Lactulose syrup", "Oral Rehydration Salts (ORS)", "Amoxicillin 500mg",
        "Amoxicillin-Clavulanate 625mg", "Azithromycin 500mg", "Cefixime 200mg",
        "Ciprofloxacin 500mg", "Doxycycline 100mg", "Metronidazole 400mg",
        "Albendazole 400mg", "Fluconazole 150mg", "Cetirizine 10mg", "Levocetirizine 5mg",
        "Montelukast 10mg", "Salbutamol inhaler", "Budesonide inhaler", "Prednisolone 10mg",
        "Tamsulosin 0.4mg", "Cinnarizine 25mg", "Betahistine 16mg", "Prochlorperazine 5mg",
        "Vitamin D3 60000 IU", "Calcium carbonate 500mg", "Ferrous sulphate with folic acid",
    ])
    + _terms("symptom", 60, [
        "chest pain", "chest tightness", "breathlessness", "shortness of breath",
        "palpitations", "headache", "fever", "dry cough", "productive cough", "sore throat",
        "abdominal pain", "epigastric pain", "nausea", "vomiting", "diarrhoea", "constipation",
        "burning micturition", "dysuria", "haematuria", "flank pain", "giddiness", "vertigo",
        "syncope", "fatigue", "weight loss", "loss of appetite", "joint pain",
        "skin rash", "itching", "pedal oedema", "diaphoresis",
    ])
    + _terms("finding", 55, [
        "afebrile", "tachycardia", "bradycardia", "pallor", "icterus", "cyanosis", "clubbing",
        "lymphadenopathy", "per abdomen soft and non-tender", "guarding", "rigidity",
        "bilateral air entry equal", "wheeze", "crepitations", "S1 S2 heard, no murmur",
        "conscious and oriented", "pupils equal and reactive to light",
        "renal angle tenderness",
    ])
    + _terms("diagnosis", 65, [
        ("Type 2 Diabetes Mellitus", [_c(SNOMED, "44054006", "Type 2 diabetes mellitus"), _c(ICD10, "E11.9")]),
        ("Essential Hypertension", [_c(SNOMED, "59621000", "Essential hypertension"), _c(ICD10, "I10")]),
        ("Acute Coronary Syndrome", [_c(ICD10, "I24.9")]),
        ("Acute Myocardial Infarction", [_c(SNOMED, "22298006", "Myocardial infarction"), _c(ICD10, "I21.9")]),
        ("Unstable Angina", [_c(ICD10, "I20.0")]),
        ("ST-Elevation Myocardial Infarction", [_c(ICD10, "I21.3")]),
        ("Non-ST Elevation Myocardial Infarction", [_c(ICD10, "I21.4")]),
        ("Bronchial Asthma", [_c(SNOMED, "195967001", "Asthma"), _c(ICD10, "J45.9")]),
        ("Chronic Obstructive Pulmonary Disease", [_c(ICD10, "J44.9")]),
        ("Community-acquired Pneumonia", [_c(ICD10, "J18.9")]),
        ("Gastroesophageal Reflux Disease", [_c(SNOMED, "235595009", "GERD"), _c(ICD10, "K21.9")]),
        ("Gastritis", [_c(ICD10, "K29.7")]),
        ("Acute Gastroenteritis", [_c(ICD10, "A09")]),
        ("Urinary Tract Infection", [_c(ICD10, "N39.0")]),
        ("Ureteric Calculus", [_c(ICD10, "N20.1")]),
        ("Migraine", [_c(ICD10, "G43.9")]),
        ("Tension-type Headache", [_c(ICD10, "G44.2")]),
        ("Hypothyroidism", [_c(SNOMED, "40930008", "Hypothyroidism"), _c(ICD10, "E03.9")]),
        ("Iron Deficiency Anaemia", [_c(ICD10, "D50.9")]),
        ("Dengue Fever", [_c(ICD10, "A90")]),
        ("Malaria", [_c(ICD10, "B54")]),
        ("Typhoid Fever", [_c(ICD10, "A01.0")]),
        ("Diabetic Ketoacidosis", []),
    ])
    + _terms("investigation", 60, [
        ("ECG", [_c(LOINC, "11524-6", "EKG study")]),
        ("Troponin I", [_c(LOINC, "10839-9", "Troponin I")]),
        ("Complete Blood Count", [_c(LOINC, "58410-2", "CBC panel")]),
        ("HbA1c", [_c(LOINC, "4548-4", "Hemoglobin A1c")]),
        ("Fasting Blood Glucose", [_c(LOINC, "1558-6", "Fasting glucose")]),
        ("Lipid Profile", [_c(LOINC, "24331-1", "Lipid panel")]),
        ("Serum Creatinine", [_c(LOINC, "2160-0", "Creatinine")]),
        ("TSH", [_c(LOINC, "3016-3", "Thyrotropin")]),
        "Liver Function Test", "Urine routine and microscopy", "Chest X-ray PA view",
        "USG abdomen and pelvis", "2D Echocardiography", "Dengue NS1 antigen",
    ])
    + _terms("phrase", 40, [
        "since morning", "radiating to left arm", "radiating to groin", "on room air",
        "after meals", "before meals", "as needed (SOS)", "review after 3 days",
        "advised emergency referral", "referred to District Hospital", "no known drug allergies",
        "known case of", "compliant with medication",
    ])
)

# ---------------------------------------------------------------------------
# Extended vocabulary (common Indian primary-care presentations).
# ICD-10 codes are WHO ICD-10 and, like the rest of this file, need terminologist review.
# ---------------------------------------------------------------------------
TERMS += (
    _terms("diagnosis", 65, [
        ("Pneumonia", [_c(ICD10, "J18.9", "Pneumonia, unspecified")]),
        ("Hypertension", [_c(SNOMED, "59621000", "Essential hypertension"), _c(ICD10, "I10")]),
        ("Type 1 Diabetes Mellitus", [_c(ICD10, "E10.9")]),
        ("Acute Bronchitis", [_c(ICD10, "J20.9")]),
        ("Upper Respiratory Tract Infection", [_c(ICD10, "J06.9")]),
        ("Acute Pharyngitis", [_c(ICD10, "J02.9")]),
        ("Acute Tonsillitis", [_c(ICD10, "J03.9")]),
        ("Acute Sinusitis", [_c(ICD10, "J01.9")]),
        ("Allergic Rhinitis", [_c(ICD10, "J30.4")]),
        ("Influenza", [_c(ICD10, "J11.1")]),
        ("COVID-19", [_c(ICD10, "U07.1")]),
        ("Pulmonary Tuberculosis", []),
        ("Anaemia", [_c(ICD10, "D64.9")]),
        ("Hyperthyroidism", [_c(ICD10, "E05.9")]),
        ("Obesity", [_c(ICD10, "E66.9")]),
        ("Dyslipidaemia", [_c(ICD10, "E78.5")]),
        ("Vitamin D Deficiency", [_c(ICD10, "E55.9")]),
        ("Vitamin B12 Deficiency", [_c(ICD10, "E53.8")]),
        ("Dehydration", [_c(ICD10, "E86")]),
        ("Hypokalaemia", [_c(ICD10, "E87.6")]),
        ("Chronic Kidney Disease", [_c(ICD10, "N18.9")]),
        ("Acute Kidney Injury", [_c(ICD10, "N17.9")]),
        ("Acute Pyelonephritis", [_c(ICD10, "N10")]),
        ("Benign Prostatic Hyperplasia", [_c(ICD10, "N40")]),
        ("Heart Failure", [_c(ICD10, "I50.9")]),
        ("Atrial Fibrillation", [_c(ICD10, "I48.9")]),
        ("Stroke", [_c(ICD10, "I64")]),
        ("Transient Ischaemic Attack", [_c(ICD10, "G45.9")]),
        ("Epilepsy", [_c(ICD10, "G40.9")]),
        ("Seizure", [_c(ICD10, "R56.8")]),
        ("Depression", [_c(ICD10, "F32.9")]),
        ("Anxiety Disorder", [_c(ICD10, "F41.9")]),
        ("Insomnia", [_c(ICD10, "G47.0")]),
        ("Osteoarthritis", [_c(ICD10, "M19.9")]),
        ("Rheumatoid Arthritis", [_c(ICD10, "M06.9")]),
        ("Gout", [_c(ICD10, "M10.9")]),
        ("Low Back Pain", [_c(ICD10, "M54.5")]),
        ("Peptic Ulcer Disease", [_c(ICD10, "K27.9")]),
        ("Irritable Bowel Syndrome", [_c(ICD10, "K58.9")]),
        ("Acute Appendicitis", [_c(ICD10, "K37")]),
        ("Cholecystitis", [_c(ICD10, "K81.9")]),
        ("Cholelithiasis", [_c(ICD10, "K80.2")]),
        ("Fatty Liver", [_c(ICD10, "K76.0")]),
        ("Chronic Hepatitis B", [_c(ICD10, "B18.1")]),
        ("Cellulitis", [_c(ICD10, "L03.9")]),
        ("Scabies", [_c(ICD10, "B86")]),
        ("Dermatophytosis", [_c(ICD10, "B35.9")]),
        ("Dermatitis", [_c(ICD10, "L30.9")]),
        ("Psoriasis", [_c(ICD10, "L40.9")]),
        ("Urticaria", [_c(ICD10, "L50.9")]),
        ("Conjunctivitis", [_c(ICD10, "H10.9")]),
        ("Otitis Media", [_c(ICD10, "H66.9")]),
        ("Cataract", [_c(ICD10, "H26.9")]),
        ("Chikungunya", [_c(ICD10, "A92.0")]),
        ("Leptospirosis", [_c(ICD10, "A27.9")]),
        ("Scrub Typhus", [_c(ICD10, "A75.3")]),
        ("Sepsis", [_c(ICD10, "A41.9")]),
    ])
    + _terms("symptom", 60, [
        "cough", "cold", "runny nose", "nasal congestion", "sneezing", "body ache", "myalgia", "chills",
        "rigors", "night sweats", "wheezing", "haemoptysis", "chest discomfort", "orthopnoea",
        "paroxysmal nocturnal dyspnoea", "dizziness", "blurred vision", "numbness", "tingling",
        "generalised weakness", "slurred speech", "confusion", "loss of consciousness",
        "abdominal distension", "bloating", "heartburn", "indigestion", "dysphagia", "haematemesis",
        "melaena", "jaundice", "dark coloured urine", "increased frequency of micturition", "urgency",
        "nocturia", "decreased urine output", "swelling of feet", "joint swelling", "morning stiffness",
        "neck pain", "knee pain", "shoulder pain", "pruritus", "hair loss", "weight gain",
        "excessive thirst", "polyuria", "low mood", "sleep disturbance", "ear pain", "ear discharge",
        "toothache", "redness of eyes", "watering of eyes", "hoarseness of voice", "difficulty in breathing",
        "pain in abdomen", "burning sensation while passing urine", "loose stools", "high grade fever",
        "low grade fever", "fever with chills", "fatigue and tiredness",
    ])
    + _terms("finding", 55, [
        "pulse regular", "bilateral pedal oedema", "crepitations at lung bases", "decreased breath sounds",
        "bronchial breathing", "hepatomegaly", "splenomegaly", "tenderness in right iliac fossa",
        "tenderness in right hypochondrium", "Murphy's sign positive", "bowel sounds present", "dehydrated",
        "well hydrated", "febrile", "tachypnoea", "oriented to time, place and person",
        "no focal neurological deficit", "neck stiffness", "throat congested", "tonsils enlarged",
        "chest clear", "air entry bilaterally equal", "no pallor, icterus, cyanosis or clubbing",
    ])
    + _terms("drug", 70, [
        "Cefuroxime 500mg", "Ceftriaxone 1g injection", "Levofloxacin 500mg", "Nitrofurantoin 100mg",
        "Oseltamivir 75mg", "Acyclovir 400mg", "Fexofenadine 120mg", "Chlorpheniramine 4mg", "Ambroxol syrup",
        "Dextromethorphan syrup", "Levosalbutamol inhaler", "Ipratropium inhaler", "Tiotropium inhaler",
        "Formoterol-Budesonide inhaler", "Rabeprazole 20mg", "Esomeprazole 40mg", "Famotidine 20mg",
        "Sucralfate syrup", "Ursodeoxycholic acid 300mg", "Mebeverine 135mg", "Bisacodyl 5mg",
        "Racecadotril 100mg", "Probiotic sachet", "Zinc sulphate 20mg", "Aceclofenac 100mg", "Naproxen 250mg",
        "Etoricoxib 90mg", "Tramadol 50mg", "Pregabalin 75mg", "Gabapentin 300mg", "Amitriptyline 10mg",
        "Sertraline 50mg", "Escitalopram 10mg", "Clonazepam 0.5mg", "Methylcobalamin 1500mcg", "Folic acid 5mg",
        "Thiamine 100mg", "Bisoprolol 5mg", "Carvedilol 6.25mg", "Atenolol 50mg", "Cilnidipine 10mg",
        "Olmesartan 20mg", "Torsemide 10mg", "Digoxin 0.25mg", "Warfarin", "Apixaban 5mg", "Rivaroxaban",
        "Enoxaparin injection", "Nitroglycerin sublingual", "Insulin Regular", "Insulin Aspart",
        "Pioglitazone 15mg", "Vildagliptin 50mg", "Empagliflozin 10mg", "Voglibose 0.2mg", "Carbimazole 5mg",
        "Allopurinol 100mg", "Febuxostat 40mg", "Colchicine 0.5mg", "Hydroxychloroquine 200mg",
        "Methylprednisolone", "Hydrocortisone", "Mometasone cream", "Clotrimazole cream", "Terbinafine cream",
        "Itraconazole 100mg", "Permethrin cream", "Mupirocin ointment", "Fusidic acid cream", "Calamine lotion",
        "Artemether-Lumefantrine", "Chloroquine", "Primaquine", "Isoniazid", "Rifampicin", "Ethambutol",
        "Pyrazinamide", "Ofloxacin 200mg",
    ])
    + _terms("investigation", 60, [
        "Serum Electrolytes", "Blood Urea", "Kidney Function Test", "Thyroid Profile", "Urine Culture",
        "Blood Culture", "Sputum AFB", "Peripheral Smear for Malaria", "Widal Test", "Dengue IgM",
        "C-Reactive Protein", "ESR", "Serum Uric Acid", "Vitamin D levels", "Vitamin B12 levels",
        "Random Blood Sugar", "Post-prandial Blood Sugar", "Chest X-ray", "CT Brain", "MRI Brain",
        "Ultrasound Abdomen",
    ])
    + _terms("phrase", 45, [
        "patient is suffering from", "patient presents with", "patient presented with", "patient complains of",
        "patient came with complaints of", "patient is a known case of", "patient was advised to",
        "patient has been advised to", "patient is on", "patient is stable", "patient denies",
        "patient reports", "patient is conscious and oriented", "patient is afebrile",
        "history of present illness", "no history of", "no significant past history", "family history of",
        "on examination", "general condition fair", "general condition stable", "vitals stable",
        "systemic examination", "advised to continue same medication", "advised to follow up",
        "plan to", "refer to", "provisional diagnosis", "differential diagnosis", "complaints of",
        "for the past", "associated with", "not associated with", "aggravated by", "relieved by",
        "radiating to", "on and off", "gradual in onset", "sudden in onset", "progressive in nature",
        "intermittent in nature", "continuous in nature", "productive cough with", "tablets as prescribed",
        "drink plenty of fluids", "take adequate rest", "avoid oily and spicy food",
        "return immediately if symptoms worsen", "teleconsultation done over video call",
        "consent taken for teleconsultation",
    ])
)

# Frequent English and clinical-narrative words that spell-check must never "correct".
COMMON_WORDS: List[str] = """
about above across after again against along among another anything around because before behind below
better between both brother called cannot children could daily denies doctor drink during each eating
either every everything evening family father feeling feels first follow further given going having
husband however itself known later little looks making maybe might months morning mother never night
nothing noted other others perhaps place please previous quite rather really recent recently reports
right second seems several should sister since sleep small something states still stopped started taking
taken their there these thing things third those three through times today tomorrow twice thrice under
unknown until usual usually walking water weeks weight where which while within without working would
years yesterday young patient patients history present presents presented complains complaint
complaints suffering advised normal severe moderate hours during condition symptoms treatment medicine
medicines tablet tablets hospital clinic onset sudden gradual progressive associated radiating relieved
aggravated worse improved similar current currently significant relevant stable unstable general
consultation video phone examination investigation review sweating fever never fewer level levels
""".split()


# ---------------------------------------------------------------------------
# Tier 2: shorthand expansion
# ---------------------------------------------------------------------------
SHORTHAND: List[Dict[str, Any]] = [
    {"abbr": "pt", "expansion": "Patient", "category": "general"},
    {"abbr": "c/o", "expansion": "complaining of", "category": "history"},
    {"abbr": "h/o", "expansion": "history of", "category": "history"},
    {"abbr": "k/c/o", "expansion": "known case of", "category": "history"},
    {"abbr": "o/e", "expansion": "On examination:", "category": "exam"},
    {"abbr": "r/o", "expansion": "rule out", "category": "assessment"},
    {"abbr": "s/s", "expansion": "soft and non-tender", "category": "exam"},
    {"abbr": "per abd", "expansion": "per abdomen", "category": "exam"},
    {"abbr": "cst", "expansion": "chest", "category": "anatomy"},
    {"abbr": "pn", "expansion": "pain", "category": "symptom"},
    {"abbr": "sob", "expansion": "shortness of breath", "category": "symptom"},
    {"abbr": "afeb", "expansion": "afebrile", "category": "exam"},
    {"abbr": "stbl", "expansion": "stable", "category": "exam"},
    {"abbr": "nad", "expansion": "no abnormality detected", "category": "exam"},
    {"abbr": "htn", "expansion": "Hypertension", "category": "diagnosis",
     "codes": [_c(SNOMED, "59621000", "Essential hypertension"), _c(ICD10, "I10")]},
    {"abbr": "dm2", "expansion": "Type 2 Diabetes Mellitus", "category": "diagnosis",
     "codes": [_c(SNOMED, "44054006", "Type 2 diabetes mellitus"), _c(ICD10, "E11.9")]},
    {"abbr": "t2dm", "expansion": "Type 2 Diabetes Mellitus", "category": "diagnosis",
     "codes": [_c(SNOMED, "44054006", "Type 2 diabetes mellitus"), _c(ICD10, "E11.9")]},
    {"abbr": "copd", "expansion": "Chronic Obstructive Pulmonary Disease", "category": "diagnosis",
     "codes": [_c(ICD10, "J44.9")]},
    {"abbr": "uti", "expansion": "Urinary Tract Infection", "category": "diagnosis",
     "codes": [_c(ICD10, "N39.0")]},
    {"abbr": "dka", "expansion": "Diabetic Ketoacidosis", "category": "diagnosis"},
    {"abbr": "acs", "expansion": "Acute Coronary Syndrome", "category": "diagnosis",
     "codes": [_c(ICD10, "I24.9")]},
    {"abbr": "stemi", "expansion": "ST-Elevation Myocardial Infarction", "category": "diagnosis",
     "codes": [_c(ICD10, "I21.3")]},
    {"abbr": "pcm", "expansion": "Paracetamol", "category": "drug"},
    {"abbr": "sos", "expansion": "as needed (SOS)", "category": "plan"},
    {"abbr": "od", "expansion": "once daily", "category": "plan"},
    {"abbr": "bd", "expansion": "twice daily", "category": "plan"},
    {"abbr": "tid", "expansion": "thrice daily", "category": "plan"},
    {"abbr": "tds", "expansion": "thrice daily", "category": "plan"},
    {"abbr": "qid", "expansion": "four times daily", "category": "plan"},
    {"abbr": "hs", "expansion": "at bedtime", "category": "plan"},
    {"abbr": "pc", "expansion": "after meals", "category": "plan"},
    {"abbr": "ac", "expansion": "before meals", "category": "plan"},
    {"abbr": "tab", "expansion": "Tab.", "category": "plan"},
    {"abbr": "inj", "expansion": "Inj.", "category": "plan"},
]

# Regex shorthand (durations). Applied when the token(s) before the cursor match.
SHORTHAND_PATTERNS: List[Dict[str, str]] = [
    {"pattern": r"\bx\s?(\d+)\s?d\b", "replacement": "for $1 days", "flags": "i"},
    {"pattern": r"\bx\s?(\d+)\s?w\b", "replacement": "for $1 weeks", "flags": "i"},
    {"pattern": r"\bx\s?(\d+)\s?h\b", "replacement": "for $1 hours", "flags": "i"},
]


# ---------------------------------------------------------------------------
# Clinical auto-punctuation (vitals + demographics). Applied on space/Enter to the
# text just typed, and to the whole note via "Format note".
# ---------------------------------------------------------------------------
PUNCTUATION_RULES: List[Dict[str, str]] = [
    {"pattern": r"\b(?:bp|blood pressure)[ \t]*[:=]?[ \t]*(\d{2,3})[/ \t](\d{2,3})(?!\d)(?![ \t]*mmhg)",
     "replacement": "BP: $1/$2 mmHg", "flags": "i", "category": "vitals"},
    {"pattern": r"\b(?:pulse|pr|hr)[ \t]*[:=]?[ \t]*(\d{2,3})(?!\d)(?![ \t]*bpm)",
     "replacement": "Pulse: $1 bpm", "flags": "i", "category": "vitals"},
    # Never add facts the doctor didn't write (e.g. "on room air"): formatting only.
    {"pattern": r"\b(?:spo2|o2 sat)[ \t]*[:=]?[ \t]*(\d{2,3})[ \t]*%?(?![\d%])",
     "replacement": "SpO2: $1%", "flags": "i", "category": "vitals"},
    {"pattern": r"\b(?:temp(?:erature)?|t)[ \t]*[:=]?[ \t]*(\d{2,3}(?:\.\d)?)[ \t]*(?:°|deg(?:ree)?s?)?[ \t]*(?:c|celsius)(?![\w°])",
     "replacement": "Temp: $1 °C", "flags": "i", "category": "vitals"},
    {"pattern": r"\b(?:temp(?:erature)?|t)[ \t]*[:=]?[ \t]*(\d{2,3}(?:\.\d)?)[ \t]*(?:°|deg(?:ree)?s?)?[ \t]*(?:f|fahrenheit)(?![\w°])",
     "replacement": "Temp: $1 °F", "flags": "i", "category": "vitals"},
    {"pattern": r"(?<![\w.])(\d{2,3}(?:\.\d)?)[ \t]*(?:°|deg(?:ree)?s?)[ \t]*c(?![\w°])",
     "replacement": "$1 °C", "flags": "i", "category": "vitals"},
    {"pattern": r"\b(?:rr|resp rate)[ \t]*[:=]?[ \t]*(\d{1,2})(?!\d)(?![ \t]*/min)",
     "replacement": "RR: $1/min", "flags": "i", "category": "vitals"},
    {"pattern": r"\b(?:pt|patient)[ \t]+(\d{1,3})[ \t]*(?:y|yo|yrs?)?[ \t]*(?:m|male)\b",
     "replacement": "Patient is a $1-year-old male", "flags": "i", "category": "demographics"},
    {"pattern": r"\b(?:pt|patient)[ \t]+(\d{1,3})[ \t]*(?:y|yo|yrs?)?[ \t]*(?:f|female)\b",
     "replacement": "Patient is a $1-year-old female", "flags": "i", "category": "demographics"},
]


# ---------------------------------------------------------------------------
# Note section headings -> clinical context
# ---------------------------------------------------------------------------
SECTION_HEADINGS: List[Dict[str, str]] = [
    {"pattern": r"^\s*(?:allerg(?:y|ies)|drug allerg(?:y|ies)|current (?:medications?|meds)|drug history|family history|social history)\b[^:\n]{0,30}:", "section": "history"},
    {"pattern": r"^\s*(?:follow[- ]?up|next visit)\b[^:\n]{0,30}:", "section": "plan"},
    {"pattern": r"^\s*(?:chief complaints?|c/c|presenting complaints?|hpi|history of present illness)\b[^:\n]{0,30}:", "section": "complaints"},
    {"pattern": r"^\s*(?:past (?:medical )?history|pmh|history|medical history)\b[^:\n]{0,30}:", "section": "history"},
    {"pattern": r"^\s*(?:vitals?|examination|o/e|findings|clinical findings)\b[^:\n]{0,30}:", "section": "exam"},
    {"pattern": r"^\s*(?:assessment|diagnosis|impression|differentials?(?: diagnosis| assessment)?)\b[^:\n]{0,30}:", "section": "assessment"},
    {"pattern": r"^\s*(?:investigations?|labs?|orders?|tests?)\b[^:\n]{0,30}:", "section": "labs"},
    {"pattern": r"^\s*(?:plan|rx|medications?|advice|treatment)\b[^:\n]{0,30}:", "section": "plan"},
]

# The CareBridge note format (services/note_format.py): fixed headings, parsed into structured data on finish.
NOTEPAD_TEMPLATE = (
    "Chief Complaints:\n\n"
    "History:\n\n"
    "Allergies:\n\n"
    "Current Medications:\n\n"
    "Vitals:\n\n"
    "Examination:\n\n"
    "Diagnosis:\n\n"
    "Investigations:\n\n"
    "Rx:\n\n"
    "Advice:\n\n"
    "Follow-up:\n"
)


# ---------------------------------------------------------------------------
# Colloquial -> universal nomenclature
#   prior: base likelihood; sections: note sections that favour the candidate;
#   keywords: words near the term (same line) that favour the candidate.
#   severity: 'routine' | 'critical' (critical renders crimson in the UI)
# ---------------------------------------------------------------------------
_T2DM = {
    "name": "Type 2 Diabetes Mellitus", "category": "Endocrine / Metabolic", "severity": "routine",
    "codes": [_c(SNOMED, "44054006", "Type 2 diabetes mellitus"), _c(ICD10, "E11.9", "Type 2 diabetes mellitus without complications")],
    "prior": 0.6, "sections": ["history", "assessment"],
    "keywords": ["h/o", "history", "known", "k/c/o", "since", "yrs", "years", "tablet", "tablets", "metformin", "on treatment", "past"],
}
_FBG = {
    "name": "Fasting Blood Glucose Test", "category": "Pathology / Investigation", "severity": "routine",
    "codes": [_c(LOINC, "1558-6", "Fasting glucose [Mass/volume] in Serum or Plasma")],
    "prior": 0.3, "sections": ["labs", "plan"],
    "keywords": ["check", "test", "fasting", "order", "level", "levels", "tomorrow", "repeat", "report", "advised"],
}

NOMENCLATURE: List[Dict[str, Any]] = [
    {"phrases": ["low sugar", "sugar low"], "candidates": [{
        "name": "Hypoglycemia, unspecified", "category": "Metabolic Emergency", "severity": "critical",
        "codes": [_c(SNOMED, "302866003", "Hypoglycemia"), _c(ICD10, "E16.2")],
        "prior": 0.92, "sections": [], "keywords": [],
    }]},
    {"phrases": ["sugar", "sugar problem", "sugar disease", "madhumeha"], "candidates": [_T2DM, _FBG]},
    {"phrases": ["heart attack"], "candidates": [
        {"name": "Acute Myocardial Infarction", "category": "Cardiovascular Emergency", "severity": "critical",
         "codes": [_c(SNOMED, "22298006", "Myocardial infarction"), _c(ICD10, "I21.9", "Acute myocardial infarction, unspecified")],
         "prior": 0.6, "sections": ["complaints", "history", "assessment"],
         "keywords": ["chest pain", "radiating", "sweating", "diaphoresis", "past", "history", "h/o", "ecg", "troponin", "stent", "angioplasty"]},
        {"name": "Cardiac Arrest, unspecified", "category": "Cardiovascular Critical", "severity": "critical",
         "codes": [_c(SNOMED, "410429000", "Cardiac arrest"), _c(ICD10, "I46.9")],
         "prior": 0.35, "sections": [],
         "keywords": ["collapse", "collapsed", "unresponsive", "cpr", "pulseless", "arrest", "revived"]},
    ]},
    {"phrases": ["low bp"], "candidates": [{
        "name": "Hypotension, unspecified", "category": "Hemodynamic", "severity": "routine",
        "codes": [_c(SNOMED, "45007003", "Low blood pressure"), _c(ICD10, "I95.9")],
        "prior": 0.92, "sections": [], "keywords": [],
    }]},
    {"phrases": ["high bp", "bp problem", "bp", "tension"],
     "not_followed_by": ["headache", "type", "pneumothorax", "normal", "stable", "within", "is", "was", "of"],
     "candidates": [{
        "name": "Essential (Primary) Hypertension", "category": "Cardiovascular Chronic", "severity": "routine",
        "codes": [_c(SNOMED, "59621000", "Essential hypertension"), _c(ICD10, "I10")],
        # Lower prior: a bare "bp" is often a vital sign. History context / keywords push it over the threshold.
        "prior": 0.7, "sections": ["history", "assessment"],
        "keywords": ["h/o", "history", "known", "k/c/o", "since", "yrs", "years", "tablet", "tablets", "on treatment", "high", "amlodipine", "telmisartan"],
    }]},
    {"phrases": ["gas", "acidity", "gas problem"], "candidates": [
        {"name": "Gastroesophageal Reflux Disease (GERD)", "category": "Gastroenterology", "severity": "routine",
         "codes": [_c(SNOMED, "235595009", "Gastroesophageal reflux disease"), _c(ICD10, "K21.9")],
         "prior": 0.5, "sections": [], "keywords": ["burning", "heartburn", "epigastric", "sour", "regurgitation", "night", "lying"]},
        {"name": "Functional Dyspepsia", "category": "Gastroenterology", "severity": "routine",
         "codes": [_c(SNOMED, "196756002", "Dyspepsia"), _c(ICD10, "K30")],
         "prior": 0.4, "sections": [], "keywords": ["fullness", "bloating", "indigestion", "early satiety", "after food", "after meals"]},
    ]},
    {"phrases": ["dama", "saas phoolna", "saans phoolna"], "candidates": [{
        "name": "Bronchial Asthma, unspecified", "category": "Respiratory", "severity": "routine",
        "codes": [_c(SNOMED, "195967001", "Asthma"), _c(ICD10, "J45.9")],
        "prior": 0.92, "sections": [], "keywords": [],
    }]},
    {"phrases": ["chakkar", "chakkar aana"], "candidates": [
        {"name": "Benign Paroxysmal Positional Vertigo", "category": "Neuro-Otology", "severity": "routine",
         "codes": [_c(SNOMED, "232288003", "BPPV"), _c(ICD10, "H81.1")],
         "prior": 0.4, "sections": [], "keywords": ["spinning", "rotating", "turning", "positional", "head movement", "lying down", "bed"]},
        {"name": "Dizziness / Presyncope", "category": "General Symptom", "severity": "routine",
         "codes": [_c(SNOMED, "404640003", "Dizziness"), _c(ICD10, "R42")],
         "prior": 0.5, "sections": [], "keywords": ["lightheaded", "weakness", "kamzori", "faint", "blackout", "standing"]},
    ]},
    {"phrases": ["piliya", "peeliya"], "candidates": [{
        "name": "Jaundice, unspecified", "category": "Hepatobiliary", "severity": "routine",
        "codes": [_c(SNOMED, "18165001", "Jaundice"), _c(ICD10, "R17")],
        "prior": 0.92, "sections": [], "keywords": [],
    }]},
    {"phrases": ["pathri", "stone"], "not_followed_by": ["free"], "candidates": [
        {"name": "Calculus of Ureter", "category": "Nephrology", "severity": "routine",
         "codes": [_c(ICD10, "N20.1", "Calculus of ureter")],
         "prior": 0.45, "sections": [], "keywords": ["ureter", "ureteric", "vuj", "groin", "radiating", "colic", "hydronephrosis"]},
        {"name": "Calculus of Kidney", "category": "Nephrology", "severity": "routine",
         "codes": [_c(ICD10, "N20.0", "Calculus of kidney")],
         "prior": 0.45, "sections": [], "keywords": ["kidney", "renal", "flank", "pelvis", "calyx", "calyceal"]},
    ]},
    {"phrases": ["thyroid", "thyroid problem"], "candidates": [
        {"name": "Hypothyroidism, unspecified", "category": "Endocrine", "severity": "routine",
         "codes": [_c(SNOMED, "40930008", "Hypothyroidism"), _c(ICD10, "E03.9")],
         "prior": 0.6, "sections": ["history", "assessment"],
         "keywords": ["weight gain", "lethargy", "thyroxine", "levothyroxine", "thyronorm", "since", "yrs", "years", "h/o"]},
        {"name": "Thyroid Function Test (TSH)", "category": "Pathology / Investigation", "severity": "routine",
         "codes": [_c(LOINC, "3016-3", "Thyrotropin [Units/volume] in Serum or Plasma")],
         "prior": 0.35, "sections": ["labs", "plan"],
         "keywords": ["test", "function", "profile", "panel", "check", "level", "report"]},
    ]},
    {"phrases": ["khooni bawasir", "bawasir", "piles"], "candidates": [{
        "name": "Hemorrhoids", "category": "Colorectal", "severity": "routine",
        "codes": [_c(ICD10, "K64.9", "Haemorrhoids, unspecified")],
        "prior": 0.92, "sections": [], "keywords": [],
    }]},
]

AUTO_CONVERT_THRESHOLD = 0.90


def lexicon_payload() -> Dict[str, Any]:
    """Public lexicon (no PHI) used by the browser's local Tier 1/2 engine."""
    return {
        "version": "2026.10.1",
        "auto_convert_threshold": AUTO_CONVERT_THRESHOLD,
        "terms": TERMS,
        "shorthand": SHORTHAND,
        "shorthand_patterns": SHORTHAND_PATTERNS,
        "punctuation_rules": PUNCTUATION_RULES,
        "section_headings": SECTION_HEADINGS,
        "nomenclature": NOMENCLATURE,
        "template": NOTEPAD_TEMPLATE,
        "common_words": COMMON_WORDS,
    }
