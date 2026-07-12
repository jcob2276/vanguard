import { describe, it, expect } from 'vitest';
import { isOfflineError } from './offlineQueue';

// Note: queueOfflineWrite uses IndexedDB which is available in happy-dom
// We test isOfflineError (pure) and the offline detection logic here

describe('offlineQueue', () => {
  describe('isOfflineError', () => {
    it('returns true when navigator.onLine is false', () => {
      const original = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      expect(isOfflineError(new Error('anything'))).toBe(true);
      Object.defineProperty(navigator, 'onLine', { value: original, configurable: true });
    });

    it('detects "Failed to fetch" errors (fetch API offline)', () => {
      expect(isOfflineError(new Error('Failed to fetch'))).toBe(true);
      expect(isOfflineError(new Error('failed to fetch'))).toBe(true);
    });

    it('detects NetworkError', () => {
      expect(isOfflineError(new Error('NetworkError when attempting to fetch resource'))).toBe(true);
    });

    it('detects "Network request failed"', () => {
      expect(isOfflineError(new Error('Network request failed'))).toBe(true);
    });

    it('returns false for application errors (auth, validation)', () => {
      expect(isOfflineError(new Error('JWT expired'))).toBe(false);
      expect(isOfflineError(new Error('Row not found'))).toBe(false);
      expect(isOfflineError(new Error('invalid input syntax'))).toBe(false);
    });

    it('handles non-Error objects', () => {
      expect(isOfflineError('failed to fetch')).toBe(true);
      expect(isOfflineError({ message: 'some error' })).toBe(false);
    });

    it('handles null/undefined gracefully', () => {
      expect(() => isOfflineError(null)).not.toThrow();
      expect(() => isOfflineError(undefined)).not.toThrow();
    });
  });
});
