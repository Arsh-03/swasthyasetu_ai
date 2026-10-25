# HL7 FHIR Release 4 & ABDM Official Profiles Mapping Specification

**Document ID:** DATA-FHIR-SS-2026-V2  
**Project:** SwasthyaSetu AI (CareBridge India)  
**Standard:** HL7 FHIR Release 4 (R4) / National Resource Centre for EHR Standards (NRCeS) India  
**ABDM Milestone Alignment:** Milestone 2 (M2 Tele-consultation Records) & Milestone 3 (M3 Encrypted Health Data Exchange)

---

## 1. ABDM NRCeS FHIR R4 Architectural Standard

Under the Ayushman Bharat Digital Mission (ABDM), clinical interoperability across Indian healthcare facilities is enforced through the **NRCeS FHIR R4 Implementation Guide (v3.0+)**. 

Every shared outpatient consultation, tele-health encounter, diagnostic scan, or prescription must be compiled as an immutable **HL7 FHIR Document Bundle** (`resourceType: Bundle`, `type: document`).

### Key Structural Invariants:
1. **Composition as First Entry:** The first resource in the bundle (`entry[0]`) **must** be an instance of `Composition` (`https://nrces.in/ndhm/fhir/r4/StructureDefinition/Composition`). This serves as the clinical manifest linking the patient, author practitioner, custodian facility, encounter, and thematic clinical sections.
2. **Deterministic Identifiers:** Every resource must include official ABDM naming systems (ABHA Number, ABHA Address, HPR ID, and HFR ID) to guarantee cross-hospital linkage.
3. **Standard Clinical Vocabularies:** Diagnoses must be bound to **SNOMED-CT** or **ICD-10**, lab observations to **LOINC**, and consent purposes to HL7 `v3-ActReason`.

---

## 2. Comprehensive 15-Table to HL7 FHIR R4 & ABDM Profile Mapping Matrix

The table below defines the exact transformation between all **15 SwasthyaSetu AI database tables** and official NRCeS ABDM StructureDefinitions:

