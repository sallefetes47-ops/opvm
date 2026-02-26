﻿﻿type ScannerJs = {
  scan: (success: (message: unknown) => void, error: (message: unknown) => void, config?: string) => void;
};

declare global {
  interface Window {
    scannerjs?: ScannerJs;
  }
}

const DEFAULT_SOURCE = "Kyocera FS-1035MFP WIA Driver";
const BRIDGE_SCRIPT_URLS = [
  "http://localhost:18485/scanner.js",
  "http://127.0.0.1:18485/scanner.js",
  "http://localhost:18485/scanner/scanner.js",
  "http://127.0.0.1:18485/scanner/scanner.js",
  "http://127.0.0.1:8080/scanner.js",
  "http://localhost:8080/scanner.js",
  "http://127.0.0.1:8081/scanner.js",
  "http://localhost:8081/scanner.js",
];

function getScannerBridgeError(): Error {
  return new Error("تعذر الاتصال بجسر الماسح الضوئي (Scanner Bridge). يرجى تشغيله أولاً للاتصال بجهاز Kyocera.");
}

function maybeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function findDataUrl(input: unknown): string | null {
  if (!input) return null;
  if (typeof input === "string") {
    if (input.startsWith("data:")) return input;
    const parsed = maybeParseJson(input);
    if (parsed !== input) return findDataUrl(parsed);
    return null;
  }
  if (Array.isArray(input)) {
    for (const item of input) {
      const found = findDataUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof input === "object") {
    const candidateKeys = ["data", "dataUrl", "imageData", "images", "result"];
    const record = input as Record<string, unknown>;
    for (const key of candidateKeys) {
      const found = findDataUrl(record[key]);
      if (found) return found;
    }
  }
  return null;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function blobToHighQualityJpeg(blob: Blob, filename: string): Promise<File> {
  if (blob.type === "image/jpeg") {
    return new File([blob], filename, { type: "image/jpeg" });
  }

  const imageBitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = imageBitmap.width;
  canvas.height = imageBitmap.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not available for image conversion.");
  }
  context.drawImage(imageBitmap, 0, 0);

  const converted = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Failed to convert scanned image to JPG."));
      },
      "image/jpeg",
      0.95
    );
  });

  return new File([converted], filename, { type: "image/jpeg" });
}

function loadBridgeScript(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(false);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[data-scanner-bridge="${url}"]`);
    if (existing) {
      resolve(Boolean(window.scannerjs));
      return;
    }

    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.scannerBridge = url;
    script.onload = () => resolve(Boolean(window.scannerjs));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

async function ensureScannerBridgeAvailable(): Promise<void> {
  if (typeof window === "undefined") {
    throw getScannerBridgeError();
  }
  if (window.scannerjs) return;

  for (const url of BRIDGE_SCRIPT_URLS) {
    const loaded = await loadBridgeScript(url);
    if (loaded && window.scannerjs) return;
  }

  if (!window.scannerjs) {
    throw getScannerBridgeError();
  }
}

export async function scanFromLocalScanner(preferredSource = DEFAULT_SOURCE): Promise<File> {
  await ensureScannerBridgeAvailable();

  const config = JSON.stringify({
    select_source: preferredSource,
    prompt_scan_more: false,
    output_settings: [
      {
        type: "return-base64",
        format: "jpg",
        jpg_quality: 95,
      },
    ],
  });

  const result = await new Promise<unknown>((resolve, reject) => {
    window.scannerjs?.scan(
      (message) => resolve(message),
      (message) => reject(new Error(String(message))),
      config
    );
  });

  const dataUrl = findDataUrl(result);
  if (!dataUrl) {
    throw new Error("No scanned image was returned from the scanner.");
  }

  const blob = await dataUrlToBlob(dataUrl);
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  return blobToHighQualityJpeg(blob, `scan_${timestamp}.jpg`);
}
