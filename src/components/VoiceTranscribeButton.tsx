import React, { useRef, useState } from 'react';
import { Loader2, Mic, Square } from 'lucide-react';

interface VoiceTranscribeButtonProps {
  onTranscribed: (text: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  label?: string;
}

export const VoiceTranscribeButton: React.FC<VoiceTranscribeButtonProps> = ({
  onTranscribed,
  onError,
  disabled = false,
  label = 'إدخال صوتي',
}) => {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const commaIdx = result.indexOf(',');
        resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
      };
      reader.onerror = () => reject(new Error('تعذر قراءة الملف الصوتي'));
      reader.readAsDataURL(blob);
    });

  const handleToggleRecording = async () => {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      onError?.('المتصفح الحالي لا يدعم تسجيل الصوت من الميكروفون.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        stopStream();
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (blob.size < 100) {
          onError?.('التسجيل قصير جداً، يرجى المحاولة مرة أخرى.');
          return;
        }
        setTranscribing(true);
        try {
          const audioBase64 = await blobToBase64(blob);
          const res = await fetch('/api/agent/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64, mimeType }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'تعذر تفريغ التسجيل الصوتي');
          }
          if (data.text) {
            onTranscribed(data.text);
          } else {
            onError?.('لم يتم التعرف على كلام واضح في التسجيل.');
          }
        } catch (err) {
          onError?.(
            err instanceof Error ? err.message : 'حدث خطأ أثناء تفريغ الصوت'
          );
        } finally {
          setTranscribing(false);
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      stopStream();
      onError?.(
        'تعذر الوصول إلى الميكروفون. يرجى السماح بصلاحية الميكروفون من إعدادات المتصفح.'
      );
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggleRecording}
      disabled={disabled || transcribing}
      title={recording ? 'إيقاف التسجيل والتفريغ' : 'تسجيل رسالة صوتية وتفريغها'}
      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60 ${
        recording
          ? 'bg-red-50 border-red-600 text-red-800'
          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
      }`}
    >
      {transcribing ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700" />
          <span>جاري التفريغ...</span>
        </>
      ) : recording ? (
        <>
          <Square className="w-3.5 h-3.5 text-red-700" />
          <span>إيقاف التسجيل</span>
        </>
      ) : (
        <>
          <Mic className="w-3.5 h-3.5 text-teal-700" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
};
