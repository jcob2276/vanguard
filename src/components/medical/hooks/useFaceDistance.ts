import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { STORAGE_KEYS } from '../../../lib/constants';

const SMOOTHING_FRAMES = 10;
const AUTO_CAPTURE_THRESHOLD_CM = 1.0;  // max jitter to consider "stable"
const AUTO_CAPTURE_DURATION_MS = 1500;  // hold still for 1.5s to auto-capture

export function useFaceDistance(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [distance, setDistance] = useState<number | null>(null);
  const [stability, setStability] = useState(0); // 0–1, how close to auto-capture
  const [calibrationFactor, setCalibrationFactor] = useState<number | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ENDMYOPIA_CALIBRATION);
    return saved ? parseFloat(saved) : null;
  });
  const [isReady, setIsReady] = useState(false);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const requestRef = useRef<number | null>(null);
  const bufferRef = useRef<number[]>([]);
  // For auto-capture: track when the reading became stable
  const stableStartRef = useRef<number | null>(null);
  const lastStableValueRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        if (active) {
          landmarkerRef.current = landmarker;
          setIsReady(true);
        }
      } catch (error: unknown) {
      console.warn('[useFaceDistance] Failed to initialize FaceLandmarker model:', error);
    }
    }
    init();
    return () => {
      active = false;
      if (landmarkerRef.current) landmarkerRef.current.close();
    };
  }, []);

  function measurePixelDist(landmarks: { x: number; y: number }[]) {
    const pt1 = landmarks[33];
    const pt2 = landmarks[263];
    return Math.sqrt((pt2.x - pt1.x) ** 2 + (pt2.y - pt1.y) ** 2);
  }

  const calibrate = useCallback(
    (knownDistanceCm: number) => {
      if (!landmarkerRef.current || !videoRef.current) return;
      const results = landmarkerRef.current.detectForVideo(videoRef.current, performance.now());
      if (results.faceLandmarks?.length > 0) {
        const pixelDist = measurePixelDist(results.faceLandmarks[0]);
        const factor = knownDistanceCm * pixelDist;
        setCalibrationFactor(factor);
        localStorage.setItem(STORAGE_KEYS.ENDMYOPIA_CALIBRATION, factor.toString());
        bufferRef.current = [];
        stableStartRef.current = null;
        lastStableValueRef.current = null;
      }
    },
    [videoRef]
  );

  const resetCalibration = useCallback(() => {
    setCalibrationFactor(null);
    localStorage.removeItem(STORAGE_KEYS.ENDMYOPIA_CALIBRATION);
    bufferRef.current = [];
    stableStartRef.current = null;
    lastStableValueRef.current = null;
    setDistance(null);
    setStability(0);
  }, []);

  const resetStability = useCallback(() => {
    stableStartRef.current = null;
    lastStableValueRef.current = null;
    setStability(0);
  }, []);

  useEffect(() => {
    if (!isReady || !videoRef.current) return;
    const video = videoRef.current;

    function processFrame() {
      if (video.readyState >= 2 && landmarkerRef.current) {
        try {
          const results = landmarkerRef.current.detectForVideo(video, performance.now());
          if (results.faceLandmarks?.length > 0 && calibrationFactor) {
            const pixelDist = measurePixelDist(results.faceLandmarks[0]);
            const raw = calibrationFactor / pixelDist;

            // Smoothing
            bufferRef.current.push(raw);
            if (bufferRef.current.length > SMOOTHING_FRAMES) bufferRef.current.shift();
            const avg = bufferRef.current.reduce((a, b) => a + b, 0) / bufferRef.current.length;
            setDistance(avg);

            // Stability tracking
            const now = performance.now();
            if (lastStableValueRef.current !== null && Math.abs(avg - lastStableValueRef.current) < AUTO_CAPTURE_THRESHOLD_CM) {
              // Still within threshold — accumulate stable time
              if (stableStartRef.current === null) stableStartRef.current = now;
              const elapsed = now - stableStartRef.current;
              setStability(Math.min(1, elapsed / AUTO_CAPTURE_DURATION_MS));
            } else {
              // Moved — reset stability
              lastStableValueRef.current = avg;
              stableStartRef.current = now;
              setStability(0);
            }
          } else if (!results.faceLandmarks?.length) {
            bufferRef.current = [];
            stableStartRef.current = null;
            lastStableValueRef.current = null;
            setDistance(null);
            setStability(0);
          }
        } catch {
          console.debug('MediaPipe detection skipped during unmount');
        }
      }
      requestRef.current = requestAnimationFrame(processFrame);
    }

    const onPlay = () => { requestRef.current = requestAnimationFrame(processFrame); };
    video.addEventListener('play', onPlay);
    if (!video.paused) onPlay();

    return () => {
      video.removeEventListener('play', onPlay);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isReady, videoRef, calibrationFactor]);

  return { distance, stability, isReady, calibrationFactor, calibrate, resetCalibration, resetStability };
}
