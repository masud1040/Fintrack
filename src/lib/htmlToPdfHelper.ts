import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { savePDF } from './utils';

// Cache for converted values to improve performance
const oklchCache = new Map<string, string>();

/**
 * Resolves an oklch color string into standard hex/rgb using the browser's HTMLCanvasElement
 */
function oklchToRgb(oklchStr: string): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'rgb(0,0,0)';
    ctx.fillStyle = oklchStr;
    const resolved = ctx.fillStyle;
    if (resolved && !resolved.includes('oklch')) {
      return resolved;
    }
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
  } catch (e) {
    return 'rgb(0, 0, 0)';
  }
}

/**
 * Sweeps a string for oklch values and replaces them with canvas-resolved rgb values
 */
export function convertOklchToRgb(val: string): string {
  if (!val || typeof val !== 'string') return val;
  if (!val.includes('oklch')) return val;
  
  if (oklchCache.has(val)) {
    return oklchCache.get(val)!;
  }
  
  let processed = val;
  const oklchRegex = /oklch\([^)]+\)/g;
  let match;
  while ((match = oklchRegex.exec(val)) !== null) {
    const originalMatch = match[0];
    const rgbConverted = oklchToRgb(originalMatch);
    processed = processed.replace(originalMatch, rgbConverted);
  }
  
  oklchCache.set(val, processed);
  return processed;
}

/**
 * Executes html2canvas inside a proxy that intercepts getComputedStyle
 *, resolving tailwind v4's oklch variables on-the-fly and mapping them to safe rgb fallbacks.
 */
export async function safeHtml2Canvas(element: HTMLElement, options?: any) {
  const originalGetComputedStyle = window.getComputedStyle;

  window.getComputedStyle = function (elt, pseudoElt) {
    const style = originalGetComputedStyle(elt, pseudoElt);
    if (!style) return style;

    return new Proxy(style, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          return (propertyName: string) => {
            const val = target.getPropertyValue(propertyName);
            return convertOklchToRgb(val);
          };
        }

        let val;
        try {
          // Access prop as a property of style directly inside a try/catch to maintain native bindings
          val = target[prop as any];
        } catch (e) {
          val = Reflect.get(target, prop);
        }

        if (typeof val === 'function') {
          return val.bind(target);
        }

        if (typeof val === 'string') {
          return convertOklchToRgb(val);
        }
        return val;
      }
    }) as any;
  };

  try {
    return await html2canvas(element, options);
  } finally {
    window.getComputedStyle = originalGetComputedStyle;
  }
}

interface HtmlToPdfOptions {
  fileName: string;
  isThermalReceipt?: boolean;
}

/**
 * Renders HTML content into a high-quality PDF, solving Bengali font shaping issues
 * by using the browser's native text rendering engine via html2canvas.
 */
export async function generateHtmlPdf(htmlContent: string, options: HtmlToPdfOptions) {
  const { fileName, isThermalReceipt = false } = options;

  // Create a temporary off-screen container
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  // Use professional widths depending on document style
  container.style.width = isThermalReceipt ? '340px' : '794px'; // Proportional width for beautiful layout
  container.className = "bg-white text-slate-800 antialiased";
  container.innerHTML = htmlContent;
  document.body.appendChild(container);

  try {
    // Ensure all custom fonts (Hind Siliguri, Tinos, Inter) are fully loaded
    await document.fonts.ready;
    // Small timeout to allow browser layout & font mapping to complete
    await new Promise((resolve) => setTimeout(resolve, 350));

    // Use our custom safeHtml2Canvas wrapping to bypass oklch parsing issues!
    const canvas = await safeHtml2Canvas(container, {
      scale: 2.5, // Crisp high-definition text
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');

    let pdf: jsPDF;

    if (isThermalReceipt) {
      // Calculate custom proportional dimensions for the thermal ticket strip (80mm width standard)
      const pdfWidth = 80;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [pdfWidth, pdfHeight],
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    } else {
      // Standard A4 dimensions (210mm x 297mm)
      pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
    }

    // Hand over to utils.savePDF which is secure and cross-platform native compatible!
    await savePDF(pdf, fileName);
  } catch (error) {
    console.error('[pdfHtmlHelper] Error compiling HTML to PDF:', error);
  } finally {
    // Safely cleanup DOM
    if (container.parentElement) {
      document.body.removeChild(container);
    }
  }
}
