import { useRef } from 'react';
import { Camera, RotateCcw, Check, Upload, X } from 'lucide-react';
import { useCameraScanner, type ScanResult } from '@/hooks/useCameraScanner';
import { Button } from '@/components/ui/button';

interface CameraScannerProps {
  assignmentId?: string;
  studentId?: string;
  submissionId?: string;
  onComplete: (result: ScanResult) => void;
  onClose: () => void;
}

export function CameraScanner({ assignmentId, studentId, submissionId, onComplete, onClose }: CameraScannerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
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
  } = useCameraScanner({
    assignmentId,
    studentId,
    submissionId,
    onScanComplete: onComplete,
  });

  const handleClose = () => {
    closeCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative w-full max-w-lg mx-4 bg-[#020617] rounded-2xl overflow-hidden border border-white/10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-white font-semibold text-base">Escanear examen</h3>
          <button type="button" onClick={handleClose} className="text-white/50 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          {state === 'idle' && (
            <div className="flex flex-col gap-3">
              <p className="text-white/60 text-sm mb-2">
                Toma una foto del examen físico o sube una imagen desde tu dispositivo.
              </p>
              <Button
                onClick={openCamera}
                className="w-full rounded-xl text-white py-6 text-base gap-2"
                style={{ background: 'linear-gradient(180deg, #3B82F6, #1D4ED8)' }}
              >
                <Camera size={20} />
                Abrir cámara
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-white/20 text-white/80 hover:bg-white/5 gap-2 rounded-xl"
              >
                <Upload size={18} />
                Subir imagen desde archivo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) uploadFromFile(file);
                }}
              />
            </div>
          )}

          {state === 'camera' && (
            <div className="flex flex-col gap-4">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                <div className="absolute inset-4 border-2 border-white/40 rounded-lg pointer-events-none" />
              </div>
              <p className="text-white/50 text-xs text-center">
                Encuadra el examen dentro del rectángulo y toca &quot;Capturar&quot;
              </p>
              <Button
                onClick={capture}
                className="w-full rounded-xl text-white py-5 text-base gap-2"
                style={{ background: 'linear-gradient(180deg, #3B82F6, #1D4ED8)' }}
              >
                <Camera size={20} />
                Capturar
              </Button>
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {state === 'preview' && capturedBlob && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl overflow-hidden bg-black aspect-video">
                <img src={capturedBlob} alt="Preview del escaneo" className="w-full h-full object-contain" />
              </div>
              <p className="text-white/60 text-sm text-center">¿La imagen se ve bien?</p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={retake}
                  className="flex-1 border-white/20 text-white/80 hover:bg-white/5 gap-2 rounded-xl"
                >
                  <RotateCcw size={16} />
                  Retomar
                </Button>
                <Button
                  onClick={uploadScan}
                  className="flex-1 rounded-xl text-white gap-2"
                  style={{ background: 'linear-gradient(180deg, #3B82F6, #1D4ED8)' }}
                >
                  <Check size={16} />
                  Confirmar y subir
                </Button>
              </div>
            </div>
          )}

          {state === 'processing' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-10 h-10 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
              <p className="text-white/60 text-sm">Procesando y subiendo escaneo...</p>
            </div>
          )}

          {state === 'done' && scanResult && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="text-emerald-400" size={24} />
              </div>
              <p className="text-white font-medium">¡Escaneo guardado!</p>
              <img src={scanResult.localBlob} alt="Examen escaneado" className="w-full rounded-xl object-contain max-h-48" />
              <Button
                onClick={handleClose}
                className="w-full rounded-xl text-white"
                style={{ background: 'linear-gradient(180deg, #3B82F6, #1D4ED8)' }}
              >
                Cerrar
              </Button>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <p className="text-red-400 text-sm text-center">{error}</p>
              <Button variant="outline" onClick={openCamera} className="border-white/20 text-white/80 rounded-xl">
                Intentar de nuevo
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

