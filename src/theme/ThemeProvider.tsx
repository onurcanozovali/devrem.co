import { createContext, type PropsWithChildren, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, type ThemeColors } from './colors';
import { radii, spacing, typography } from './tokens';

interface ThemeContextValue {
  colorScheme: 'light' | 'dark';
  colors: ThemeColors;
  radii: typeof radii;
  spacing: typeof spacing;
  typography: typeof typography;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const colorScheme = systemScheme === 'dark' ? 'dark' : 'light';
  const value = useMemo<ThemeContextValue>(
    () => ({ colorScheme, colors: colorScheme === 'dark' ? darkColors : lightColors, radii, spacing, typography }),
    [colorScheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider.');
  return context;
}
