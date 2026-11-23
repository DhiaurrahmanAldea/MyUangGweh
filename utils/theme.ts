import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  useColorScheme,
  useWindowDimensions,
  type ColorSchemeName,
  type TextStyle,
} from 'react-native';
import { useSettings } from '../db/BudgetProvider';
import {
  assertNever,
  parseHexColor,
  type HexColor,
  type ThemePreference,
} from '../types/domain';

export interface AppThemeColors {
  readonly canvas: string;
  readonly surface: string;
  readonly surfaceElevated: string;
  readonly surfaceMuted: string;
  readonly border: string;
  readonly divider: string;
  readonly text: string;
  readonly textSecondary: string;
  readonly textMuted: string;
  readonly accent: string;
  readonly accentPressed: string;
  readonly accentSoft: string;
  readonly onAccent: string;
  readonly positive: string;
  readonly positiveSoft: string;
  readonly positiveTintSurface: string;
  readonly positiveBorder: string;
  readonly negative: string;
  readonly negativeSoft: string;
  readonly negativeTintSurface: string;
  readonly negativeBorder: string;
  readonly warning: string;
  readonly warningSoft: string;
  readonly destructiveFill: string;
  readonly onDestructive: string;
  readonly toastSurface: string;
  readonly toastBorder: string;
  readonly toastText: string;
  readonly toastAction: string;
  readonly switchThumb: string;
  readonly shadowColor: string;
  readonly onColorSwatch: string;
  readonly modalBackdrop: string;
  readonly onModalBackdrop: string;
  readonly ripple: string;
}

export interface AppSpacing {
  readonly xs: number;
  readonly sm: number;
  readonly md: number;
  readonly lg: number;
  readonly xl: number;
  readonly xxl: number;
}

export interface AppRadius {
  readonly sm: number;
  readonly md: number;
  readonly lg: number;
  readonly pill: number;
}

export interface AppThemeShadow {
  readonly shadowColor: string;
  readonly shadowOffset: { readonly width: number; readonly height: number };
  readonly shadowOpacity: number;
  readonly shadowRadius: number;
  readonly elevation: number;
}

export interface AppThemeShadows {
  readonly card: AppThemeShadow;
  readonly floating: AppThemeShadow;
}

export interface AppTypographyStyle {
  readonly fontSize: number;
  readonly fontWeight: TextStyle['fontWeight'];
  readonly letterSpacing?: number;
  readonly lineHeight: number;
}

export interface AppTypography {
  readonly display: AppTypographyStyle;
  readonly pageTitle: AppTypographyStyle;
  readonly sectionTitle: AppTypographyStyle;
  readonly cardTitle: AppTypographyStyle;
  readonly body: AppTypographyStyle;
  readonly bodyStrong: AppTypographyStyle;
  readonly caption: AppTypographyStyle;
  readonly micro: AppTypographyStyle;
}

export interface AppTheme {
  readonly isDark: boolean;
  readonly colors: AppThemeColors;
  readonly spacing: AppSpacing;
  readonly radius: AppRadius;
  readonly typography: AppTypography;
  readonly shadows: AppThemeShadows;
}

export const SPACING: AppSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const RADIUS: AppRadius = {
  sm: 10,
  md: 12,
  lg: 16,
  pill: 999,
};

export const TYPOGRAPHY: AppTypography = {
  display: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -0.9,
    lineHeight: 42,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.35,
    lineHeight: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.15,
    lineHeight: 22,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
    lineHeight: 20,
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
  },
  bodyStrong: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  micro: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
};

export const CONTENT_MAX_WIDTH = 680;

function createTheme(isDark: boolean, colors: AppThemeColors): AppTheme {
  return {
    isDark,
    colors,
    spacing: SPACING,
    radius: RADIUS,
    typography: TYPOGRAPHY,
    shadows: {
      card: {
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
      },
      floating: {
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.35 : 0.16,
        shadowRadius: 10,
        elevation: 6,
      },
    },
  };
}

export const LIGHT_THEME: AppTheme = createTheme(false, {
  canvas: '#F7F6F2',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#EFECE6',
  border: '#E4E0D8',
  divider: '#E7E4DC',
  text: '#161A1D',
  textSecondary: '#57606A',
  textMuted: '#5E6771',
  accent: '#0F766E',
  accentPressed: '#0B5D57',
  accentSoft: '#E6F4F1',
  onAccent: '#FFFFFF',
  positive: '#15803D',
  positiveSoft: '#ECFDF3',
  positiveTintSurface: '#F3FBF6',
  positiveBorder: '#BBF7D0',
  negative: '#DC2626',
  negativeSoft: '#FEF2F2',
  negativeTintSurface: '#FEF6F6',
  negativeBorder: '#FECACA',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  destructiveFill: '#DC2626',
  onDestructive: '#FFFFFF',
  toastSurface: '#161A1D',
  toastBorder: '#161A1D',
  toastText: '#FFFFFF',
  toastAction: '#2DD4BF',
  switchThumb: '#FFFFFF',
  shadowColor: '#0B1318',
  onColorSwatch: '#FFFFFF',
  modalBackdrop: 'rgba(11, 19, 24, 0.88)',
  onModalBackdrop: '#FFFFFF',
  ripple: 'rgba(22, 26, 29, 0.08)',
});

