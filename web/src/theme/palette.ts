/**
 * Material 3 dynamic color.
 *
 * Everything in the UI references color *roles* (`--md-sys-color-*`). This module is the
 * only place that turns a seed color into those roles:
 *
 *  1. If the browser / host system exposes a user accent color (query string `?seed=`,
 *     an injected `window.__MD_SYS_SEED__`, a stored accent, or the CSS `accent-color`
 *     property) we generate a Material 3 Expressive high contrast scheme from that seed
 *     with material-color-utilities (the same tonal palette algorithm Material 3 uses).
 *  2. Otherwise we fall back to the exact Green fallback palette given by the design spec.
 */
import {
  Hct,
  MaterialDynamicColors,
  SchemeExpressive,
  argbFromHex,
  hexFromArgb,
  type DynamicScheme,
} from '@material/material-color-utilities';

export type MdRoles = Record<string, string>;

/** Seed used when the environment provides no user accent color. */
export const FALLBACK_SEED = '#00391C';

/** Exact fallback palette from the design spec (Material 3 light, high contrast, Green). */
export const FALLBACK_LIGHT: MdRoles = {
  primary: '#00391C',
  onPrimary: '#FEFFFE',
  primaryContainer: '#12512E',
  onPrimaryContainer: '#FEFFFE',
  secondary: '#243429',
  onSecondary: '#FEFFFE',
  secondaryContainer: '#3A4B3F',
  onSecondaryContainer: '#FEFFFE',
  tertiaryContainer: '#1E4D54',
  onTertiaryContainer: '#FEFFFF',
  surface: '#F5FBF6',
  surfaceContainerLow: '#EFF5F1',
  surfaceContainer: '#EAEFEB',
  surfaceContainerHigh: '#E4EAE5',
  surfaceContainerHighest: '#DEE4E0',
  onSurface: '#000000',
  onSurfaceVariant: '#141E17',
  outline: '#28332B',
  outlineVariant: '#28332B',
  inverseSurface: '#2D312E',
  inverseOnSurface: '#ECF2EE',
  inversePrimary: '#96D5A9',
  error: '#B3261E',
  onError: '#FFFFFF',
  errorContainer: '#F9DEDC',
  onErrorContainer: '#410E0B',
};

/** `onPrimaryContainer` -> `on-primary-container` (CSS custom property suffix). */
export function roleToCssName(role: string): string {
  return role.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function normalizeHex(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input.trim().toLowerCase();
  if (!HEX_RE.test(value)) return null;
  const raw = value.replace('#', '');
  if (raw.length === 3) {
    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
  }
  return `#${raw.slice(0, 6)}`;
}

/** Parse the many shapes a browser may hand us for a CSS color. */
export function parseCssColor(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input.trim().toLowerCase();
  if (!value || value === 'auto' || value === 'transparent') return null;
  const hex = normalizeHex(value);
  if (hex) return hex;
  const rgb = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (rgb) {
    const to = (n: string) => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, '0');
    return `#${to(rgb[1])}${to(rgb[2])}${to(rgb[3])}`;
  }
  return null;
}

export interface SeedSource {
  seed: string;
  origin: 'url' | 'host' | 'storage' | 'system-accent' | 'fallback';
}

/** Ask the environment for a user accent color; returns the fallback seed when nothing is available. */
export function detectSeed(): SeedSource {
  const fromUrl = normalizeHex(new URLSearchParams(location.search).get('seed'));
  if (fromUrl) return { seed: fromUrl, origin: 'url' };

  const injected = normalizeHex((window as unknown as Record<string, string>).__MD_SYS_SEED__);
  if (injected) return { seed: injected, origin: 'host' };

  try {
    const stored = normalizeHex(localStorage.getItem('accentSeed'));
    if (stored) return { seed: stored, origin: 'storage' };
  } catch {
    /* storage unavailable (private mode) - fall through */
  }

  // Browsers rarely surface the OS accent color; when the embedding page or the user
  // stylesheet provides one we honour it. (`<meta name="theme-color">` is our own
  // output, so it is deliberately not treated as a user accent.)
  try {
    const accent = parseCssColor(getComputedStyle(document.documentElement).accentColor);
    if (accent) return { seed: accent, origin: 'system-accent' };
  } catch {
    /* ignore */
  }

  return { seed: FALLBACK_SEED, origin: 'fallback' };
}

