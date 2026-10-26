"""
OPD departments a patient can choose a doctor from, and the health issues that lead to each one.

Only outpatient specialties are listed (no ICU, emergency or surgery-only services): these are the
clinics a patient visits or video-calls for consultations, check-ups, tests and minor treatment.
The patient app shows the health issues first ("Heart / Blood pressure") and suggests the department.
Labels are given in English, Hindi and Kannada.
"""
from typing import Any, Dict, List, Optional

# id, names {en, hi, kn}, short description (en, hi, kn)
DEPARTMENTS: List[Dict[str, Any]] = [
    {"id": "general_medicine", "name": {"en": "General Medicine", "hi": "सामान्य चिकित्सा", "kn": "ಸಾಮಾನ್ಯ ವೈದ್ಯಕೀಯ"},
     "about": {"en": "Fever, infections, diabetes, BP and everyday illness",
               "hi": "बुखार, संक्रमण, मधुमेह, बीपी और रोज़मर्रा की बीमारी",
               "kn": "ಜ್ವರ, ಸೋಂಕು, ಮಧುಮೇಹ, ಬಿಪಿ ಮತ್ತು ದಿನನಿತ್ಯದ ಕಾಯಿಲೆ"}},
    {"id": "cardiology", "name": {"en": "Cardiology", "hi": "हृदय रोग विभाग", "kn": "ಹೃದ್ರೋಗ ವಿಭಾಗ"},
     "about": {"en": "Heart, chest pain, blood pressure, palpitations",
               "hi": "दिल, सीने में दर्द, ब्लड प्रेशर, धड़कन",
               "kn": "ಹೃದಯ, ಎದೆ ನೋವು, ರಕ್ತದೊತ್ತಡ, ಎದೆ ಬಡಿತ"}},
    {"id": "dermatology", "name": {"en": "Dermatology", "hi": "त्वचा रोग विभाग", "kn": "ಚರ್ಮರೋಗ ವಿಭಾಗ"},
     "about": {"en": "Skin rash, itching, acne, hair and nail problems",
               "hi": "त्वचा पर दाने, खुजली, मुंहासे, बाल और नाखून",
               "kn": "ಚರ್ಮದ ದದ್ದು, ತುರಿಕೆ, ಮೊಡವೆ, ಕೂದಲು ಮತ್ತು ಉಗುರು"}},
    {"id": "orthopaedics", "name": {"en": "Orthopaedics", "hi": "हड्डी रोग विभाग", "kn": "ಮೂಳೆ ಚಿಕಿತ್ಸಾ ವಿಭಾಗ"},
     "about": {"en": "Joint pain, back pain, fractures follow-up, arthritis",
               "hi": "जोड़ों का दर्द, कमर दर्द, फ्रैक्चर फॉलो-अप, गठिया",
               "kn": "ಕೀಲು ನೋವು, ಬೆನ್ನು ನೋವು, ಮುರಿತದ ನಂತರದ ತಪಾಸಣೆ, ಸಂಧಿವಾತ"}},
    {"id": "ent", "name": {"en": "ENT", "hi": "नाक, कान, गला (ENT)", "kn": "ಕಿವಿ, ಮೂಗು, ಗಂಟಲು (ENT)"},
     "about": {"en": "Ear pain, hearing, sinus, throat and tonsils",
               "hi": "कान दर्द, सुनना, साइनस, गला और टॉन्सिल",
               "kn": "ಕಿವಿ ನೋವು, ಶ್ರವಣ, ಸೈನಸ್, ಗಂಟಲು ಮತ್ತು ಟಾನ್ಸಿಲ್"}},
    {"id": "ophthalmology", "name": {"en": "Ophthalmology", "hi": "नेत्र रोग विभाग", "kn": "ನೇತ್ರ ವಿಭಾಗ"},
     "about": {"en": "Eye checks, blurred vision, cataract, red eyes",
               "hi": "आंखों की जांच, धुंधला दिखना, मोतियाबिंद, लाल आंखें",
               "kn": "ಕಣ್ಣಿನ ತಪಾಸಣೆ, ಮಸುಕು ದೃಷ್ಟಿ, ಕಣ್ಣಿನ ಪೊರೆ, ಕೆಂಪು ಕಣ್ಣು"}},
    {"id": "obgyn", "name": {"en": "Obstetrics & Gynaecology", "hi": "स्त्री एवं प्रसूति रोग", "kn": "ಸ್ತ್ರೀರೋಗ ಮತ್ತು ಪ್ರಸೂತಿ"},
     "about": {"en": "Pregnancy check-ups, periods, women's health",
               "hi": "गर्भावस्था जांच, मासिक धर्म, महिला स्वास्थ्य",
               "kn": "ಗರ್ಭಿಣಿ ತಪಾಸಣೆ, ಮುಟ್ಟು, ಮಹಿಳಾ ಆರೋಗ್ಯ"}},
    {"id": "paediatrics", "name": {"en": "Paediatrics", "hi": "बाल रोग विभाग", "kn": "ಮಕ್ಕಳ ವಿಭಾಗ"},
     "about": {"en": "Children's illness, growth, vaccinations",
               "hi": "बच्चों की बीमारी, विकास, टीकाकरण",
               "kn": "ಮಕ್ಕಳ ಕಾಯಿಲೆ, ಬೆಳವಣಿಗೆ, ಲಸಿಕೆ"}},
    {"id": "endocrinology", "name": {"en": "Endocrinology (Diabetes & Thyroid)", "hi": "मधुमेह और थायराइड", "kn": "ಮಧುಮೇಹ ಮತ್ತು ಥೈರಾಯ್ಡ್"},
     "about": {"en": "Diabetes, thyroid and hormone problems",
               "hi": "मधुमेह, थायराइड और हार्मोन की समस्या",
               "kn": "ಮಧುಮೇಹ, ಥೈರಾಯ್ಡ್ ಮತ್ತು ಹಾರ್ಮೋನ್ ಸಮಸ್ಯೆ"}},
    {"id": "pulmonology", "name": {"en": "Pulmonology (Chest)", "hi": "छाती और फेफड़े", "kn": "ಎದೆ ಮತ್ತು ಶ್ವಾಸಕೋಶ"},
     "about": {"en": "Cough, asthma, breathlessness, COPD",
               "hi": "खांसी, दमा, सांस फूलना, सीओपीडी",
               "kn": "ಕೆಮ್ಮು, ಅಸ್ತಮಾ, ಉಸಿರಾಟದ ತೊಂದರೆ, ಸಿಓಪಿಡಿ"}},
    {"id": "gastroenterology", "name": {"en": "Gastroenterology", "hi": "पेट और पाचन", "kn": "ಹೊಟ್ಟೆ ಮತ್ತು ಜೀರ್ಣಕ್ರಿಯೆ"},
     "about": {"en": "Acidity, stomach pain, liver, digestion",
               "hi": "एसिडिटी, पेट दर्द, लीवर, पाचन",
               "kn": "ಆಮ್ಲೀಯತೆ, ಹೊಟ್ಟೆ ನೋವು, ಯಕೃತ್, ಜೀರ್ಣಕ್ರಿಯೆ"}},
    {"id": "neurology", "name": {"en": "Neurology", "hi": "तंत्रिका रोग विभाग", "kn": "ನರರೋಗ ವಿಭಾಗ"},
     "about": {"en": "Headache, migraine, fits, numbness",
               "hi": "सिरदर्द, माइग्रेन, दौरे, सुन्नपन",
               "kn": "ತಲೆನೋವು, ಮೈಗ್ರೇನ್, ಮೂರ್ಛೆ, ಜೋಮು"}},
    {"id": "psychiatry", "name": {"en": "Psychiatry", "hi": "मानसिक स्वास्थ्य", "kn": "ಮಾನಸಿಕ ಆರೋಗ್ಯ"},
     "about": {"en": "Stress, sleep, anxiety, low mood",
               "hi": "तनाव, नींद, चिंता, उदासी",
               "kn": "ಒತ್ತಡ, ನಿದ್ರೆ, ಆತಂಕ, ಖಿನ್ನತೆ"}},
    {"id": "urology", "name": {"en": "Urology", "hi": "मूत्र रोग विभाग", "kn": "ಮೂತ್ರರೋಗ ವಿಭಾಗ"},
     "about": {"en": "Kidney stones, urine problems, prostate",
               "hi": "पथरी, पेशाब की समस्या, प्रोस्टेट",
               "kn": "ಕಿಡ್ನಿ ಕಲ್ಲು, ಮೂತ್ರದ ತೊಂದರೆ, ಪ್ರಾಸ್ಟೇಟ್"}},
    {"id": "dental", "name": {"en": "Dental", "hi": "दंत चिकित्सा", "kn": "ದಂತ ಚಿಕಿತ್ಸೆ"},
     "about": {"en": "Toothache, gums, cleaning, fillings",
               "hi": "दांत दर्द, मसूड़े, सफाई, फिलिंग",
               "kn": "ಹಲ್ಲು ನೋವು, ಒಸಡು, ಸ್ವಚ್ಛತೆ, ಫಿಲ್ಲಿಂಗ್"}},
]

