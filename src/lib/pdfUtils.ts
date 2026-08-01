import * as pdfjsLib from "pdfjs-dist";

if (typeof window !== "undefined") {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || "4.10.38"}/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn("Failed to set PDF worker src:", e);
  }
}

/**
 * Converts a PDF file into one or more JPEG data URLs (one per page).
 */
export async function convertPdfFileToJpegDataUrls(file: File): Promise<{ fileName: string; dataUrl: string }[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdfDoc = await loadingTask.promise;
    const pageImages: { fileName: string; dataUrl: string }[] = [];

    const baseName = file.name.replace(/\.pdf$/i, "");

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      if (context) {
        context.fillStyle = "#FFFFFF";
        context.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: context, viewport, canvas } as any).promise;
        const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.85);
        const outputFileName = pdfDoc.numPages > 1
          ? `${baseName}_page_${pageNum}.jpg`
          : `${baseName}.jpg`;
        
        pageImages.push({
          fileName: outputFileName,
          dataUrl: jpegDataUrl
        });
      }
    }

    if (pageImages.length > 0) {
      return pageImages;
    }
  } catch (err) {
    console.error("Failed to convert PDF to JPEG using pdfjs-dist:", err);
  }

  return [];
}

/**
 * Reads any uploaded File object and converts it to formatted attachment strings ("fileName::dataUrl").
 * If the file is a PDF, it converts each page of the PDF into a JPEG image so it saves as JPEG in /uploads/ for easy preview.
 */
export async function processFileToAttachmentStrings(file: File): Promise<string[]> {
  const name = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");

  if (isPdf) {
    try {
      const jpegs = await convertPdfFileToJpegDataUrls(file);
      if (jpegs && jpegs.length > 0) {
        return jpegs.map(j => `${j.fileName}::${j.dataUrl}`);
      }
    } catch (err) {
      console.warn("PDF conversion failed, falling back to reading data URL:", err);
    }
  }

  return new Promise<string[]>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (file.type.startsWith("image/")) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_DIM = 800;
          let width = img.width;
          let height = img.height;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.75);
          resolve([`${file.name}::${compressed}`]);
        };
        img.onerror = () => {
          resolve([`${file.name}::${result}`]);
        };
        img.src = result;
      } else {
        resolve([`${file.name}::${result}`]);
      }
    };
    reader.onerror = () => {
      resolve([`${file.name}::data:text/plain;base64,RXJyb3IgcmVhZGluZyBmaWxl`]);
    };
    reader.readAsDataURL(file);
  });
}
