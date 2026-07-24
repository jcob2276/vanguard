/**
 * EMF & Magnetometer Sensor Helper (Sensor.TYPE_MAGNETIC_FIELD)
 * Reads magnetic field strength in microTeslas (µT).
 * Earth baseline: ~30–50 µT.
 * Elevated EMF (chargers/transformers near head): > 100 µT.
 */

export interface EMFReading {
  hardwareAvailable: boolean;
  totalMicroTesla: number | null;
  x: number | null;
  y: number | null;
  z: number | null;
  isElevated: boolean;
  status: 'safe' | 'moderate' | 'high' | 'no_sensor';
  recommendation: string | null;
  errorReason?: string;
}

export async function readMagnetometerEMF(): Promise<EMFReading> {
  // Check if Web Magnetometer API is available in window
  if (typeof window !== 'undefined' && 'Magnetometer' in window) {
    try {
      // @ts-ignore - Web Magnetometer API (Chrome / Android HTTPS)
      const sensor = new window.Magnetometer({ frequency: 10 });
      return await new Promise<EMFReading>((resolve) => {
        sensor.addEventListener(
          'reading',
          () => {
            const x = sensor.x || 0;
            const y = sensor.y || 0;
            const z = sensor.z || 0;
            const totalMicroTesla = Math.round(Math.sqrt(x * x + y * y + z * z));
            sensor.stop();
            resolve(formatEMFReading(totalMicroTesla, x, y, z, true));
          },
          { once: true }
        );

        sensor.addEventListener(
          'error',
          (_err: unknown) => {
            resolve({
              hardwareAvailable: false,
              totalMicroTesla: null,
              x: null,
              y: null,
              z: null,
              isElevated: false,
              status: 'no_sensor',
              recommendation: null,
              errorReason: 'Fizyczny czujnik pola magnetycznego niedostępny w przeglądarce.',
            });
          },
          { once: true }
        );

        sensor.start();
      });
    } catch (_e: unknown) {
      return {
        hardwareAvailable: false,
        totalMicroTesla: null,
        x: null,
        y: null,
        z: null,
        isElevated: false,
        status: 'no_sensor',
        recommendation: null,
        errorReason: 'Wymaga aplikacji Android APK z dostępem do Sensor.TYPE_MAGNETIC_FIELD.',
      };
    }
  }

  // Web Browser without Web Magnetometer API
  return {
    hardwareAvailable: false,
    totalMicroTesla: null,
    x: null,
    y: null,
    z: null,
    isElevated: false,
    status: 'no_sensor',
    recommendation: null,
    errorReason: 'Wymaga aplikacji Android APK z dostępem do Sensor.TYPE_MAGNETIC_FIELD.',
  };
}

function formatEMFReading(
  totalMicroTesla: number,
  x: number,
  y: number,
  z: number,
  hardwareAvailable: boolean
): EMFReading {
  const isElevated = totalMicroTesla > 90;
  const isHigh = totalMicroTesla > 160;

  const status: 'safe' | 'moderate' | 'high' = isHigh ? 'high' : isElevated ? 'moderate' : 'safe';

  const recommendation = isHigh
    ? `⚠️ Wykryto silne pole elektromagnetyczne (${totalMicroTesla} µT)! Odsuń telefon i zasilacze na min. 50 cm od poduszki.`
    : isElevated
    ? `⚡ Podwyższone pole magnetyczne (${totalMicroTesla} µT). Telefon leży blisko urządzeń elektrycznych.`
    : `✅ Optymalny poziom pola magnetycznego (${totalMicroTesla} µT). Sypialnia bezpieczna dla regeneracji.`;

  return {
    hardwareAvailable,
    totalMicroTesla,
    x: Math.round(x),
    y: Math.round(y),
    z: Math.round(z),
    isElevated,
    status,
    recommendation,
  };
}
