from datetime import datetime, timezone
from typing import Dict, Any

def generate_fhir_bundle(
    encounter_id: str,
    patient_data: Dict[str, Any],
    practitioner_data: Dict[str, Any],
    consent_data: Dict[str, Any],
    clinical_note_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Exports encounter and clinical diagnosis as a valid HL7 FHIR Release 4 Document Bundle
    aligned with Ayushman Bharat Digital Mission (ABDM) profiling.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    
    patient_res = {
        "resourceType": "Patient",
        "id": f"patient-{patient_data.get('patient_id', 'ramesh-gowda')}",
        "identifier": [
            {
                "system": "https://healthid.abdm.gov.in",
                "value": patient_data.get("abha_address", "91-4820-1928-1120")
            }
        ],
        "name": [
            {
                "text": patient_data.get("full_name", "Ramesh Gowda")
            }
        ],
        "gender": patient_data.get("gender", "male"),
        "communication": [
            {
                "language": {
                    "coding": [
                        {
                            "system": "urn:ietf:bcp:47",
                            "code": patient_data.get("preferred_language", "kn"),
                            "display": "Kannada" if patient_data.get("preferred_language") == "kn" else "Hindi"
                        }
                    ]
                },
                "preferred": True
            }
        ]
    }

    practitioner_res = {
        "resourceType": "Practitioner",
        "id": f"dr-{practitioner_data.get('practitioner_id', 'ananya-sharma')}",
        "identifier": [
            {
                "system": "https://nmc.org.in/registration",
                "value": practitioner_data.get("registration_number", "581920")
            }
        ],
        "name": [
            {
                "text": practitioner_data.get("display_name", "Dr. Ananya Sharma")
            }
        ],
        "qualification": [
            {
                "code": {
                    "text": practitioner_data.get("specialty", "General Medicine, MBBS MD")
                }
            }
        ]
    }

    encounter_res = {
        "resourceType": "Encounter",
        "id": f"encounter-{encounter_id}",
        "status": "finished",
        "class": {
            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            "code": "VR",
            "display": "Virtual Telehealth Encounter"
        },
        "subject": {
            "reference": f"Patient/{patient_res['id']}"
        },
        "participant": [
            {
                "individual": {
                    "reference": f"Practitioner/{practitioner_res['id']}"
                }
            }
        ],
        "period": {
            "start": now_iso
        }
    }

    consent_res = {
        "resourceType": "Consent",
        "id": f"consent-{consent_data.get('consent_id', 'c7a82910')}",
        "status": consent_data.get("status", "active"),
        "scope": {
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/consentscope",
                    "code": "patient-privacy",
                    "display": "Privacy Consent"
                }
            ]
        },
        "provision": {
            "type": "permit",
            "purpose": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/v3-ActReason",
                    "code": "TREAT",
                    "display": consent_data.get("purpose", "Acute Abdominal Evaluation")
                }
            ]
        }
    }

    entries = [
        {"resource": patient_res},
        {"resource": practitioner_res},
        {"resource": encounter_res},
        {"resource": consent_res}
    ]

    # Add MedicationRequests from clinical note plan
    plan = clinical_note_data.get("plan_json", {})
    if isinstance(plan, dict) and "medications" in plan:
        for idx, med in enumerate(plan["medications"]):
            entries.append({
                "resource": {
                    "resourceType": "MedicationRequest",
                    "id": f"med-{encounter_id}-{idx}",
                    "status": "active",
                    "intent": "order",
                    "medicationCodeableConcept": {
                        "text": f"{med.get('drug')} {med.get('dosage')}"
                    },
                    "dosageInstruction": [
                        {
                            "text": f"{med.get('frequency')} for {med.get('duration')}"
                        }
                    ]
                }
            })

    return {
        "resourceType": "Bundle",
        "id": f"carebridge-encounter-bundle-{encounter_id}",
        "type": "document",
        "timestamp": now_iso,
        "entry": entries
    }
