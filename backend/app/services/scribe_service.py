import re
from typing import Dict, Any

def generate_soap_note_from_dialogue(transcript: str, patient_name: str = "Ramesh Gowda") -> Dict[str, Any]:
    """
    Simulates clinical NLP entity extraction to draft a structured SOAP clinical note.
    Requires doctor review before finalization.
    """
    lower_t = transcript.lower()

    # Extract subjective details
    subjective = (
        f"54-year-old male ({patient_name}) presenting with complaints discussed during teleconsultation: "
        f"acute intermittent flank and lower abdominal discomfort for 3 days. "
        f"Reports mild nausea without active emesis or gross macroscopic hematuria."
    )
    if "fever" in lower_t:
        subjective += " Patient notes low-grade fever."
    if "dysuria" in lower_t or "burning" in lower_t:
        subjective += " Associated burning micturition."

    # Objective vitals & imaging findings
    objective = (
        "Vitals: BP: 130/84 mmHg, Pulse: 78 bpm regular, Temp: 98.4°F, SpO2: 98% on room air.\n"
        "Abdominal Exam (Self-palpation guided): Tenderness elicited in right renal angle/lumbar area, non-rigid, no peritoneal signs.\n"
        "Diagnostics: Ultrasound Pelvis & Abdomen (Decrypted under Consent Grant): "
        "Demonstrates mild right hydronephrosis with a 4mm calculus at the right vesicoureteric junction."
    )

    # Assessment
    assessment = "Acute uncomplicated right ureteric colic secondary to 4mm distal calculus (ICD-10: N20.1). High likelihood of spontaneous expulsion with medical expulsive therapy."

    # Plan
    medications = [
        {
            "drug": "Tamsulosin",
            "dosage": "0.4 mg",
            "frequency": "OD (Once daily at bedtime)",
            "duration": "14 days",
            "timing_icon": "🌙"
        },
        {
            "drug": "Paracetamol",
            "dosage": "650 mg",
            "frequency": "SOS for acute pain (Max 3g/day)",
            "duration": "5 days",
            "timing_icon": "☀️"
        },
        {
            "drug": "Ciprofloxacin",
            "dosage": "500 mg",
            "frequency": "BD (Twice daily after food)",
            "duration": "5 days",
            "timing_icon": "☀️🌙"
        }
    ]

    dietary_advice = (
        "Hydration therapy: Maintain oral fluid intake of 2.5 to 3 Litres daily. "
        "Avoid high-oxalate foods (spinach, beetroot, dark chocolate, excessive tea) during active stone clearance."
    )

    red_flags = (
        "Immediate emergency room presentation required if: persistent severe spikes of fever (>101°F) with chills, "
        "complete inability to pass urine (anuria), intractable vomiting, or uncontrolled severe pain."
    )

    return {
        "subjective": subjective,
        "objective": objective,
        "assessment": assessment,
        "plan": {
            "medications": medications,
            "dietary_advice": dietary_advice,
            "red_flags": red_flags
        }
    }