export const DARK_THEME: AppTheme = createTheme(true, {
  canvas: '#0F1417',
  surface: '#182026',
  surfaceElevated: '#1E2830',
  surfaceMuted: '#222C34',
  border: '#2A3640',
  divider: '#26323B',
  text: '#F3F5F6',
  textSecondary: '#9AA8B2',
  textMuted: '#93A3AE',
  accent: '#2DD4BF',
  accentPressed: '#14B8A6',
  accentSoft: '#133532',
  onAccent: '#062824',
  positive: '#4ADE80',
  positiveSoft: '#113122',
  positiveTintSurface: '#12251E',
  positiveBorder: '#1E4633',
  negative: '#F87171',
  negativeSoft: '#3B181B',
  negativeTintSurface: '#291719',
  negativeBorder: '#562428',
  warning: '#FBBF24',
  warningSoft: '#382A12',
  destructiveFill: '#DC2626',
  onDestructive: '#FFFFFF',
  toastSurface: '#253038',
  toastBorder: '#33414C',
  toastText: '#F3F5F6',
  toastAction: '#2DD4BF',
  switchThumb: '#FFFFFF',
  shadowColor: '#0B1318',
  onColorSwatch: '#FFFFFF',
  modalBackdrop: 'rgba(6, 10, 13, 0.92)',
  onModalBackdrop: '#FFFFFF',
  ripple: 'rgba(243, 245, 246, 0.10)',
});

function requireHexColor(value: string): HexColor {
  const parsed = parseHexColor(value);
  if (parsed === null) {
    throw new Error(`Invalid swatch hex color: ${value}`);
  }
  return parsed;
}

export const CATEGORY_COLOR_SWATCHES: readonly HexColor[] = [
  requireHexColor('#0F766E'),
  requireHexColor('#059669'),
  requireHexColor('#0284C7'),
  requireHexColor('#2563EB'),
  requireHexColor('#4F46E5'),
  requireHexColor('#7C3AED'),
  requireHexColor('#9333EA'),
  requireHexColor('#DB2777'),
  requireHexColor('#DC2626'),
  requireHexColor('#EA580C'),
  requireHexColor('#D97706'),
  requireHexColor('#64748B'),
];

export function colorWithAlpha(hexColor: string, alpha: number): string {
  const normalized = parseHexColor(hexColor);
  if (normalized === null) {
    return hexColor;
  }
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  return `rgba(${red}, ${green}, ${blue}, ${clampedAlpha})`;
}

export function resolveTheme(
  preference: ThemePreference,
  systemScheme: ColorSchemeName | null | undefined,
): AppTheme {
  switch (preference) {
    case 'light':
      return LIGHT_THEME;
    case 'dark':
      return DARK_THEME;
    case 'system':
      return systemScheme === 'dark' ? DARK_THEME : LIGHT_THEME;
    default:
      return assertNever(preference);
  }
}

export function useAppTheme(): AppTheme {
  const settings = useSettings();
  const systemScheme = useColorScheme();
  return resolveTheme(settings.theme, systemScheme);
}

export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let isMounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(
      (enabled) => {
        if (isMounted) {
          setReduceMotion(enabled);
        }
      },
      () => {},
    );

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        setReduceMotion(enabled);
      },
    );

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}

export interface ResponsiveLayout {
  readonly width: number;
  readonly isCompact: boolean;
  readonly isWide: boolean;
  readonly contentMaxWidth: number;
  readonly horizontalPadding: number;
}

export function useResponsiveLayout(): ResponsiveLayout {
  const { width } = useWindowDimensions();
  return useMemo(() => {
    const isWide = width >= CONTENT_MAX_WIDTH;
    return {
      width,
      isCompact: width < 380,
      isWide,
      contentMaxWidth: CONTENT_MAX_WIDTH,
      horizontalPadding: isWide ? SPACING.xxl : SPACING.lg,
    };
  }, [width]);
}

export function toNavigationTheme(theme: AppTheme): NavigationTheme {
  const base = theme.isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: theme.isDark,
    colors: {
      ...base.colors,
      primary: theme.colors.accent,
      background: theme.colors.canvas,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.negative,
    },
  };
}
