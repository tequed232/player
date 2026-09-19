/**
 * Voice helpers shared by the home screen (进度条 + 系统通知) and the API screen
 * (保存后的「录音试用」弹窗).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { MdIcon, MdIconButton, useMdDialog } from './md';
import { transcribeAudio } from '../lib/api';
import { useAppState } from '../state/AppState';

/* --------------------------------------------------------- system notice --- */

export interface SystemNotice {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  request: () => Promise<boolean>;
  show: (title: string, body: string) => void;
  close: () => void;
}

/** 浏览器系统通知：录音时显示进行中的状态，结束后收起（对应 Android 的流体云卡片）。 */
export function useSystemNotice(): SystemNotice {
  const supported = typeof Notification !== 'undefined';
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    supported ? Notification.permission : 'unsupported',
  );
  const notice = useRef<Notification | null>(null);

  const request = useCallback(async () => {
    if (!supported) return false;
    if (Notification.permission === 'granted') {
      setPermission('granted');
      return true;
    }
    if (Notification.permission === 'denied') return false;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch {
      return false;
    }
  }, [supported]);

  const show = useCallback(
    (title: string, body: string) => {
      if (!supported || Notification.permission !== 'granted') return;
      try {
        if (notice.current) {
          notice.current.title = title;
          notice.current.body = body;
          return;
        }
        notice.current = new Notification(title, {
          body,
          tag: 'm3-expressive-recording',
          silent: true,
          icon: undefined,
        });
      } catch {
        /* 某些浏览器不允许构造通知，忽略 */
      }
    },
    [supported],
  );

  const close = useCallback(() => {
    try {
      notice.current?.close();
    } catch {
      /* ignore */
    }
    notice.current = null;
  }, []);

  useEffect(() => () => close(), [close]);

  return { supported, permission, request, show, close };
}

/* ------------------------------------------------------------ progress ----- */

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/** 录音 / 处理中的进度条（自带计时，避免让整屏每秒重渲染）。 */
export function RecordingProgress({
  active,
  label,
  onStop,
  progress,
}: {
  active: boolean;
  label: string;
  onStop?: () => void;
  /** 0..1；不传则显示不确定进度 */
  progress?: number;
}) {
  const seconds = useElapsedSeconds(active, 1000);
  if (!active) return null;
  return (
    <div className="recording-progress" role="status" aria-live="polite">
      <span className="live-dot" />
      <div className="col flex-1" style={{ gap: 4 }}>
        <div className="row gap-8">
          <span className="md-label-medium-emphasized flex-1">{label}</span>
          <span className="md-label-medium mono">{formatSeconds(seconds)}</span>
        </div>
        <div className="progress-track">
          <div
            className={`progress-fill${progress === undefined ? ' indeterminate' : ''}`}
            style={progress === undefined ? undefined : { width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>
      {onStop ? <MdIconButton icon="stop_circle" label="停止" onClick={onStop} /> : null}
    </div>
  );
}

/** 计时器：active 为 true 时按 intervalMs 自增。 */
export function useElapsedSeconds(active: boolean, intervalMs = 1000): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return undefined;
    }
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), intervalMs);
    return () => window.clearInterval(timer);
  }, [active, intervalMs]);
  return seconds;
}

/* ------------------------------------------------------- recording trial --- */

type TrialState = 'idle' | 'recording' | 'uploading' | 'done' | 'error';

const MAX_TRIAL_SECONDS = 15;

