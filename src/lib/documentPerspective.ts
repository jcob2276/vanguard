export interface NormalizedPoint { x: number; y: number }
export interface DocumentCorners {
  topLeft: NormalizedPoint;
  topRight: NormalizedPoint;
  bottomLeft: NormalizedPoint;
  bottomRight: NormalizedPoint;
}

export const DEFAULT_DOCUMENT_CORNERS: DocumentCorners = {
  topLeft: { x: 0.04, y: 0.04 },
  topRight: { x: 0.96, y: 0.04 },
  bottomLeft: { x: 0.04, y: 0.96 },
  bottomRight: { x: 0.96, y: 0.96 },
};

async function loadScanner() {
  const cvWindow = globalThis as typeof globalThis & {
    cv?: { Mat?: unknown; onRuntimeInitialized?: () => void };
  };
  if (!cvWindow.cv?.Mat) {
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-opencv-notes]');
      const script = existing ?? document.createElement('script');
      const ready = () => {
        if (cvWindow.cv?.Mat) resolve();
        else if (cvWindow.cv) cvWindow.cv.onRuntimeInitialized = resolve;
        else reject(new Error('OpenCV nie został uruchomiony.'));
      };
      script.addEventListener('load', ready, { once: true });
      script.addEventListener('error', () => reject(new Error('Nie udało się załadować korekty perspektywy.')), { once: true });
      if (!existing) {
        script.src = 'https://docs.opencv.org/4.7.0/opencv.js';
        script.async = true;
        script.dataset.opencvNotes = 'true';
        document.head.appendChild(script);
      } else {
        ready();
      }
    });
  }
  const { default: JScanify } = await import('jscanify/client');
  return new JScanify();
}

async function loadImage(source: string) {
  const image = new Image();
  image.src = source;
  await image.decode();
  return image;
}

export async function correctDocumentPerspective(
  source: string,
  corners?: DocumentCorners,
): Promise<string> {
  const image = await loadImage(source);
  try {
    const scanner = await loadScanner();
    const points = corners ? {
      topLeftCorner: { x: corners.topLeft.x * image.width, y: corners.topLeft.y * image.height },
      topRightCorner: { x: corners.topRight.x * image.width, y: corners.topRight.y * image.height },
      bottomLeftCorner: { x: corners.bottomLeft.x * image.width, y: corners.bottomLeft.y * image.height },
      bottomRightCorner: { x: corners.bottomRight.x * image.width, y: corners.bottomRight.y * image.height },
    } : undefined;
    return scanner.extractPaper(image, 1240, 1754, points)?.toDataURL('image/jpeg', 0.92) ?? source;
  } catch {
    return source;
  }
}
