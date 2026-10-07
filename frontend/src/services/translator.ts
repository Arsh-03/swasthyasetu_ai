import type { Language, ClinicalNote } from '../types';
import { authFetch } from './apiClient';

interface TranslationResponse {
  source_text: string;
  translated_text: string;
  source_lang: string;
  target_lang: string;
  cached: boolean;
}

class DynamicTranslationClient {
  private memCache: Map<string, string> = new Map();

  private getStorageKey(text: string, targetLang: Language): string {
    return `cb_trans_${targetLang}_${text.trim().toLowerCase().slice(0, 60)}`;
  }

  async translateText(text: string, targetLang: Language, sourceLang: string = 'en'): Promise<string> {
    if (!text || targetLang === 'en') {
      return text;
    }

    const cacheKey = `${sourceLang}:${targetLang}:${text.trim().toLowerCase()}`;

    // 1. Check in-memory cache
    if (this.memCache.has(cacheKey)) {
      return this.memCache.get(cacheKey)!;
    }

    // 2. Check localStorage cache
    try {
      const stored = localStorage.getItem(this.getStorageKey(text, targetLang));
      if (stored) {
        this.memCache.set(cacheKey, stored);
        return stored;
      }
    } catch {
      // Ignore localStorage errors
    }

    // 3. Fetch from Dynamic Backend AI Translation API
    try {
      const response = await authFetch('/api/v1/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          target_lang: targetLang,
          source_lang: sourceLang
        })
      });

      if (response.ok) {
        const data: TranslationResponse = await response.json();
        const result = data.translated_text;

        this.memCache.set(cacheKey, result);
        try {
          localStorage.setItem(this.getStorageKey(text, targetLang), result);
        } catch {
          // LocalStorage quota handling
        }

        return result;
      }
    } catch (err) {
      console.warn("Dynamic translation request failed, using fallback:", err);
    }

    return text;
  }

  async translateCarePlan(note: ClinicalNote, targetLang: Language): Promise<ClinicalNote> {
    if (!note || targetLang === 'en') {
      return note;
    }

    try {
      const res = await authFetch('/api/v1/translate/careplan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          care_plan: note,
          target_lang: targetLang
        })
      });

      if (res.ok) {
        const data = await res.json();
        return data.care_plan;
      }
    } catch {
      // Fallback
    }

    // Client-side translation fallback
    const translatedAssessment = await this.translateText(note.assessment, targetLang);
    const translatedDiet = note.plan?.dietary_advice
      ? await this.translateText(note.plan.dietary_advice, targetLang)
      : note.plan?.dietary_advice;
    const translatedRedFlags = note.plan?.red_flags
      ? await this.translateText(note.plan.red_flags, targetLang)
      : note.plan?.red_flags;

    return {
      ...note,
      assessment: translatedAssessment,
      plan: {
        ...note.plan,
        dietary_advice: translatedDiet || '',
        red_flags: translatedRedFlags || ''
      }
    };
  }
}

export const dynamicTranslator = new DynamicTranslationClient();
