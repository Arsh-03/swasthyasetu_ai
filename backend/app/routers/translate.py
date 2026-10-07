from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.translation_service import translation_engine

router = APIRouter(prefix="/translate", tags=["Dynamic Translation Engine"])

class TranslationRequest(BaseModel):
    text: str
    target_lang: str  # 'kn' (Kannada), 'hi' (Hindi), 'en' (English)
    source_lang: Optional[str] = "en"

class BatchTranslationRequest(BaseModel):
    texts: List[str]
    target_lang: str
    source_lang: Optional[str] = "en"

class CarePlanTranslationRequest(BaseModel):
    care_plan: Dict[str, Any]
    target_lang: str

@router.get("/languages")
async def get_supported_languages():
    """
    Returns the supported Indian languages for real-time dynamic translation.
    """
    return {
        "supported_languages": [
            {"code": "en", "name": "English", "native": "English", "bhashini_code": "en"},
            {"code": "kn", "name": "Kannada", "native": "ಕನ್ನಡ", "bhashini_code": "kn"},
            {"code": "hi", "name": "Hindi", "native": "हिन्दी", "bhashini_code": "hi"}
        ],
        "default": "en",
        "engine": "Bhashini Indic Clinical Translation Service"
    }

@router.post("")
async def translate_single(payload: TranslationRequest):
    """
    Translate arbitrary clinical, chat, or interface text on-the-fly.
    """
    try:
        translated = await translation_engine.translate_text(
            text=payload.text,
            target_lang=payload.target_lang,
            source_lang=payload.source_lang or "en"
        )
        return {
            "source_text": payload.text,
            "translated_text": translated,
            "source_lang": payload.source_lang or "en",
            "target_lang": payload.target_lang,
            "cached": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dynamic translation failed: {str(e)}")

@router.post("/batch")
async def translate_batch(payload: BatchTranslationRequest):
    """
    Translate multiple strings in a single batch request.
    """
    results = []
    for item in payload.texts:
        trans = await translation_engine.translate_text(
            text=item,
            target_lang=payload.target_lang,
            source_lang=payload.source_lang or "en"
        )
        results.append(trans)
    return {
        "translations": results,
        "target_lang": payload.target_lang
    }

@router.post("/careplan")
async def translate_care_plan_endpoint(payload: CarePlanTranslationRequest):
    """
    Dynamically translate clinical care plan including SOAP notes, medication timings, and dietary advice.
    """
    try:
        translated_plan = await translation_engine.translate_care_plan(
            plan_data=payload.care_plan,
            target_lang=payload.target_lang
        )
        return {
            "success": True,
            "target_lang": payload.target_lang,
            "care_plan": translated_plan
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Care plan translation failed: {str(e)}")
