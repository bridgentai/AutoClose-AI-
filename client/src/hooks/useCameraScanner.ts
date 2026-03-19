import { useRef, useState, useCallback, useEffect } from 'react';

export type ScannerState = 'idle' | 'camera' | 'preview' | 'processing' | 'done' | 'error';

export interface ScanResult {
  url: string;
  localBlob: string;
}

interface UseCameraScannerOpts {
  assignmentId?: string;
  studentId?: string;
  submissionId?: string;
  onScanComplete?: (result: ScanResult) => void;
}

export function useCameraScanner(opts: UseCameraScannerOpts = {}) {
  const { assignmentId, studentId, submissionId, onScanComplete } = opts;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [state, setState] = useState<ScannerState>('idle');
  const [capturedBlob, setCapturedBlob] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const openCamera = useCallback(async () => {
    setError(null);
    setState('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setError('No se pudo acceder a la cámara. Verifica los permisos.');
      setState('error');
    }
  }, []);

  const closeCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setState('idle');
    setCapturedBlob(null);
  }, []);

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video.videoWidth || !video.videoHeight) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const enhanced = enhanceContrast(imageData);
    ctx.putImageData(enhanced, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedBlob(dataUrl);
    setState('preview');

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const retake = useCallback(() => {
    setCapturedBlob(null);
    openCamera();
  }, [openCamera]);

  const uploadScan = useCallback(async () => {
    if (!capturedBlob) return;
    setState('processing');
    try {
      const r = await fetch(capturedBlob);
      const blob = await r.blob();
      const file = new File([blob], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('scan', file);
      if (submissionId) formData.append('submissionId', submissionId);
      if (!submissionId) {
        if (assignmentId) formData.append('assignmentId', assignmentId);
        if (studentId) formData.append('studentId', studentId);
      }

      const token = localStorage.getItem('autoclose_token');
      const uploadRes = await fetch('/api/uploads/scan', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      const data = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        throw new Error((data as { error?: string })?.error ?? 'Error al subir el escaneo');
      }

      const result: ScanResult = { url: (data as { url: string }).url, localBlob: capturedBlob };
      setScanResult(result);
      setState('done');
      onScanComplete?.(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al subir el escaneo';
      setError(msg);
      setState('error');
    }
  }, [capturedBlob, submissionId, assignmentId, studentId, onScanComplete]);

  const uploadFromFile = useCallback(
    async (file: File) => {
      setState('processing');
      try {
        const formData = new FormData();
        formData.append('scan', file);
        if (submissionId) formData.append('submissionId', submissionId);
        if (!submissionId) {
          if (assignmentId) formData.append('assignmentId', assignmentId);
          if (studentId) formData.append('studentId', studentId);
        }

        const token = localStorage.getItem('autoclose_token');
        const uploadRes = await fetch('/api/uploads/scan', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: formData,
        });

        const data = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok) {
          throw new Error((data as { error?: string })?.error ?? 'Error al subir el archivo');
        }

        const localUrl = URL.createObjectURL(file);
        const result: ScanResult = { url: (data as { url: string }).url, localBlob: localUrl };
        setScanResult(result);
        setState('done');
        onScanComplete?.(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error al subir el archivo';
        setError(msg);
        setState('error');
      }
    },
    [submissionId, assignmentId, studentId, onScanComplete]
  );

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return {
    state,
    error,
    capturedBlob,
    scanResult,
    videoRef,
    canvasRef,
    openCamera,
    closeCamera,
    capture,
    retake,
    uploadScan,
    uploadFromFile,
  };
}

function enhanceContrast(imageData: ImageData): ImageData {
  const data = imageData.data;
  const factor = 1.4;
  const intercept = 128 * (1 - factor);

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, data[i] * factor + intercept));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor + intercept));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor + intercept));
  }
  return imageData;
}

