import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const SMOOTHING_FRAMES = 8; // rolling average window

export function useFaceDistance(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [distance, setDistance] = useState<number | null>(null);
  const [calibrationFactor, setCalibrationFactor] = useState<number | null>(() => {
    const saved = localStorage.getItem('endmyopia_calibration');
    return saved ? parseFloat(saved) : null;
  });
  const [isReady, setIsReady] = useState(false);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const requestRef = useRef<number | null>(null);
  // Rolling buffer for smoothing
  const bufferRef = useRef<number[]>([]);

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
      } catch (error) {
        console.error('Failed to init MediaPipe Face Landmarker:', error);
      }
    }

    init();

    return () => {
      active = false;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
      }
    };
  }, []);

  function measurePixelDist(landmarks: { x: number; y: number }[]) {
    const pt1 = landmarks[33];
    const pt2 = landmarks[263];
    return Math.sqrt(Math.pow(pt2.x - pt1.x, 2) + Math.pow(pt2.y - pt1.y, 2));
  }

  const calibrate = useCallback(
    (knownDistanceCm: number) => {
      if (!landmarkerRef.current || !videoRef.current) return;
      const results = landmarkerRef.current.detectForVideo(videoRef.current, performance.now());
      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const pixelDist = measurePixelDist(results.faceLandmarks[0]);
        const factor = knownDistanceCm * pixelDist;
        setCalibrationFactor(factor);
        localStorage.setItem('endmyopia_calibration', factor.toString());
        // Reset smoothing buffer on calibrate
        bufferRef.current = [];
      }
    },
    [videoRef]
  );

  const resetCalibration = useCallback(() => {
    setCalibrationFactor(null);
    localStorage.removeItem('endmyopia_calibration');
    bufferRef.current = [];
    setDistance(null);
  }, []);

  useEffect(() => {
    if (!isReady || !videoRef.current) return;

    const video = videoRef.current;

    function processFrame() {
      if (video.readyState >= 2 && landmarkerRef.current) {
        try {
          const results = landmarkerRef.current.detectForVideo(video, performance.now());
          if (results.faceLandmarks && results.faceLandmarks.length > 0 && calibrationFactor) {
            const pixelDist = measurePixelDist(results.faceLandmarks[0]);
            const rawDistance = calibrationFactor / pixelDist;

            // Rolling average
            bufferRef.current.push(rawDistance);
            if (bufferRef.current.length > SMOOTHING_FRAMES) {
              bufferRef.current.shift();
            }
            const avg = bufferRef.current.reduce((a, b) => a + b, 0) / bufferRef.current.length;
            setDistance(avg);
          } else if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
            bufferRef.current = [];
            setDistance(null);
          }
        } catch (e) {
          console.debug('MediaPipe detection skipped during unmount');
        }
      }
      requestRef.current = requestAnimationFrame(processFrame);
    }

    const onPlay = () => {
      requestRef.current = requestAnimationFrame(processFrame);
    };

    video.addEventListener('play', onPlay);
    if (!video.paused) onPlay();

    return () => {
      video.removeEventListener('play', onPlay);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isReady, videoRef, calibrationFactor]);

  return { distance, isReady, calibrationFactor, calibrate, resetCalibration };
}
