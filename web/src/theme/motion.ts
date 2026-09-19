/**
 * MotionScheme.expressive()
 *
 * Material 3 Expressive replaces fixed easing curves with physics based springs. The web has
 * no spring token system, so we solve the damped harmonic oscillator analytically and emit
 * CSS `linear()` easing functions (plus their settling duration) into custom properties.
 *
 * Spring constants are the Material 3 Expressive motion physics tokens:
 *   spatial : damping 0.9, stiffness 1400 / 700 / 300
 *   effects : damping 1.0, stiffness 3800 / 1600 / 800
 */

export interface SpringConfig {
  /** spring stiffness (Material 3 motion physics tokens) */
  stiffness: number;
  /** damping ratio, 0..1 (0.9 for spatial springs, 1.0 for effects springs) */
  damping: number;
}

const SAMPLES = 80;
const MAX_TIME = 3;
const REST = 0.0015;

/** Analytic step response of a (possibly under-damped) spring released from 0 towards 1. */
function springAt(config: SpringConfig, t: number): number {
  const { stiffness, damping: zeta } = config;
  const w0 = Math.sqrt(stiffness);
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  }
  if (Math.abs(zeta - 1) < 1e-6) {
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  }
  const s = Math.sqrt(zeta * zeta - 1) * w0;
  const r1 = -zeta * w0 + s;
  const r2 = -zeta * w0 - s;
  const c2 = -r1 / (r2 - r1);
  const c1 = 1 - c2;
  return 1 - (c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t));
}

export interface SpringEasing {
  css: string;
  duration: number;
  overshoot: number;
}

export function springEasing(config: SpringConfig): SpringEasing {
  // Settling time: last moment the response leaves the rest window.
  let duration = 0.3;
  let overshoot = 0;
  const step = 1 / 240;
  for (let t = 0; t <= MAX_TIME; t += step) {
    const x = springAt(config, t);
    overshoot = Math.max(overshoot, x);
    if (Math.abs(1 - x) > REST) duration = t;
  }
  duration = Math.min(MAX_TIME, Math.max(0.08, duration + step));

  const points: string[] = [];
  for (let i = 0; i <= SAMPLES; i += 1) {
    const t = (i / SAMPLES) * duration;
    const x = i === SAMPLES ? 1 : springAt(config, t);
    points.push(x.toFixed(4));
  }
  return { css: `linear(${points.join(', ')})`, duration, overshoot };
}

export interface MotionScheme {
  spatial: { fast: SpringEasing; default: SpringEasing; slow: SpringEasing };
  effects: { fast: SpringEasing; default: SpringEasing; slow: SpringEasing };
  /** generic spring used for "slight bounce on state change" */
  bounce: SpringEasing;
  /** scale/zoom spring used by the camera screen transition */
  zoom: SpringEasing;
}

export function expressiveMotionScheme(): MotionScheme {
  return {
    spatial: {
      fast: springEasing({ stiffness: 1400, damping: 0.9 }),
      default: springEasing({ stiffness: 700, damping: 0.9 }),
      slow: springEasing({ stiffness: 300, damping: 0.9 }),
    },
    effects: {
      fast: springEasing({ stiffness: 3800, damping: 1 }),
      default: springEasing({ stiffness: 1600, damping: 1 }),
      slow: springEasing({ stiffness: 800, damping: 1 }),
    },
    bounce: springEasing({ stiffness: 500, damping: 0.62 }),
    zoom: springEasing({ stiffness: 420, damping: 0.78 }),
  };
}

/** Publish the scheme as CSS custom properties consumed by base.css. */
export function installMotionScheme(): MotionScheme {
  const scheme = MOTION;
  const root = document.documentElement.style;
  const set = (name: string, spring: SpringEasing) => {
    root.setProperty(`--md-sys-motion-spring-${name}`, spring.css);
    root.setProperty(`--md-sys-motion-spring-${name}-duration`, `${Math.round(spring.duration * 1000)}ms`);
  };
  set('spatial-fast', scheme.spatial.fast);
  set('spatial-default', scheme.spatial.default);
  set('spatial-slow', scheme.spatial.slow);
  set('effects-fast', scheme.effects.fast);
  set('effects-default', scheme.effects.default);
  set('effects-slow', scheme.effects.slow);
  set('bounce', scheme.bounce);
  set('zoom', scheme.zoom);
  return scheme;
}

/** Single shared instance: the spring curves are deterministic, so solve them once. */
export const MOTION: MotionScheme = expressiveMotionScheme();
