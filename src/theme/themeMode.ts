export const themeModes = ['system', 'light', 'dark'] as const;

export type ThemeMode = (typeof themeModes)[number];
export type ResolvedTheme = Exclude<ThemeMode, 'system'>;

export const themeModeLabels: Record<ThemeMode, string> = {
  system: 'Sistem',
  light: 'Açık',
  dark: 'Koyu',
};

export function parseThemeMode(value: unknown): ThemeMode {
  return typeof value === 'string' && themeModes.some((mode) => mode === value)
    ? value as ThemeMode
    : 'system';
}

export function resolveThemeMode(mode: ThemeMode, systemScheme: string | null | undefined): ResolvedTheme {
  if (mode !== 'system') return mode;
  return systemScheme === 'dark' ? 'dark' : 'light';
}