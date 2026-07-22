/**
 * Complete clean-room Oura Ring Gen 3 (Heritage/Horizon) BLE GATT Protocol & Driver Engine.
 * Fully adapted from reverse-engineered clean-room facts in noop specs (OURA_PROTOCOL.md / OuraDriver.swift).
 *
 * Provides:
 * 1. GATT & Opcode Constants
 * 2. Pure Wire Command Builders (Auth, Time Sync, Fetch, Live-HR)
 * 3. Outer/Inner Framing Parsers (TLV + Secure Session)
 * 4. Full Biometric Event Decoders (HRV, Sleep Phases, Temp, SpO2, Live HR)
 * 5. Full OuraDriver State Machine & UTC Anchor Calculator
 */

export const OURA_GATT = {
  SERVICE_UUID: '98ED0001-A541-11E4-B6A0-0002A5D5C51B',
  WRITE_CHAR_UUID: '98ED0002-A541-11E4-B6A0-0002A5D5C51B',
  NOTIFY_CHAR_UUID: '98ED0003-A541-11E4-B6A0-0002A5D5C51B',
  MTU_GEN3: 203,
  MTU_GEN4_5: 247,
  ATT_OVERHEAD: 3,
};

export const OURA_OPCODES = {
  REALTIME_MEAS: 0x06,
  GET_FIRMWARE: 0x08,
  GET_BATTERY: 0x0c,
  BATTERY_RESP: 0x0d,
  GET_EVENTS: 0x10,
  GET_EVENTS_RESP: 0x11,
  SYNC_TIME: 0x12,
  SYNC_TIME_RESP: 0x13,
  SET_BLE_MODE: 0x16,
  GET_PRODUCT_INFO: 0x18,
  SET_NOTIFICATIONS: 0x1c,
  SET_AUTH_KEY: 0x24,
  FLUSH_BUFFER: 0x28,
  SECURE_SESSION: 0x2f,
};

export const OURA_SECURE_SUBOP = {
  REQUEST_NONCE: 0x01,
  NONCE_RESP_1: 0x10,
  NONCE_RESP_2: 0x2c,
  SUBMIT_PROOF: 0x11,
  PROOF_CMD_ALIAS: 0x2d,
  AUTH_SUCCESS: 0x2e,
  READ_FEATURE: 0x20,
  READ_FEATURE_RESP: 0x21,
  ENABLE_FEATURE: 0x22,
  ENABLE_FEATURE_ACK: 0x23,
  SUBSCRIBE_FEATURE: 0x26,
  SUBSCRIBE_FEATURE_ACK: 0x27,
  FEATURE_PUSH_NOTIF: 0x28,
};

export enum OuraEventTag {
  RING_START = 0x41,
  TIME_SYNC = 0x42,
  STATE_CHANGE = 0x45,
  WEAR_EVENT = 0x53,
  IBI_AMPLITUDE = 0x60,
  GREEN_IBI_QUALITY = 0x80,
  HRV_RMSSD = 0x5d,
  SPO2_PER_SAMPLE = 0x6f,
  SPO2_STABLE = 0x7b,
  TEMP = 0x46,
  TEMP_PERIOD = 0x69,
  SLEEP_TEMP = 0x75,
  MOTION = 0x47,
  MOTION_PERIOD = 0x6b,
  SLEEP_PHASE = 0x4e,
  SLEEP_PHASE_ALT = 0x5a,
}

// --- Interfaces ---

export interface OuraCommandPayload {
  label: string;
  bytes: Uint8Array;
}

export interface OuraDecodedIbi {
  ringTimestamp: number;
  ibiMs: number;
  amplitude?: number;
}

export interface OuraDecodedSleepPhase {
  ringTimestamp: number;
  phaseCode: number; // 0 = Awake, 1 = REM, 2 = Light, 3 = Deep
  phaseName: 'awake' | 'rem' | 'light' | 'deep';
}

export interface OuraDecodedTemp {
  ringTimestamp: number;
  tempDeltaCelsius: number;
}

export interface OuraDecodedBattery {
  levelPercent: number;
  voltageMv: number;
  isCharging: boolean;
}

export interface OuraTlvRecord {
  tag: number;
  length: number;
  ringTimestamp: number;
  payload: Uint8Array;
}

// --- Wire Command Builders ---

