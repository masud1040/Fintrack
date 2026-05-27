import { jsPDF } from 'jspdf';

// In-memory cache for base64 encoded font files
interface FontCache {
  bengaliRegular?: string;
  bengaliBold?: string;
  englishRegular?: string;
  englishBold?: string;
}

const fontCache: FontCache = {};

// Google Fonts direct CDN resources (using raw.githubusercontent.com for fast CORS-enabled requests)
const BENGALI_REGULAR_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/hindsiliguri/HindSiliguri-Regular.ttf';
const BENGALI_BOLD_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/hindsiliguri/HindSiliguri-Bold.ttf';

// Tinos is Google's metrically compatible equivalent to Times New Roman, perfect for embedding as OFL
const ENGLISH_REGULAR_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/tinos/Tinos-Regular.ttf';
const ENGLISH_BOLD_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/tinos/Tinos-Bold.ttf';

async function fetchFontAsBase64(url: string, name: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP status ${res.status}`);
    }
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  } catch (error) {
    console.warn(`[FontLoader] Failed to load ${name} font from online source:`, error);
    throw error;
  }
}

/**
 * Loads Hind Siliguri (Bengali) and Times New Roman (English Tinos match) into jsPDF.
 * Fallbacks to standard helvetica/times if fetching fails.
 * @returns true if custom fonts were successfully loaded and configured
 */
export async function setupPDFCustomFonts(doc: jsPDF): Promise<boolean> {
  try {
    const [bReg, bBold, eReg, eBold] = await Promise.all([
      fontCache.bengaliRegular || fetchFontAsBase64(BENGALI_REGULAR_URL, 'HindSiliguri-Regular'),
      fontCache.bengaliBold || fetchFontAsBase64(BENGALI_BOLD_URL, 'HindSiliguri-Bold'),
      fontCache.englishRegular || fetchFontAsBase64(ENGLISH_REGULAR_URL, 'Tinos-Regular (Times New Roman)'),
      fontCache.englishBold || fetchFontAsBase64(ENGLISH_BOLD_URL, 'Tinos-Bold (Times New Roman-Bold)')
    ]);

    // Save fetched results to in-memory cache to optimize future calls
    fontCache.bengaliRegular = bReg;
    fontCache.bengaliBold = bBold;
    fontCache.englishRegular = eReg;
    fontCache.englishBold = eBold;

    // Register Hind Siliguri
    doc.addFileToVFS('HindSiliguri-Regular.ttf', bReg);
    doc.addFont('HindSiliguri-Regular.ttf', 'Hind Siliguri', 'normal');
    doc.addFileToVFS('HindSiliguri-Bold.ttf', bBold);
    doc.addFont('HindSiliguri-Bold.ttf', 'Hind Siliguri', 'bold');

    // Register Times New Roman
    doc.addFileToVFS('TimesNewRoman-Regular.ttf', eReg);
    doc.addFont('TimesNewRoman-Regular.ttf', 'Times New Roman', 'normal');
    doc.addFileToVFS('TimesNewRoman-Bold.ttf', eBold);
    doc.addFont('TimesNewRoman-Bold.ttf', 'Times New Roman', 'bold');

    return true;
  } catch (error) {
    console.warn('[FontLoader] Falling back to default system fonts due to loading errors. PDFs will render in Standard Helvetica/Times.', error);
    return false;
  }
}