/** 「录音试用」弹窗：录一段话直接调用配置好的语音转文字 API 验证连通性。 */
export function RecordingTrialDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, showSnackbar } = useAppState();
  const [state, setState] = useState<TrialState>('idle');
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [level, setLevel] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const analyser = useRef<AnalyserNode | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const seconds = useElapsedSeconds(state === 'recording');
  const dialogRef = useMdDialog(open);

  const cleanup = useCallback(() => {
    recorder.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    analyser.current = null;
    void audioContext.current?.close().catch(() => undefined);
    audioContext.current = null;
    setLevel(0);
  }, []);

  useEffect(() => {
    if (!open) {
      cleanup();
      setState('idle');
      setText('');
      setMessage('');
    }
  }, [open, cleanup]);

  useEffect(() => {
    if (state === 'recording' && seconds >= MAX_TRIAL_SECONDS) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, state]);

  const stop = useCallback(() => {
    try {
      recorder.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const start = async () => {
    setText('');
    setMessage('');
    if (!settings.sttApiUrl.trim()) {
      setState('error');
      setMessage('尚未填写语音转文字API地址，请先在下方输入框保存。');
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      chunks.current = [];
      const instance = new MediaRecorder(media);
      recorder.current = instance;
      instance.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      instance.onstop = async () => {
        const blob = new Blob(chunks.current, { type: instance.mimeType || 'audio/webm' });
        cleanup();
        setState('uploading');
        try {
          const result = await transcribeAudio(blob, settings);
          setText(result);
          setState('done');
          showSnackbar({ message: '语音转文字接口调用成功' });
        } catch (error) {
          setState('error');
          setMessage(error instanceof Error ? error.message : '接口调用失败');
        }
      };
      instance.start();

      // 音量电平，让用户看到确实在录音
      const context = new AudioContext();
      audioContext.current = context;
      const source = context.createMediaStreamSource(media);
      const node = context.createAnalyser();
      node.fftSize = 512;
      source.connect(node);
      analyser.current = node;
      const tick = () => {
        const analyserNode = analyser.current;
        if (!analyserNode) return;
        const data = new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.getByteTimeDomainData(data);
        let peak = 0;
        for (const value of data) peak = Math.max(peak, Math.abs(value - 128) / 128);
        setLevel(peak);
        window.requestAnimationFrame(tick);
      };
      window.requestAnimationFrame(tick);
      setState('recording');
    } catch (error) {
      cleanup();
      setState('error');
      setMessage(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? '未获得麦克风权限，请在浏览器地址栏允许麦克风后重试。'
          : `无法开始录音：${error instanceof Error ? error.message : '未知错误'}`,
      );
    }
  };

  return (
    <md-dialog ref={dialogRef} className="app-dialog" onCancel={onClose}>
      <div slot="headline">录音试用语音转文字API</div>
      <div slot="content" className="md-body-medium">
        <div className="muted mb-12">
          将录制最长 {MAX_TRIAL_SECONDS} 秒的语音并直接调用：
          <br />
          <span className="mono">{settings.sttApiUrl || '（未配置）'}</span>
        </div>

        <div className="trial-recorder">
          <div className="row gap-12" style={{ alignItems: 'center' }}>
            <span className={state === 'recording' ? 'live-dot' : ''} style={state === 'recording' ? {} : { width: 10, height: 10, borderRadius: 999, background: 'var(--md-sys-color-outline-variant)' }} />
            <span className="md-title-small-emphasized flex-1">
              {state === 'recording'
                ? '正在录音…'
                : state === 'uploading'
                  ? '正在上传识别…'
                  : state === 'done'
                    ? '识别完成'
                    : state === 'error'
                      ? '调用失败'
                      : '准备就绪'}
            </span>
            <span className="md-label-medium mono">{formatSeconds(seconds)}</span>
          </div>

          <div className="progress-track mt-8">
            <div
              className={`progress-fill${state === 'uploading' || state === 'idle' ? ' indeterminate' : ''}`}
              style={
                state === 'recording'
                  ? { width: `${Math.min(100, Math.round((seconds / MAX_TRIAL_SECONDS) * 100))}%` }
                  : state === 'done'
                    ? { width: '100%' }
                    : undefined
              }
            />
          </div>

          {state === 'recording' ? (
            <div className="level-meter mt-8" aria-hidden="true">
              <div className="level-fill" style={{ width: `${Math.round(Math.min(1, level * 2.2) * 100)}%` }} />
            </div>
          ) : null}
        </div>

        {text ? (
          <div className="container-box surface-high mt-12" style={{ maxHeight: 160, overflowY: 'auto' }}>
            <div className="md-label-medium muted mb-8">识别结果</div>
            <div className="md-body-medium">{text}</div>
          </div>
        ) : null}

        {message ? (
          <div
            className="container-box mt-12"
            style={{ background: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' }}
          >
            {message}
          </div>
        ) : null}

        <div className="md-body-small muted mt-12">
          提示：若接口未返回内容，请确认地址支持 multipart/form-data、字段名为 file，并已填写密钥。
        </div>
      </div>
      <div slot="actions">
        <md-text-button onClick={onClose}>关闭</md-text-button>
        {state === 'recording' ? (
          <md-text-button onClick={stop}>
            <MdIcon slot="icon" name="stop" />
            停止并识别
          </md-text-button>
        ) : (
          <md-text-button onClick={() => void start()} disabled={state === 'uploading' ? '' : undefined}>
            <MdIcon slot="icon" name="mic" />
            {state === 'done' || state === 'error' ? '重新录制' : '开始录音'}
          </md-text-button>
        )}
      </div>
    </md-dialog>
  );
}
