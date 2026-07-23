import { describe, expect, it } from 'vitest';
import { cycleScanFilter, rotateScanPage, type ScanPage } from './scanDocument';

const page: ScanPage = { id: '1', dataUrl: 'data:image/jpeg;base64,', rotation: 0, filter: 'color', ocrText: '' };

describe('scanDocument', () => {
  it('rotates pages in quarter turns', () => {
    expect(rotateScanPage(page).rotation).toBe(90);
    expect(rotateScanPage({ ...page, rotation: 270 }).rotation).toBe(0);
  });

  it('cycles through Apple Notes-style scan filters', () => {
    expect(cycleScanFilter(page).filter).toBe('grayscale');
    expect(cycleScanFilter({ ...page, filter: 'grayscale' }).filter).toBe('contrast');
    expect(cycleScanFilter({ ...page, filter: 'contrast' }).filter).toBe('color');
  });
});
