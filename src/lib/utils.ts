import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 2
  }).format(amount);
}

export async function savePDF(docOrBase64: any, fileName: string) {
  if (Capacitor.isNativePlatform()) {
    try {
      let pdfBase64: string;
      
      if (typeof docOrBase64 === 'string') {
        // If it's already a base64 string (from data URI)
        pdfBase64 = docOrBase64.includes(',') ? docOrBase64.split(',')[1] : docOrBase64;
      } else {
        // If it's a jsPDF instance
        pdfBase64 = docOrBase64.output('datauristring').split(',')[1];
      }
      
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Documents,
      });

      await Share.share({
        title: 'Share PDF',
        text: 'Financial Report',
        url: savedFile.uri,
        dialogTitle: 'Share PDF',
      });
    } catch (error) {
      console.error('Error saving PDF on native platform:', error);
    }
  } else {
    if (typeof docOrBase64 === 'string') {
      // For base64 strings in browser, we need to convert to blob and download
      const link = document.createElement('a');
      link.href = docOrBase64.startsWith('data:') ? docOrBase64 : `data:application/pdf;base64,${docOrBase64}`;
      link.download = fileName;
      link.click();
    } else {
      docOrBase64.save(fileName);
    }
  }
}