# What the patient picks first. Each health issue suggests one department.
HEALTH_ISSUES: List[Dict[str, Any]] = [
    {"id": "general", "department": "general_medicine",
     "label": {"en": "Fever, cold & general illness", "hi": "बुखार, सर्दी और सामान्य बीमारी", "kn": "ಜ್ವರ, ಶೀತ ಮತ್ತು ಸಾಮಾನ್ಯ ಕಾಯಿಲೆ"}},
    {"id": "heart_bp", "department": "cardiology",
     "label": {"en": "Heart & blood pressure", "hi": "दिल और ब्लड प्रेशर", "kn": "ಹೃದಯ ಮತ್ತು ರಕ್ತದೊತ್ತಡ"}},
    {"id": "diabetes_thyroid", "department": "endocrinology",
     "label": {"en": "Diabetes & thyroid", "hi": "मधुमेह और थायराइड", "kn": "ಮಧುಮೇಹ ಮತ್ತು ಥೈರಾಯ್ಡ್"}},
    {"id": "skin_hair", "department": "dermatology",
     "label": {"en": "Skin, hair & nails", "hi": "त्वचा, बाल और नाखून", "kn": "ಚರ್ಮ, ಕೂದಲು ಮತ್ತು ಉಗುರು"}},
    {"id": "bones_joints", "department": "orthopaedics",
     "label": {"en": "Bones, joints & back pain", "hi": "हड्डी, जोड़ और कमर दर्द", "kn": "ಮೂಳೆ, ಕೀಲು ಮತ್ತು ಬೆನ್ನು ನೋವು"}},
    {"id": "breathing", "department": "pulmonology",
     "label": {"en": "Cough, asthma & breathing", "hi": "खांसी, दमा और सांस", "kn": "ಕೆಮ್ಮು, ಅಸ್ತಮಾ ಮತ್ತು ಉಸಿರಾಟ"}},
    {"id": "stomach", "department": "gastroenterology",
     "label": {"en": "Stomach & digestion", "hi": "पेट और पाचन", "kn": "ಹೊಟ್ಟೆ ಮತ್ತು ಜೀರ್ಣಕ್ರಿಯೆ"}},
    {"id": "urine_kidney", "department": "urology",
     "label": {"en": "Urine & kidney stones", "hi": "पेशाब और पथरी", "kn": "ಮೂತ್ರ ಮತ್ತು ಕಿಡ್ನಿ ಕಲ್ಲು"}},
    {"id": "eyes", "department": "ophthalmology",
     "label": {"en": "Eyes & vision", "hi": "आंखें और नज़र", "kn": "ಕಣ್ಣು ಮತ್ತು ದೃಷ್ಟಿ"}},
    {"id": "ent", "department": "ent",
     "label": {"en": "Ear, nose & throat", "hi": "कान, नाक और गला", "kn": "ಕಿವಿ, ಮೂಗು ಮತ್ತು ಗಂಟಲು"}},
    {"id": "women", "department": "obgyn",
     "label": {"en": "Women's health & pregnancy", "hi": "महिला स्वास्थ्य और गर्भावस्था", "kn": "ಮಹಿಳಾ ಆರೋಗ್ಯ ಮತ್ತು ಗರ್ಭಧಾರಣೆ"}},
    {"id": "child", "department": "paediatrics",
     "label": {"en": "Child's health", "hi": "बच्चे का स्वास्थ्य", "kn": "ಮಗುವಿನ ಆರೋಗ್ಯ"}},
    {"id": "headache_nerves", "department": "neurology",
     "label": {"en": "Headache, fits & nerves", "hi": "सिरदर्द, दौरे और नसें", "kn": "ತಲೆನೋವು, ಮೂರ್ಛೆ ಮತ್ತು ನರಗಳು"}},
    {"id": "mind", "department": "psychiatry",
     "label": {"en": "Stress, sleep & mood", "hi": "तनाव, नींद और मन", "kn": "ಒತ್ತಡ, ನಿದ್ರೆ ಮತ್ತು ಮನಸ್ಸು"}},
    {"id": "teeth", "department": "dental",
     "label": {"en": "Teeth & gums", "hi": "दांत और मसूड़े", "kn": "ಹಲ್ಲು ಮತ್ತು ಒಸಡು"}},
]