| # | Database Entity | Target ABDM FHIR R4 Profile URI | FHIR Resource | Key Mapped Attributes & ABDM System URIs |
| :- | :--- | :--- | :--- | :--- |
| **1** | `users` | `http://hl7.org/fhir/StructureDefinition/Person` | **`Person`** | `id = user-{user_id}`, `telecom[0].value = phone_number`, `active = (status == 'active')`, `role` |
| **2** | `patient_profiles` | `https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient` | **`Patient`** | `identifier[0].system = "https://healthid.abdm.gov.in"` (ABHA Number)<br>`identifier[1].system = "https://phr.abdm.gov.in"` (ABHA Address)<br>`name.text`, `gender`, `birthDate`, `address`, `communication.language` |
| **3** | `practitioners` | `https://nrces.in/ndhm/fhir/r4/StructureDefinition/Practitioner` | **`Practitioner`** | `identifier[0].system = "https://hpr.abdm.gov.in"` (Doctor HPR ID)<br>`identifier[1].system = "https://nmc.org.in/registration"` (NMC Reg No)<br>`name.text`, `qualification.code.text` (SNOMED-CT) |
| **4** | `facilities` | `https://nrces.in/ndhm/fhir/r4/StructureDefinition/Organization` | **`Organization`** | `identifier[0].system = "https://facility.abdm.gov.in"` (HFR ID)<br>`name`, `type = "prov"`, `telecom`, `address`, `endpoint` |
| **5** | `care_contexts` | `https://nrces.in/ndhm/fhir/r4/StructureDefinition/EpisodeOfCare` | **`EpisodeOfCare`** | `identifier[0].value = care_context_reference`, `status = "active"`<br>`patient` (Reference to Patient), `managingOrganization` (Facility)<br>`period.start = linked_at` |
| **6** | `encounters` | `https://nrces.in/ndhm/fhir/r4/StructureDefinition/Encounter` | **`Encounter`** | `status = "finished"`, `class.code = "VR"` (Virtual Telehealth)<br>`subject` (Reference to Patient), `participant` (Practitioner)<br>`episodeOfCare` (Reference to EpisodeOfCare), `period.start`, `reasonCode` (SNOMED-CT) |
| **7** | `clinical_notes` (Header) | `https://nrces.in/ndhm/fhir/r4/StructureDefinition/Composition` | **`Composition`** | `status = "final"`, `type.coding[0].code = "11488-4"` (LOINC: Consult Note)<br>`subject`, `author`, `custodian`, `encounter`, `section[]` (Clinical sections) |
| **8** | `clinical_notes` (Diagnoses) | `https://nrces.in/ndhm/fhir/r4/StructureDefinition/Condition` | **`Condition`** | `clinicalStatus = "active"`, `verificationStatus = "confirmed"`<br>`code.coding[0]` (SNOMED-CT), `code.coding[1]` (ICD-10)<br>`subject`, `encounter` |
| **9** | `clinical_notes` (Rx Plan) | `https://nrces.in/ndhm/fhir/r4/StructureDefinition/MedicationRequest` | **`MedicationRequest`** | `status = "active"`, `intent = "order"`<br>`medicationCodeableConcept.coding` (SNOMED-CT)<br>`dosageInstruction[].timing`, `dosageInstruction[].doseAndRate` |
| **10** | `record_metadata` | `https://nrces.in/ndhm/fhir/r4/StructureDefinition/DiagnosticReportRadiology` | **`DiagnosticReport`** | `status = "final"`, `category.coding[0].code = "RAD"` / `"LAB"`<br>`code` (LOINC / SNOMED), `subject`, `conclusion`<br>`presentedForm` (Attached PDF/DICOM via `DocumentReference` / `Binary`) |
| **11** | `consent_requests` | `https://nrces.in/ndhm/fhir/r4/StructureDefinition/Consent` | **`Consent` (Proposed)** | `status = "proposed"`, `scope.coding[0].code = "patient-privacy"`<br>`patient`, `performer`, `purpose` (`v3-ActReason`), `provision.period`, `provision.dataPeriod.end = data_erase_at` |
| **12** | `consent_artefacts` | `https://nrces.in/ndhm/fhir/r4/StructureDefinition/Consent` | **`Consent` (Active)** | `identifier[0].value = consent_artefact_id`, `status = "active"`<br>`verification.verified = true`, `verification.verifiedWith = digital_signature`<br>`provision.type = "permit"` |
| **13** | `consent_care_contexts` | `https://nrces.in/ndhm/fhir/r4/StructureDefinition/Consent` | **`Consent.provision.data`** | `provision.data[].meaning = "instance"`, `provision.data[].reference` (URN reference to `EpisodeOfCare` / Care Context Reference) |
| **14** | `data_transfer_sessions` | `http://hl7.org/fhir/StructureDefinition/Communication` | **`Communication`** | `status = "completed"`, `sender` (HIP Facility), `recipient` (HIU Facility)<br>`payload` (ECDH Curve25519 Encrypted FHIR Document Bundle Package) |
| **15** | `representatives` | `https://nrces.in/ndhm/fhir/r4/StructureDefinition/RelatedPerson` | **`RelatedPerson`** | `patient` (Reference to Patient), `name = full_name`<br>`relationship` (`PRN` Parent, `SPS` Spouse, `CHILD`, `GUARD` Guardian)<br>`period.end = valid_until`, `extension[dpdp_verified]` |
| **16** | `follow_up_tasks` | `http://hl7.org/fhir/StructureDefinition/Task` | **`Task`** | `status = "ready"`, `intent = "plan"`, `for` (Reference to Patient)<br>`executionPeriod.start = scheduled_at`, `priority = (triage_alert_flag ? "urgent" : "routine")`<br>`code.text = reminder_type` |
| **17** | `audit_events` | `http://hl7.org/fhir/StructureDefinition/AuditEvent` | **`AuditEvent`** | `type.code = action`, `agent[0].who = actor_id`, `agent[0].role = actor_role`<br>`entity[0].what = resource_id`, `outcome = outcome_code`, `source.site = ip_hash`, `recorded = timestamp` |

