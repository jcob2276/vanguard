type ScanFilter = 'color' | 'grayscale' | 'contrast';

export interface ScanPage {
  id: string;
  dataUrl: string;
  sourceDataUrl?: string;
  rotation: 0 | 90 | 180 | 270;
  filter: ScanFilter;
  ocrText: string;
}

const nextRotation = (rotation: ScanPage['rotation']): ScanPage['rotation'] => (
  ((rotation + 90) % 360) as ScanPage['rotation']
);

export const rotateScanPage = (page: ScanPage): ScanPage => ({
  ...page,
  rotation: nextRotation(page.rotation),
});

export const cycleScanFilter = (page: ScanPage): ScanPage => ({
  ...page,
  filter: page.filter === 'color' ? 'grayscale' : page.filter === 'grayscale' ? 'contrast' : 'color',
});

async function renderPage(page: ScanPage): Promise<string> {
  const image = new Image();
  image.src = page.dataUrl;
  await image.decode();
  const sideways = page.rotation === 90 || page.rotation === 270;
  const canvas = document.createElement('canvas');
  canvas.width = sideways ? image.height : image.width;
  canvas.height = sideways ? image.width : image.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Przeglądarka nie obsługuje przetwarzania obrazu.');
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(page.rotation * Math.PI / 180);
  context.filter = page.filter === 'grayscale'
    ? 'grayscale(1)'
    : page.filter === 'contrast' ? 'grayscale(1) contrast(1.65)' : 'none';
  context.drawImage(image, -image.width / 2, -image.height / 2);
  return canvas.toDataURL('image/jpeg', 0.9);
}

export async function createScanPdf(pages: ScanPage[]): Promise<File> {
  if (!pages.length) throw new Error('Dodaj przynajmniej jedną stronę.');
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  for (const scanPage of pages) {
    const dataUrl = await renderPage(scanPage);
    const image = await pdf.embedJpg(dataUrl);
    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  const bytes = await pdf.save();
  return new File([new Uint8Array(bytes)], `skan-${Date.now()}.pdf`, { type: 'application/pdf' });
}