/**
 * Every Material 3 color role, resolved through MaterialDynamicColors so all roles
 * (including `tertiary`, `surfaceContainerLowest`, `surfaceTint`, `scrim`, ...) exist
 * even when the fallback palette only pins some of them.
 */
const ROLE_NAMES = [
  'primary',
  'onPrimary',
  'primaryContainer',
  'onPrimaryContainer',
  'primaryFixed',
  'primaryFixedDim',
  'onPrimaryFixed',
  'onPrimaryFixedVariant',
  'secondary',
  'onSecondary',
  'secondaryContainer',
  'onSecondaryContainer',
  'secondaryFixed',
  'secondaryFixedDim',
  'onSecondaryFixed',
  'onSecondaryFixedVariant',
  'tertiary',
  'onTertiary',
  'tertiaryContainer',
  'onTertiaryContainer',
  'tertiaryFixed',
  'tertiaryFixedDim',
  'onTertiaryFixed',
  'onTertiaryFixedVariant',
  'error',
  'onError',
  'errorContainer',
  'onErrorContainer',
  'surface',
  'onSurface',
  'surfaceDim',
  'surfaceBright',
  'surfaceContainerLowest',
  'surfaceContainerLow',
  'surfaceContainer',
  'surfaceContainerHigh',
  'surfaceContainerHighest',
  'surfaceVariant',
  'onSurfaceVariant',
  'outline',
  'outlineVariant',
  'inverseSurface',
  'inverseOnSurface',
  'inversePrimary',
  'shadow',
  'scrim',
  'surfaceTint',
  'background',
  'onBackground',
] as const;

const DYNAMIC_COLORS = new MaterialDynamicColors();

/** Material 3 Expressive color scheme (high contrast by default) for a seed color. */
function schemeFromSeed(seed: string, dark: boolean, contrastLevel = 1): DynamicScheme {
  return new SchemeExpressive(Hct.fromInt(argbFromHex(seed)), dark, contrastLevel);
}

/** Resolve every role of a dynamic scheme to a hex string. */
function rolesOf(scheme: DynamicScheme): MdRoles {
  const table = DYNAMIC_COLORS as unknown as Record<
    string,
    ((s: DynamicScheme) => { getArgb(s: DynamicScheme): number }) | undefined
  >;
  const roles: MdRoles = {};
  for (const role of ROLE_NAMES) {
    const resolver = table[role];
    if (typeof resolver !== 'function') continue;
    const dynamicColor = resolver.call(DYNAMIC_COLORS, scheme);
    if (dynamicColor && typeof dynamicColor.getArgb === 'function') {
      roles[role] = hexFromArgb(dynamicColor.getArgb(scheme));
    }
  }
  return roles;
}

export interface ThemeBundle {
  seed: SeedSource;
  light: MdRoles;
  dark: MdRoles;
  /** true when the environment supplied a real user accent color */
  dynamic: boolean;
}

export function buildThemes(seed: SeedSource): ThemeBundle {
  const dynamic = seed.origin !== 'fallback';
  // Material 3 Expressive schemes, high contrast, exactly like the spec palette.
  const light = rolesOf(schemeFromSeed(seed.seed, false));
  const dark = rolesOf(schemeFromSeed(seed.seed, true));
  if (!dynamic) {
    // The spec's hand tuned fallback palette wins over the generated one.
    Object.assign(light, FALLBACK_LIGHT);
  }
  return { seed, light, dark, dynamic };
}

/** Write the roles onto :root so every component can reference them by name. */
export function applyRoles(roles: MdRoles, dark: boolean): void {
  const root = document.documentElement;
  for (const [role, value] of Object.entries(roles)) {
    root.style.setProperty(`--md-sys-color-${roleToCssName(role)}`, value);
  }
  // Keep a couple of derived roles in sync for components that expect them.
  if (!roles.surfaceContainerLowest && roles.surface) {
    root.style.setProperty('--md-sys-color-surface-container-lowest', roles.surface);
  }
  root.style.setProperty('--md-sys-color-surface-tint', roles.primary ?? '');
  root.dataset.theme = dark ? 'dark' : 'light';
  root.style.colorScheme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', roles.surface ?? '#F5FBF6');
}