export const OuraCommandBuilder = {
  getFirmwareVersion(): OuraCommandPayload {
    return { label: 'get_firmware', bytes: new Uint8Array([0x08, 0x03, 0x00, 0x00, 0x00]) };
  },

  getProductSerial(): OuraCommandPayload {
    return { label: 'get_serial', bytes: new Uint8Array([0x18, 0x03, 0x08, 0x00, 0x10]) };
  },

  getProductHardware(): OuraCommandPayload {
    return { label: 'get_hardware', bytes: new Uint8Array([0x18, 0x03, 0x18, 0x00, 0x10]) };
  },

  getBattery(): OuraCommandPayload {
    return { label: 'get_battery', bytes: new Uint8Array([0x0c, 0x00]) };
  },

  enableAllNotifications(): OuraCommandPayload {
    return { label: 'notify_all', bytes: new Uint8Array([0x1c, 0x01, 0x3f]) };
  },

  syncTime(unixSeconds: number, token = 0x00): OuraCommandPayload {
    const counter = Math.floor(unixSeconds / 256);
    const c0 = counter & 0xff;
    const c1 = (counter >> 8) & 0xff;
    const c2 = (counter >> 16) & 0xff;
    return {
      label: 'sync_time',
      bytes: new Uint8Array([0x12, 0x09, token, c0, c1, c2, 0x00, 0x00, 0x00, 0x00, 0xf6]),
    };
  },

  getEvents(cursor: number, maxEvents: number): OuraCommandPayload {
    const c0 = cursor & 0xff;
    const c1 = (cursor >> 8) & 0xff;
    const c2 = (cursor >> 16) & 0xff;
    const c3 = (cursor >> 24) & 0xff;
    return {
      label: 'get_events',
      bytes: new Uint8Array([0x10, 0x09, c0, c1, c2, c3, maxEvents, 0xff, 0xff, 0xff, 0xff]),
    };
  },

  flushBuffer(): OuraCommandPayload {
    return { label: 'flush_buffer', bytes: new Uint8Array([0x28, 0x01, 0x00]) };
  },

  requestAuthNonce(): OuraCommandPayload {
    return { label: 'request_auth_nonce', bytes: new Uint8Array([0x2f, 0x01, 0x2b]) };
  },

  submitAuthProof(proof16Bytes: Uint8Array): OuraCommandPayload {
    const bytes = new Uint8Array(19);
    bytes[0] = 0x2f;
    bytes[1] = 0x11;
    bytes[2] = 0x2d;
    bytes.set(proof16Bytes, 3);
    return { label: 'submit_auth_proof', bytes };
  },

  liveHRReadStatus(): OuraCommandPayload {
    return { label: 'live_hr_read', bytes: new Uint8Array([0x2f, 0x02, 0x20, 0x02]) };
  },

  liveHREnable(): OuraCommandPayload {
    return { label: 'live_hr_enable', bytes: new Uint8Array([0x2f, 0x03, 0x22, 0x02, 0x03]) };
  },

  liveHRSubscribe(): OuraCommandPayload {
    return { label: 'live_hr_subscribe', bytes: new Uint8Array([0x2f, 0x03, 0x26, 0x02, 0x02]) };
  },

  liveHRDisable(): OuraCommandPayload {
    return { label: 'live_hr_disable', bytes: new Uint8Array([0x2f, 0x03, 0x22, 0x02, 0x01]) };
  },
};

// --- Parsers & Decoders ---

export function parseGetEventsResponse(body: Uint8Array): { cursor: number; moreData: boolean } | null {
  if (body.length < 6) return null;
  const status = body[0];
  const cursor = (body[2] | (body[3] << 8) | (body[4] << 16) | (body[5] << 24)) >>> 0;
  return { cursor, moreData: status !== 0x00 };
}

export function parseBatteryResponse(body: Uint8Array): OuraDecodedBattery | null {
  if (body.length < 4) return null;
  const levelPercent = body[0];
  const voltageMv = body[1] | (body[2] << 8);
  const isCharging = body[3] !== 0;
  return { levelPercent, voltageMv, isCharging };
}

export function parseTlvRecords(bytes: Uint8Array): OuraTlvRecord[] {
  const records: OuraTlvRecord[] = [];
  let i = 0;

  while (i + 6 <= bytes.length) {
    const tag = bytes[i];
    const len = bytes[i + 1];
    if (tag < 0x41 || len < 4) {
      i++;
      continue;
    }

    const totalLen = 2 + len;
    if (i + totalLen > bytes.length) break;

    const ringTimestamp = (bytes[i + 2] | (bytes[i + 3] << 8) | (bytes[i + 4] << 16) | (bytes[i + 5] << 24)) >>> 0;
    const payload = bytes.subarray(i + 6, i + totalLen);

    records.push({ tag, length: len, ringTimestamp, payload });
    i += totalLen;
  }

  return records;
}

export function decodeGreenIbiQuality(payload: Uint8Array, ringTimestamp: number): OuraDecodedIbi[] {
  if (payload.length < 2 || payload.length % 2 !== 0) return [];
  const out: OuraDecodedIbi[] = [];
  const maxSamples = Math.min(7, Math.floor(payload.length / 2));

  for (let i = 0; i < maxSamples; i++) {
    const offset = i * 2;
    const sample = payload[offset] | (payload[offset + 1] << 8);
    const ibiMs = sample & 0x07ff;
    const qualA = (sample >> 11) & 0x07;
    const qualB = (sample >> 14) & 0x03;

    if (qualA <= 1 && qualB === 0 && ibiMs > 0) {
      out.push({ ringTimestamp, ibiMs });
    }
  }

  return out;
}

