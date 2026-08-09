import { File, Paths } from 'expo-file-system';

import { parseThemeMode, type ThemeMode } from './themeMode';

const preferenceFileName = 'devrem-theme-mode.txt';

function getPreferenceFile(): File {
  return new File(Paths.document, preferenceFileName);
}

export function readThemeModePreference(): ThemeMode {
  try {
    const file = getPreferenceFile();
    return file.exists ? parseThemeMode(file.textSync().trim()) : 'system';
  } catch {
    return 'system';
  }
}

export function writeThemeModePreference(mode: ThemeMode): boolean {
  try {
    getPreferenceFile().write(mode);
    return true;
  } catch {
    return false;
  }
}