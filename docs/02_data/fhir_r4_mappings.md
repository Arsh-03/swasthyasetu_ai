# HL7 FHIR R4 Compatibility & ABDM Resource Serialization

**Document ID:** DATA-FHIR-CB-2026-V1  
**Project:** CareBridge India  
**Standard:** HL7 FHIR Release 4 (R4) / Ayushman Bharat Digital Mission (ABDM) Profiles  

---

## 1. FHIR Resource Mapping Matrix

To maintain seamless interoperability with Indian national digital health infrastructure (ABDM), CareBridge entities map directly to standard HL7 FHIR R4 resources:

| CareBridge Entity | Target FHIR R4 Resource | Key Mapped Attributes |
| :--- | :--- | :--- |
| `patient_profiles` | **`Patient`** | `identifier` (ABHA Address), `name`, `gender`, `birthDate`, `communication.language` |
| `practitioners` | **`Practitioner`** | `identifier` (NMC Medical Registration Number), `name`, `qualification` |
| `encounters` | **`Encounter`** | `status`, `class` (VR for Virtual), `period`, `reasonCode` (SNOMED-CT) |
| `consents` | **`Consent`** | `status`, `scope`, `category` (research/treatment), `provision.purpose`, `provision.period` |
| `clinical_notes` (Diagnosis) | **`Condition`** | `code` (ICD-10 / SNOMED), `clinicalStatus`, `subject` |
| `clinical_notes` (Prescription) | **`MedicationRequest`** | `medicationCodeableConcept`, `dosageInstruction`, `dispenseRequest` |

---

## 2. Sample FHIR R4 Encounter Bundle Export

```json
{
  "resourceType": "Bundle",
  "id": "carebridge-encounter-bundle-9481",
  "type": "document",
  "timestamp": "2026-10-02T17:00:00Z",
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "id": "patient-ramesh-gowda",
        "identifier": [
          {
            "system": "https://healthid.abdm.gov.in",
            "value": "91-4820-1928-1120"
          }
        ],
        "name": [{ "text": "Ramesh Gowda" }],
        "gender": "male",
        "communication": [
          {
            "language": {
              "coding": [{ "system": "urn:ietf:bcp:47", "code": "kn", "display": "Kannada" }]
            },
            "preferred": true
          }
        ]
      }
    },
    {
      "resource": {
        "resourceType": "Consent",
        "id": "consent-usg-scan-60m",
        "status": "active",
        "scope": {
          "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/consentscope", "code": "patient-privacy" }]
        },
        "provision": {
          "type": "permit",
          "period": {
            "start": "2026-10-02T16:30:00Z",
            "end": "2026-10-02T17:30:00Z"
          },
          "purpose": [
            {
              "system": "http://terminology.hl7.org/CodeSystem/v3-ActReason",
              "code": "TREAT",
              "display": "Acute Flank Pain Assessment"
            }
          ]
        }
      }
    }
  ]
}
```