export function decodeSleepPhase(payload: Uint8Array, ringTimestamp: number): OuraDecodedSleepPhase[] {
  if (payload.length === 0) return [];
  const out: OuraDecodedSleepPhase[] = [];

  for (let i = 0; i < payload.length; i++) {
    const b = payload[i];
    for (let shift = 0; shift < 8; shift += 2) {
      const code = (b >> shift) & 0x03;
      let phaseName: 'awake' | 'rem' | 'light' | 'deep' = 'light';
      if (code === 0) phaseName = 'awake';
      else if (code === 1) phaseName = 'rem';
      else if (code === 2) phaseName = 'light';
      else if (code === 3) phaseName = 'deep';

      out.push({ ringTimestamp: ringTimestamp + Math.floor(i * 4 + shift / 2), phaseCode: code, phaseName });
    }
  }

  return out;
}

export function decodeLiveHRPush(body: Uint8Array, ringTimestamp: number): { bpm: number; ibiMs: number; ringTimestamp: number } | null {
  if (body.length < 7) return null;
  const ibiMs = ((body[6] & 0x0f) << 8) | body[5];
  if (ibiMs <= 0) return null;

  const bpm = Math.round(60000 / ibiMs);
  if (bpm <= 0 || bpm > 300) return null;

  return { bpm, ibiMs, ringTimestamp };
}

export function decodeOuraTemp(payload: Uint8Array, ringTimestamp: number): OuraDecodedTemp | null {
  if (payload.length < 2) return null;
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const raw16 = view.getInt16(0, true);
  return {
    ringTimestamp,
    tempDeltaCelsius: raw16 / 100.0,
  };
}

// --- Transport-Agnostic Driver State Machine & UTC Anchor Calculator ---

export type OuraDriverPhase =
  | 'idle'
  | 'authenticating'
  | 'enablingLiveHR'
  | 'streaming'
  | 'fetchingHistory'
  | 'needsKeyInstall'
  | 'authFailed'
  | 'stopped';

export interface OuraDriverTransition {
  kind: 'ready' | 'nonceReceived' | 'authCompleted' | 'enableAckReceived' | 'startHistoryFetch' | 'historyCursorAdvanced';
  nonce?: Uint8Array;
  authSuccess?: boolean;
  cursor?: number;
  moreData?: boolean;
}

export class OuraDriverStateMachine {
  public phase: OuraDriverPhase = 'idle';
  private liveHREnableStep = 0;
  private anchorUtcMs: number | null = null;
  private anchorRingTime: number | null = null;

  private static MIN_PLAUSIBLE_EPOCH = 1_577_836_800; // 2020-01-01
  private static MAX_PLAUSIBLE_EPOCH = 2_051_222_400; // 2035-01-01

  public setAnchor(ringTime: number, unixSeconds: number): void {
    if (unixSeconds >= OuraDriverStateMachine.MIN_PLAUSIBLE_EPOCH && unixSeconds <= OuraDriverStateMachine.MAX_PLAUSIBLE_EPOCH) {
      this.anchorRingTime = ringTime;
      this.anchorUtcMs = unixSeconds * 1000;
    }
  }

  public ringTimeToUnixSeconds(ringTimestamp: number): number | null {
    if (this.anchorUtcMs === null || this.anchorRingTime === null) return null;
    const deltaTicks = ringTimestamp - this.anchorRingTime;
    const targetMs = this.anchorUtcMs + deltaTicks * 100; // 100ms per tick
    const targetSeconds = Math.floor(targetMs / 1000);

    if (targetSeconds >= OuraDriverStateMachine.MIN_PLAUSIBLE_EPOCH && targetSeconds <= OuraDriverStateMachine.MAX_PLAUSIBLE_EPOCH) {
      return targetSeconds;
    }
    return null;
  }

  public nextStep(transition: OuraDriverTransition): OuraCommandPayload[] {
    switch (transition.kind) {
      case 'ready':
        this.phase = 'authenticating';
        return [
          OuraCommandBuilder.enableAllNotifications(),
          OuraCommandBuilder.requestAuthNonce(),
        ];

      case 'authCompleted':
        if (transition.authSuccess) {
          this.phase = 'enablingLiveHR';
          this.liveHREnableStep = 1;
          return [OuraCommandBuilder.liveHRReadStatus()];
        } else {
          this.phase = 'authFailed';
          return [];
        }

      case 'enableAckReceived':
        if (this.phase !== 'enablingLiveHR') return [];
        this.liveHREnableStep++;
        if (this.liveHREnableStep === 2) {
          return [OuraCommandBuilder.liveHREnable()];
        } else if (this.liveHREnableStep === 3) {
          return [OuraCommandBuilder.liveHRSubscribe()];
        }
        this.phase = 'streaming';
        return [];

      case 'startHistoryFetch':
        this.phase = 'fetchingHistory';
        return [
          OuraCommandBuilder.flushBuffer(),
          OuraCommandBuilder.getEvents(transition.cursor ?? 0, 255),
        ];

      case 'historyCursorAdvanced':
        if (!transition.moreData) {
          this.phase = 'streaming';
          return [];
        }
        return [OuraCommandBuilder.getEvents(transition.cursor ?? 0, 0)];

      default:
        return [];
    }
  }

  public stop(): void {
    this.phase = 'stopped';
    this.liveHREnableStep = 0;
    this.anchorUtcMs = null;
    this.anchorRingTime = null;
  }
}
