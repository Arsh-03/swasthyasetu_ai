from typing import List, Dict, Any, Optional

VERIFIED_DDI_RULES = [
    {
        "pair": ("ciprofloxacin", "antacid"),
        "keywords_a": ["ciprofloxacin", "cipro", "fluoroquinolone"],
        "keywords_b": ["antacid", "magnesium hydroxide", "aluminum hydroxide", "gelusil", "digene"],
        "severity": "CRITICAL",
        "mechanism": "Chelation binding between multivalent metal cations and fluoroquinolone reduces antibiotic gastrointestinal absorption by >70%.",
        "citation": "National Formulary of India (NFI) 2021, Section 8.1.3",
        "action": "Space antibiotic administration by at least 2 hours before or 4 hours after antacids, or substitute with Ceftriaxone."
    },
    {
        "pair": ("metformin", "radiocontrast"),
        "keywords_a": ["metformin", "glycomet"],
        "keywords_b": ["iodinated contrast", "radiocontrast", "ct contrast"],
        "severity": "HIGH",
        "mechanism": "Contrast-induced acute nephropathy reduces metformin renal clearance, leading to life-threatening lactic acidosis.",
        "citation": "Indian College of Radiology Guidelines & CDSCO Formulary",
        "action": "Withhold Metformin 48 hours prior to and after contrast imaging; verify eGFR before resumption."
    },
    {
        "pair": ("ace_inhibitor", "spironolactone"),
        "keywords_a": ["enalapril", "ramipril", "lisinopril", "telmisartan"],
        "keywords_b": ["spironolactone", "aldactone"],
        "severity": "HIGH",
        "mechanism": "Synergistic potassium-sparing effect can precipitate severe cardiac hyperkalemia (K+ > 5.5 mEq/L).",
        "citation": "Cardiological Society of India & WHO Model Formulary",
        "action": "Monitor serum potassium and creatinine within 72 hours of initiation; adjust dosage accordingly."
    },
    {
        "pair": ("warfarin", "nsaid"),
        "keywords_a": ["warfarin", "acitrom"],
        "keywords_b": ["ibuprofen", "diclofenac", "naproxen", "combiflam"],
        "severity": "CRITICAL",
        "mechanism": "NSAIDs cause gastric mucosal injury and platelet cyclooxygenase inhibition, dramatically amplifying anticoagulant bleeding risk.",
        "citation": "National Formulary of India (NFI) / BNF Hematology Guidance",
        "action": "Avoid NSAIDs; substitute with Paracetamol (maximum 2g/day) or Tramadol for acute analgesia."
    }
]

def check_drug_safety(
    proposed_drugs: List[str],
    current_meds: List[str],
    allergies: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Check proposed medications against current medications (and allergies, if given).
    Uses the safety engine (DDInter 2.0 + these curated rules); falls back to the rules alone on error.
    """
    try:
        from app.services.safety_engine import check  # lazy: safety_engine imports this module
        result = check("\n".join(proposed_drugs), current_meds, allergies or [])
        return [
            {
                "severity": a["severity"].upper(),
                "conflicting_pair": a["title"],
                "clinical_mechanism": a["detail"],
                "formulary_citation": a["source"],
                "recommended_action": a["context"],
            }
            for a in result["alerts"] if not a.get("low_priority")
        ]
    except Exception:  # noqa: BLE001 - never let a data problem block the clinician
        pass
    return _check_curated_rules(proposed_drugs, current_meds)


def _check_curated_rules(proposed_drugs: List[str], current_meds: List[str]) -> List[Dict[str, Any]]:
    alerts = []
    
    all_combined = [d.lower().strip() for d in proposed_drugs]
    existing = [m.lower().strip() for m in current_meds]

    for rule in VERIFIED_DDI_RULES:
        # Check if one side is in proposed and other is in existing, or both in proposed
        match_a = False
        match_b = False
        matched_str_a = ""
        matched_str_b = ""

        # Check in proposed
        for drug in all_combined:
            for kw in rule["keywords_a"]:
                if kw in drug:
                    match_a = True
                    matched_str_a = drug
            for kw in rule["keywords_b"]:
                if kw in drug:
                    match_b = True
                    matched_str_b = drug

        # Check in existing
        for drug in existing:
            for kw in rule["keywords_a"]:
                if kw in drug:
                    match_a = True
                    matched_str_a = drug
            for kw in rule["keywords_b"]:
                if kw in drug:
                    match_b = True
                    matched_str_b = drug

        if match_a and match_b and matched_str_a != matched_str_b:
            alerts.append({
                "severity": rule["severity"],
                "conflicting_pair": f"{matched_str_a.title()} + {matched_str_b.title()}",
                "clinical_mechanism": rule["mechanism"],
                "formulary_citation": rule["citation"],
                "recommended_action": rule["action"]
            })

    return alerts