---

## 3. Official Vocabulary & Terminology System URIs

To prevent validation rejections by the ABDM Gateway and NRCeS validation engine, all codes must reference these official canonical URIs:

```text
ABHA Health ID Number:     https://healthid.abdm.gov.in
ABHA PHR Address:          https://phr.abdm.gov.in
ABDM HPR Doctor Registry:  https://hpr.abdm.gov.in
National Medical Comm:     https://nmc.org.in/registration
ABDM HFR Facility Registry:https://facility.abdm.gov.in
SNOMED Clinical Terms:     http://snomed.info/sct
LOINC Diagnostic Codes:    http://loinc.org
WHO ICD-10 Classification: http://hl7.org/fhir/sid/icd-10
BCP-47 Language Codes:     urn:ietf:bcp:47
HL7 ActReason (Consent):   http://terminology.hl7.org/CodeSystem/v3-ActReason
HL7 ActCode (Encounter):   http://terminology.hl7.org/CodeSystem/v3-ActCode
```

---

## 4. Production ABDM OPD Consultation Document Bundle (JSON)

Below is an authentic, production-grade HL7 FHIR Release 4 Document Bundle representing a completed tele-consultation for a rural patient suffering from acute flank pain. It contains the master `Composition`, `Patient`, `Practitioner`, `Organization`, `Encounter`, `Condition`, `MedicationRequest`, and `DiagnosticReport`.

