from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from app.schemas.schemas import DDIValidationIn, DDIAlertOut
from app.services.ddi_engine import check_drug_safety
from app.services.auth_dependencies import require_doctor

router = APIRouter(prefix="/cdss", tags=["cdss"])

@router.post("/validate", response_model=List[DDIAlertOut])
async def validate_prescriptions(
    data: DDIValidationIn,
    current_doctor: Dict[str, Any] = Depends(require_doctor)
):
    """
    Deterministic rule check comparing proposed medications against patient's current medication list.
    Flags interactions (DDInter 2.0 + curated NFI rules) and allergy conflicts, each with its source.
    """
    alerts = check_drug_safety(data.proposed_drugs, data.patient_active_meds, data.allergies)
    
    output = []
    for a in alerts:
        output.append(DDIAlertOut(
            has_contraindication=True,
            severity=a["severity"],
            conflicting_pair=a["conflicting_pair"],
            clinical_mechanism=a["clinical_mechanism"],
            formulary_citation=a["formulary_citation"],
            recommended_action=a["recommended_action"]
        ))
    return output
