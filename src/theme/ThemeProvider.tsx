import { createContext, type PropsWithChildren, useCallback, useContext, useMemo, useRef, useState } from 'react';
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
  radii: typeof radii;
  resolvedScheme: ResolvedTheme;
  spacing: typeof spacing;
  typography: typeof typography;
}

interface ThemeModeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

const darkThemeValue: ThemeContextValue = {
  colorScheme: 'dark',
  colors: darkColors,
  radii,
  resolvedScheme: 'dark',
  spacing,
  typography,
};

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(initialMode);
  const writeQueueRef = useRef(Promise.resolve());
  const resolvedScheme = resolveThemeMode(mode, systemScheme);
  const setMode = useCallback((nextMode: ThemeMode): void => {
    setModeState(nextMode);
    syncNativeAppearance(nextMode);
    writeQueueRef.current = writeQueueRef.current
      .catch(() => undefined)
      .then(() => writeThemeModePreference(nextMode))
      .catch(() => undefined);
  }, []);
  const value = useMemo<ThemeContextValue>(
    () => ({
      colorScheme: resolvedScheme,
      colors: resolvedScheme === 'dark' ? darkColors : lightColors,
      radii,
      resolvedScheme,
      spacing,
      typography,
    }),
    [resolvedScheme],
  );
  const modeValue = useMemo<ThemeModeContextValue>(() => ({ mode, setMode }), [mode, setMode]);

  return (
    <ThemeModeContext.Provider value={modeValue}>
      <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    </ThemeModeContext.Provider>
  );
}

export function DarkThemeScope({ children }: PropsWithChildren) {
  return <ThemeContext.Provider value={darkThemeValue}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider.');
  return context;
}

export function useThemeMode(): ThemeModeContextValue {
  const context = useContext(ThemeModeContext);
  if (!context) throw new Error('useThemeMode must be used within ThemeProvider.');
  return context;
}
