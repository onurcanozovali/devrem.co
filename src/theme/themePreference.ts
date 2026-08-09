import { File, Paths } from 'expo-file-system';
import { writeAsStringAsync } from 'expo-file-system/legacy';

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

export async function writeThemeModePreference(mode: ThemeMode): Promise<void> {
  await writeAsStringAsync(getPreferenceFile().uri, mode);
}