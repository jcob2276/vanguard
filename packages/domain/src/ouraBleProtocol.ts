/**
 * Oura Ring BLE GATT Protocol constants & decoders (Clean-room specification derived from noop).
 * Foundation for Direct Bluetooth sync with Oura Ring Gen 3 (Heritage/Horizon), Gen 4, Gen 5.
 */

export const OURA_GATT = {
  /** Service UUID shared across Gen 3 / Gen 4 / Gen 5 */
  SERVICE_UUID: '98ED0001-A541-11E4-B6A0-0002A5D5C51B',
  /** Write characteristic (Phone -> Ring, Write Without Response) */
  WRITE_CHAR_UUID: '98ED0002-A541-11E4-B6A0-0002A5D5C51B',
  /** Notify characteristic (Ring -> Phone, Handle-Value-Notification) */
  NOTIFY_CHAR_UUID: '98ED0003-A541-11E4-B6A0-0002A5D5C51B',
  /** MTU sizes */
  MTU_GEN3: 203,
  MTU_GEN4_5: 247,
  ATT_OVERHEAD: 3,
};

export enum OuraEventTag {
  RING_START = 0x41,
  TIME_SYNC = 0x42,
  STATE_CHANGE = 0x45,
  WEAR_EVENT = 0x53,
  IBI_AMPLITUDE = 0x60,
  GREEN_IBI_QUALITY = 0x80,
  HRV_RMSSD = 0x5d,
  SPO2_STABLE = 0x7b,
  TEMP = 0x46,
  SLEEP_TEMP = 0x75,
  MOTION = 0x47,
  SLEEP_PHASE = 0x4e,
  SLEEP_PHASE_ALT = 0x5a,
}

export interface OuraDecodedIbi {
  ringTimestamp: number;
  ibiMs: number;
  amplitude?: number;
}

export interface OuraDecodedSleepPhase {
  ringTimestamp: number;
  phaseCode: number; // 0 = Awake, 1 = REM, 2 = Light, 3 = Deep
}

export interface OuraDecodedTemp {
  ringTimestamp: number;
  tempDeltaCelsius: number;
}

/**
 * Decodes 0x80 green_ibi_quality_event (14-byte bit-packed samples).
 * 7 samples per record. Sample format: bits 0-10 = IBI ms, bits 11-13 = qualA, bits 14-15 = qualB.
 */
export function decodeGreenIbiQuality(payload: Uint8Array, ringTimestamp: number): OuraDecodedIbi[] {
  if (payload.length < 2 || payload.length % 2 !== 0) return [];
  const out: OuraDecodedIbi[] = [];
  const maxSamples = Math.min(7, Math.floor(payload.length / 2));

  for (let i = 0; i < maxSamples; i++) {
    const offset = i * 2;
    const sample = payload[offset] | (payload[offset + 1] << 8);
    const ibiMs = sample & 0x07ff; // bits 0-10
    const qualA = (sample >> 11) & 0x07; // bits 11-13
    const qualB = (sample >> 14) & 0x03; // bits 14-15

    // Accept sample only if qualA <= 1 and qualB == 0
    if (qualA <= 1 && qualB === 0 && ibiMs > 0) {
      out.push({ ringTimestamp, ibiMs });
    }
  }

  return out;
}

/**
 * Decodes Live-HR push notification payload (sub-op 0x28).
 * Wire format: IBI is 12-bit value at body indices 5..6.
 */
export function decodeLiveHRPush(body: Uint8Array, ringTimestamp: number): { bpm: number; ibiMs: number; ringTimestamp: number } | null {
  if (body.length < 7) return null;
  const ibiMs = ((body[6] & 0x0f) << 8) | body[5];
  if (ibiMs <= 0) return null;

  const bpm = Math.round(60000 / ibiMs);
  if (bpm <= 0 || bpm > 300) return null;

  return { bpm, ibiMs, ringTimestamp };
}

/**
 * Decodes temperature event (0x46 / 0x75).
 * Signed int16 LE divided by 100.
 */
export function decodeOuraTemp(payload: Uint8Array, ringTimestamp: number): OuraDecodedTemp | null {
  if (payload.length < 2) return null;
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const raw16 = view.getInt16(0, true);
  return {
    ringTimestamp,
    tempDeltaCelsius: raw16 / 100.0,
  };
}
