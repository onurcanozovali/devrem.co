import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { darkColors, lightColors, type ThemeColors } from './colors';
import { resolveThemeMode, type ResolvedTheme, type ThemeMode } from './themeMode';
import { readThemeModePreference, writeThemeModePreference } from './themePreference';
import { radii, spacing, typography } from './tokens';

function syncNativeAppearance(mode: ThemeMode): void {
  try {
    Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
  } catch {
    // The semantic theme remains usable if native appearance is unavailable.
  }
}

const initialMode = readThemeModePreference();
syncNativeAppearance(initialMode);

interface ThemeContextValue {
  colorScheme: ResolvedTheme;
  colors: ThemeColors;
  mode: ThemeMode;
  radii: typeof radii;
  resolvedScheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => boolean;
  spacing: typeof spacing;
  typography: typeof typography;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(initialMode);
  const resolvedScheme = resolveThemeMode(mode, systemScheme);
  const setMode = useCallback((nextMode: ThemeMode): boolean => {
    if (!writeThemeModePreference(nextMode)) return false;
    syncNativeAppearance(nextMode);
    setModeState(nextMode);
    return true;
  }, []);
  useEffect(() => syncNativeAppearance(mode), [mode]);
  const value = useMemo<ThemeContextValue>(
    () => ({
      colorScheme: resolvedScheme,
      colors: resolvedScheme === 'dark' ? darkColors : lightColors,
      mode,
      radii,
      resolvedScheme,
      setMode,
      spacing,
      typography,
    }),
    [mode, resolvedScheme, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider.');
  return context;
}