DEPARTMENT_BY_ID = {d["id"]: d for d in DEPARTMENTS}
ISSUE_BY_ID = {i["id"]: i for i in HEALTH_ISSUES}

# Words in a free-text specialty ("MD, DM Cardiology") that place a doctor in a department.
_SPECIALTY_WORDS = [
    ("cardio", "cardiology"), ("heart", "cardiology"),
    ("derma", "dermatology"), ("skin", "dermatology"),
    ("ortho", "orthopaedics"),
    ("ent", "ent"), ("otorhino", "ent"),
    ("ophthal", "ophthalmology"), ("eye", "ophthalmology"),
    ("gyn", "obgyn"), ("obstet", "obgyn"),
    ("paed", "paediatrics"), ("pedia", "paediatrics"), ("child", "paediatrics"),
    ("endocrin", "endocrinology"), ("diabet", "endocrinology"), ("thyroid", "endocrinology"),
    ("pulmo", "pulmonology"), ("chest", "pulmonology"), ("respir", "pulmonology"),
    ("gastro", "gastroenterology"), ("hepato", "gastroenterology"),
    ("neuro", "neurology"),
    ("psych", "psychiatry"),
    ("uro", "urology"), ("nephro", "urology"),
    ("dental", "dental"), ("dent", "dental"), ("bds", "dental"),
]


def department_for_specialty(specialty: Optional[str]) -> str:
    """Best department for a free-text specialty; General Medicine when nothing matches."""
    words = (specialty or "").lower().replace(",", " ").replace("&", " ").replace("(", " ").replace(")", " ").split()
    for word in words:
        for key, dept in _SPECIALTY_WORDS:
            if key == "ent" and word != "ent":
                continue  # 'ent' is too short to match inside other words
            if word.startswith(key):
                return dept
    return "general_medicine"


def department_name(dept_id: Optional[str], lang: str = "en") -> str:
    dept = DEPARTMENT_BY_ID.get(dept_id or "")
    if not dept:
        return ""
    return dept["name"].get(lang) or dept["name"]["en"]
