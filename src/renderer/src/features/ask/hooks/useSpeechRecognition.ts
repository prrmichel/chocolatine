import { useEffect, useRef, useState } from 'react';

type SpeechRecognitionResultAlternativeLike = {
  transcript?: string;
};

type SpeechRecognitionResultLike = {
  isFinal?: boolean;
  length: number;
  [index: number]: SpeechRecognitionResultAlternativeLike | undefined;
};

type SpeechRecognitionResultListLike = {
  length: number;
  [index: number]: SpeechRecognitionResultLike | undefined;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window & typeof globalThis & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

const MICROPHONE_CONSENT_KEY = 'ask.microphoneConsent.v1';

const getSpeechRecognitionCtor = (): SpeechRecognitionCtor | undefined => {
  const speechWindow = window as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
};

const mapSpeechError = (errorCode?: string): string => {
  switch (errorCode) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone permission was denied. Allow microphone access and try again.';
    case 'audio-capture':
      return 'No microphone was detected. Check your headset mic and Windows audio input settings.';
    case 'network':
      return 'Speech recognition network error. The Chromium speech service may be blocked on this machine/network. Retry once, or use Windows voice typing (Win + H) in the question box.';
    case 'no-speech':
      return 'No speech was detected. Try speaking closer to your headset microphone.';
    default:
      return 'Speech recognition failed. Try again or use keyboard input.';
  }
};

interface UseSpeechRecognitionResult {
  isListening: boolean;
  isSpeechSupported: boolean;
  speechError: string | null;
  startListening: (onTranscript: (text: string) => void) => Promise<void>;
  stopListening: () => void;
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [hasMicrophoneConsent, setHasMicrophoneConsent] = useState<boolean>(() => {
    try { return localStorage.getItem(MICROPHONE_CONSENT_KEY) === 'granted'; }
    catch { return false; }
  });
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechRetryRef = useRef(0);

  useEffect(() => {
    const maybeCtor = getSpeechRecognitionCtor();
    setIsSpeechSupported(Boolean(maybeCtor));
    if (!maybeCtor) setSpeechError('Speech recognition is not available in this Electron environment.');
    return () => {
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch { /* noop */ } }
    };
  }, []);

  const stopListening = () => {
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch { /* noop */ } }
    setIsListening(false);
  };

  const startListening = async (onTranscript: (text: string) => void) => {
    const maybeCtor = getSpeechRecognitionCtor();
    if (!maybeCtor) { setSpeechError('Speech recognition is not available in this Electron environment.'); return; }

    setSpeechError(null);

    if (!hasMicrophoneConsent) {
      const confirmed = window.confirm('Allow this app to access your microphone for voice input in Ask?');
      if (!confirmed) { setSpeechError('Microphone access was canceled.'); return; }
      setHasMicrophoneConsent(true);
      try { localStorage.setItem(MICROPHONE_CONSENT_KEY, 'granted'); } catch { /* noop */ }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      setSpeechError('Microphone permission was denied or unavailable. Check app/OS microphone permissions.');
      return;
    }

    if (recognitionRef.current) stopListening();
    speechRetryRef.current = 0;

    const recognition = new maybeCtor();
    recognition.lang = navigator.language || 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result?.isFinal) transcript += result[0]?.transcript ?? '';
      }
      if (transcript.trim()) onTranscript(transcript.trim());
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      if (event?.error === 'network' && speechRetryRef.current < 1) {
        speechRetryRef.current += 1;
        try { recognition.stop(); } catch { /* noop */ }

        const retry = new maybeCtor();
        retry.lang = 'en-US';
        retry.continuous = true;
        retry.interimResults = true;
        retry.onresult = recognition.onresult;
        retry.onerror = (retryEvent: SpeechRecognitionErrorEventLike) => {
          setSpeechError(mapSpeechError(retryEvent?.error));
          setIsListening(false);
          recognitionRef.current = null;
        };
        retry.onend = () => { setIsListening(false); recognitionRef.current = null; };

        try { retry.start(); recognitionRef.current = retry; setIsListening(true); return; }
        catch { /* fall through */ }
      }
      setSpeechError(mapSpeechError(event?.error));
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => { setIsListening(false); recognitionRef.current = null; };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch {
      setSpeechError('Unable to start microphone recognition.');
      setIsListening(false);
    }
  };

  return { isListening, isSpeechSupported, speechError, startListening, stopListening };
}
