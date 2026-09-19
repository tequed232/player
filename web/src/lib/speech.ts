/**
 * Live speech-to-text for the Home screen.
 *
 * Uses the browser SpeechRecognition engine when available (continuous, interim
 * results). The recognition confidence is filtered with the "语音输入强度" setting
 * so that slider has a real effect on the transcript.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

function recognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
}

export interface SpeechOptions {
  lang?: string;
  /** 0..100; higher means only confident results are accepted */
  intensity: number;
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
}

export interface SpeechController {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

export function useSpeechRecognition({ lang = 'zh-CN', intensity, onFinal, onError }: SpeechOptions): SpeechController {
  const supported = useRef<boolean>(recognitionCtor() !== null).current;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListening = useRef(false);
  const finalHandler = useRef(onFinal);
  const errorHandler = useRef(onError);
  const intensityRef = useRef(intensity);

  finalHandler.current = onFinal;
  errorHandler.current = onError;
  intensityRef.current = intensity;

  const ensure = useCallback(() => {
    if (!supported) return null;
    if (recognitionRef.current) return recognitionRef.current;
    const Ctor = recognitionCtor();
    if (!Ctor) return null;
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setListening(true);
      setError(null);
    };
    recognition.onresult = (event) => {
      let pending = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const alternative = result[0];
        if (!alternative) continue;
        const text = alternative.transcript.trim();
        if (!text) continue;
        if (result.isFinal) {
          // intensity slider -> accepted confidence threshold (0.05 ... 0.85)
          const threshold = 0.05 + (intensityRef.current / 100) * 0.8;
          if (alternative.confidence >= threshold || alternative.confidence === 0) {
            finalHandler.current(text);
          }
        } else {
          pending += text;
        }
      }
      setInterim(pending);
    };
    recognition.onerror = (event) => {
      const map: Record<string, string> = {
        'not-allowed': '麦克风权限被拒绝，请在浏览器地址栏允许麦克风后重试。',
        'service-not-allowed': '当前浏览器不允许语音识别服务。',
        'no-speech': '没有检测到语音，请靠近麦克风重试。',
        network: '语音识别服务网络异常。',
        aborted: '',
      };
      const message = map[event.error] ?? `语音识别失败：${event.error}`;
      if (message) {
        setError(message);
        errorHandler.current?.(message);
      }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        wantListening.current = false;
      }
    };
    recognition.onend = () => {
      setInterim('');
      if (wantListening.current) {
        // Chrome ends the session periodically; restart to keep it live.
        window.setTimeout(() => {
          if (!wantListening.current) return;
          try {
            recognition.start();
          } catch {
            setListening(false);
          }
        }, 250);
      } else {
        setListening(false);
      }
    };
    recognitionRef.current = recognition;
    return recognition;
  }, [lang, supported]);

  const start = useCallback(() => {
    const recognition = ensure();
    if (!recognition) {
      const message = '当前浏览器不支持实时语音识别，可手动输入文字。';
      setError(message);
      errorHandler.current?.(message);
      return;
    }
    wantListening.current = true;
    try {
      recognition.start();
      setListening(true);
    } catch {
      /* already started */
    }
  }, [ensure]);

  const stop = useCallback(() => {
    wantListening.current = false;
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
    }
    setListening(false);
    setInterim('');
  }, []);

  const toggle = useCallback(() => {
    if (wantListening.current) stop();
    else start();
  }, [start, stop]);

  useEffect(
    () => () => {
      wantListening.current = false;
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  return { supported, listening, interim, error, start, stop, toggle };
}
