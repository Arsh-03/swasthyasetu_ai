import * as DocumentPicker from 'expo-document-picker';
import type { UploadDocumentInput } from '../services/api';

/**
 * Opens system document picker to select a medical report (PDF or image).
 * Works across Web, iOS, and Android.
 */
export async function pickHealthReportDocument(): Promise<UploadDocumentInput | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      name: asset.name || 'medical_report.pdf',
      type: asset.mimeType || (asset.name?.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
      fileObj: (asset as any).file,
    };
  } catch (err) {
    console.warn('[DocumentPicker] pick failed:', err);
    return null;
  }
}
