/**
 * 「喵」：点美术资源时的音效与反馈（WebAudio 合成，不依赖音频文件）。
 * 频率先上扬再下落 + 带通滤波，接近卡通猫叫；顺带触发一次轻微振动。
 */
export function playMeow(): boolean {
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return false;
  try {
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(430, now + 0.42);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1150, now);
    filter.frequency.exponentialRampToValueAtTime(1500, now + 0.2);
    filter.Q.value = 6;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.55);
    window.setTimeout(() => void ctx.close().catch(() => undefined), 900);
    navigator.vibrate?.([12, 40, 18]);
    return true;
  } catch {
    return false;
  }
}
