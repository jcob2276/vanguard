import { Mic, Square } from 'lucide-react';
import { useRef, useState } from 'react';
import { notify } from '../../lib/notify';
import { Pressable } from '../ui/ControlPrimitives';

export default function NoteAudioRecorder({
  disabled,
  onRecorded,
}: {
  disabled: boolean;
  onRecorded: (file: File) => Promise<void>;
}) {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const mime = recorder.mimeType || 'audio/webm';
        const extension = mime.includes('ogg') ? 'ogg' : 'webm';
        const file = new File(chunksRef.current, `nagranie-${Date.now()}.${extension}`, { type: mime });
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        void onRecorded(file);
      };
      recorder.start();
      setRecording(true);
    } catch {
      notify('Nie udało się uzyskać dostępu do mikrofonu.', 'error');
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  return (
    <Pressable
      variant={recording ? 'danger' : 'ghost'}
      size="sm"
      disabled={disabled}
      onClick={() => { if (recording) stop(); else void start(); }}
      title={recording ? 'Zatrzymaj nagrywanie' : 'Nagraj audio'}
    >
      {recording ? <Square size={13} fill="currentColor" /> : <Mic size={14} />}
      {recording ? 'Zatrzymaj' : 'Nagraj'}
    </Pressable>
  );
}