```json
{
  "resourceType": "Bundle",
  "id": "swasthyasetu-docbundle-9481a7b0",
  "meta": {
    "versionId": "1",
    "lastUpdated": "2026-10-19T10:45:00Z",
    "profile": [
      "https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle"
    ]
  },
  "identifier": {
    "system": "https://swasthyasetu.ai/bundles",
    "value": "BUNDLE-ENC-2026-10-19-9481"
  },
  "type": "document",
  "timestamp": "2026-10-19T10:45:00Z",
  "entry": [
    {
      "fullUrl": "urn:uuid:composition-opd-001",
      "resource": {
        "resourceType": "Composition",
        "id": "composition-opd-001",
        "meta": {
          "profile": [
            "https://nrces.in/ndhm/fhir/r4/StructureDefinition/Composition"
          ]
        },
        "identifier": {
          "system": "https://swasthyasetu.ai/compositions",
          "value": "COMP-2026-10-19-01"
        },
        "status": "final",
        "type": {
          "coding": [
            {
              "system": "http://loinc.org",
              "code": "11488-4",
              "display": "Consultation note"
            }
          ],
          "text": "Outpatient Telehealth Consultation Note"
        },
        "subject": {
          "reference": "urn:uuid:patient-ramesh-gowda",
          "display": "Ramesh Gowda"
        },
        "encounter": {
          "reference": "urn:uuid:encounter-tele-9481"
        },
        "date": "2026-10-19T10:45:00Z",
        "author": [
          {
            "reference": "urn:uuid:practitioner-ananya-sharma",
            "display": "Dr. Ananya Sharma (MD)"
          }
        ],
        "title": "Tele-Consultation Clinical Note",
        "custodian": {
          "reference": "urn:uuid:org-facility-hassan-hub",
          "display": "SwasthyaSetu Rural Tele-Clinic Hub"
        },
        "section": [
          {
            "title": "Chief Complaints & Symptoms",
            "code": {
              "coding": [
                {
                  "system": "http://snomed.info/sct",
                  "code": "422843007",
                  "display": "Chief complaint section"
                }
              ]
            },
            "text": {
              "status": "generated",
              "div": "<div xmlns=\"http://www.w3.org/1999/xhtml\">Severe right flank pain radiating to groin for 2 days. Nausea present.</div>"
            }
          },
          {
            "title": "Clinical Diagnoses",
            "code": {
              "coding": [
                {
                  "system": "http://snomed.info/sct",
                  "code": "29308-4",
                  "display": "Diagnosis"
                }
              ]
            },
            "entry": [
              {
                "reference": "urn:uuid:condition-calculus-kidney"
              }
            ]
          },
          {
            "title": "Medications & Prescriptions",
            "code": {
              "coding": [
                {
                  "system": "http://snomed.info/sct",
                  "code": "10160-0",
                  "display": "History of Medication use"
                }
              ]
            },
            "entry": [
              {
                "reference": "urn:uuid:med-drotaverine-80mg"
              }
            ]
          },
          {
            "title": "Diagnostic Investigations",
            "code": {
              "coding": [
                {
                  "system": "http://snomed.info/sct",
                  "code": "30954-2",
                  "display": "Relevant diagnostic tests"
                }
              ]
            },
            "entry": [
              {
                "reference": "urn:uuid:report-usg-kub-scan"
              }
            ]
          }
        ]
      }
    },
    {
      "fullUrl": "urn:uuid:patient-ramesh-gowda",
      "resource": {
        "resourceType": "Patient",
        "id": "patient-ramesh-gowda",
        "meta": {
          "profile": [
            "https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient"
          ]
        },
        "identifier": [
          {
            "type": {
              "coding": [
                {
                  "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                  "code": "MR",
                  "display": "Medical record number"
                }
              ]
            },
            "system": "https://healthid.abdm.gov.in",
            "value": "91-4820-1928-1120"
          },
          {
            "type": {
              "coding": [
                {
                  "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                  "code": "UDI",
                  "display": "Universal Device Identifier"
                }
              ]
            },
            "system": "https://phr.abdm.gov.in",
            "value": "ramesh.gowda@abdm"
          }
        ],
        "name": [
          {
            "text": "Ramesh Gowda",
            "family": "Gowda",
            "given": ["Ramesh"]
          }
        ],
        "gender": "male",
        "birthDate": "1972-04-14",
        "address": [
          {
            "text": "Holalkere Road, Hassan District, Karnataka",
            "district": "Hassan",
            "state": "Karnataka",
            "postalCode": "573201",
            "country": "IND"
          }
        ],
        "communication": [
          {
            "language": {
              "coding": [
                {
                  "system": "urn:ietf:bcp:47",
                  "code": "kn",
                  "display": "Kannada"
                }
              ]
            },
            "preferred": true
          }
        ]
      }
    },
    {
      "fullUrl": "urn:uuid:practitioner-ananya-sharma",
      "resource": {
        "resourceType": "Practitioner",
        "id": "practitioner-ananya-sharma",
        "meta": {
          "profile": [
            "https://nrces.in/ndhm/fhir/r4/StructureDefinition/Practitioner"
          ]
        },
        "identifier": [
          {
            "system": "https://hpr.abdm.gov.in",
            "value": "dr_ananya@hpr.abdm"
          },
          {
            "system": "https://nmc.org.in/registration",
            "value": "KMC-581920"
          }
        ],
        "name": [
          {
            "text": "Dr. Ananya Sharma",
            "family": "Sharma",
            "given": ["Ananya"],
            "prefix": ["Dr."]
          }
        ],
        "qualification": [
          {
            "code": {
              "coding": [
                {
                  "system": "http://snomed.info/sct",
                  "code": "394802001",
                  "display": "General medicine"
                }
              ],
              "text": "MBBS, MD (General Medicine)"
            }
          }
        ]
      }
    },
    {
      "fullUrl": "urn:uuid:org-facility-hassan-hub",
      "resource": {
        "resourceType": "Organization",
        "id": "org-facility-hassan-hub",
        "meta": {
          "profile": [
            "https://nrces.in/ndhm/fhir/r4/StructureDefinition/Organization"
          ]
        },
        "identifier": [
          {
            "system": "https://facility.abdm.gov.in",
            "value": "IN2910000123"
          }
        ],
        "name": "SwasthyaSetu Rural Tele-Clinic Hub",
        "telecom": [
          {
            "system": "phone",
            "value": "+91-80-28192831",
            "use": "work"
          }
        ],
        "address": [
          {
            "district": "Hassan",
            "state": "Karnataka",
            "postalCode": "573201",
            "country": "IND"
          }
        ]
      }
    },
    {
      "fullUrl": "urn:uuid:encounter-tele-9481",
      "resource": {
        "resourceType": "Encounter",
        "id": "encounter-tele-9481",
        "meta": {
          "profile": [
            "https://nrces.in/ndhm/fhir/r4/StructureDefinition/Encounter"
          ]
        },
        "status": "finished",
        "class": {
          "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
          "code": "VR",
          "display": "Virtual Telehealth Encounter"
        },
        "subject": {
          "reference": "urn:uuid:patient-ramesh-gowda"
        },
        "participant": [
          {
            "individual": {
              "reference": "urn:uuid:practitioner-ananya-sharma"
            }
          }
        ],
        "period": {
          "start": "2026-10-19T10:15:00Z",
          "end": "2026-10-19T10:45:00Z"
        }
      }
    },
    {
      "fullUrl": "urn:uuid:condition-calculus-kidney",
      "resource": {
        "resourceType": "Condition",
        "id": "condition-calculus-kidney",
        "meta": {
          "profile": [
            "https://nrces.in/ndhm/fhir/r4/StructureDefinition/Condition"
          ]
        },
        "clinicalStatus": {
          "coding": [
            {
              "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
              "code": "active",
              "display": "Active"
            }
          ]
        },
        "verificationStatus": {
          "coding": [
            {
              "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
              "code": "confirmed",
              "display": "Confirmed"
            }
          ]
        },
        "code": {
          "coding": [
            {
              "system": "http://snomed.info/sct",
              "code": "95570007",
              "display": "Calculus of kidney"
            },
            {
              "system": "http://hl7.org/fhir/sid/icd-10",
              "code": "N20.0",
              "display": "Calculus of kidney"
            }
          ],
          "text": "Right Renal Calculus (4.8mm)"
        },
        "subject": {
          "reference": "urn:uuid:patient-ramesh-gowda"
        },
        "recordedDate": "2026-10-19"
      }
    },
    {
      "fullUrl": "urn:uuid:med-drotaverine-80mg",
      "resource": {
        "resourceType": "MedicationRequest",
        "id": "med-drotaverine-80mg",
        "meta": {
          "profile": [
            "https://nrces.in/ndhm/fhir/r4/StructureDefinition/MedicationRequest"
          ]
        },
        "status": "active",
        "intent": "order",
        "medicationCodeableConcept": {
          "coding": [
            {
              "system": "http://snomed.info/sct",
              "code": "387494007",
              "display": "Drotaverine hydrochloride"
            }
          ],
          "text": "Drotaverine Hydrochloride 80 mg Oral Tablet"
        },
        "subject": {
          "reference": "urn:uuid:patient-ramesh-gowda"
        },
        "authoredOn": "2026-10-19T10:40:00Z",
        "requester": {
          "reference": "urn:uuid:practitioner-ananya-sharma"
        },
        "dosageInstruction": [
          {
            "text": "1 tablet three times daily after food for 5 days",
            "timing": {
              "repeat": {
                "frequency": 3,
                "period": 1,
                "periodUnit": "d"
              }
            },
            "route": {
              "coding": [
                {
                  "system": "http://snomed.info/sct",
                  "code": "260548002",
                  "display": "Oral"
                }
              ]
            },
            "doseAndRate": [
              {
                "doseQuantity": {
                  "value": 80,
                  "unit": "mg",
                  "system": "http://unitsofmeasure.org",
                  "code": "mg"
                }
              }
            ]
          }
        ]
      }
    },
    {
      "fullUrl": "urn:uuid:report-usg-kub-scan",
      "resource": {
        "resourceType": "DiagnosticReport",
        "id": "report-usg-kub-scan",
        "meta": {
          "profile": [
            "https://nrces.in/ndhm/fhir/r4/StructureDefinition/DiagnosticReportRadiology"
          ]
        },
        "status": "final",
        "category": [
          {
            "coding": [
              {
                "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
                "code": "RAD",
                "display": "Radiology"
              }
            ]
          }
        ],
        "code": {
          "coding": [
            {
              "system": "http://loinc.org",
              "code": "24725-4",
              "display": "US Kidneys and bladder"
            }
          ],
          "text": "Ultrasound KUB (Kidney, Ureter, Bladder)"
        },
        "subject": {
          "reference": "urn:uuid:patient-ramesh-gowda"
        },
        "effectiveDateTime": "2026-10-18T14:30:00Z",
        "conclusion": "4.8mm non-obstructing calculus seen in right middle calyx. No hydronephrosis.",
        "presentedForm": [
          {
            "contentType": "application/pdf",
            "url": "https://api.swasthyasetu.ai/api/v1/records/usg-kub-scan-9481/stream",
            "title": "USG KUB Scan Full Diagnostic Report.pdf"
          }
        ]
      }
    }
  ]
}
```

---

## 5. Official ABDM M3 Consent Artefact Specification (JSON)

When an ABHA patient approves a record access request from Dr. Ananya Sharma, the ABDM Consent Manager mints and cryptographically signs an immutable **Consent Artefact**:

```json
{
  "consentDetail": {
    "schemaVersion": "v0.5",
    "consentId": "ca-771928a0-9481-42cb-b1b0",
    "createdAt": "2026-10-19T10:15:22.102Z",
    "patient": {
      "id": "ramesh.gowda@abdm"
    },
    "consentManager": {
      "id": "sbx"
    },
    "hip": {
      "id": "IN2910000123",
      "name": "SwasthyaSetu Rural Tele-Clinic Hub"
    },
    "hiu": {
      "id": "IN2910000123",
      "name": "SwasthyaSetu Rural Tele-Clinic Hub"
    },
    "requester": {
      "name": "Dr. Ananya Sharma",
      "identifier": {
        "type": "REGNO",
        "value": "KMC-581920",
        "system": "https://nmc.org.in/registration"
      }
    },
    "purpose": {
      "code": "TREAT",
      "text": "Emergency Acute Flank Pain Tele-Triage & Treatment",
      "refUri": "http://terminology.hl7.org/CodeSystem/v3-ActReason"
    },
    "hiTypes": [
      "OPConsultation",
      "DiagnosticReport",
      "Prescription"
    ],
    "permission": {
      "accessMode": "VIEW",
      "dateRange": {
        "from": "2026-09-01T00:00:00.000Z",
        "to": "2026-10-19T23:59:59.000Z"
      },
      "dataEraseAt": "2026-10-19T12:00:00.000Z",
      "frequency": {
        "unit": "HOUR",
        "value": 1,
        "repeats": 0
      }
    },
    "careContexts": [
      {
        "patientReference": "ramesh-gowda",
        "careContextReference": "CARE-CTX-2026-ENC-9481"
      }
    ]
  },
  "signature": "MEUCIQDZ63kP81k39lq/z6L7d2n8kK2Lp1q0Z8VbX+9kLmNjAQIgU3..."
}
```

---

## 6. Serialization & Verification Instructions

### 6.1 Backend FHIR Bundle Generation Pipeline
1. **Pydantic Serialization:** Ensure that all FHIR generators in `app/services/fhir_service.py` validate against official NRCeS resource schemas.
2. **Deterministic References:** All internal cross-references within the Document Bundle must use valid `urn:uuid:<id>` references matching entry `fullUrl` values.
3. **ABDM Sandbox Certification:** Test bundle compliance against the ABDM official mock validator at `https://sandbox.abdm.gov.in/tools/fhir-validator` before initiating HIP/HIU production data exchange.
