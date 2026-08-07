export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSubtle: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  text: string;
  textMuted: string;
  border: string;
  danger: string;
}

export const lightColors: ThemeColors = {
  background: '#F5F7F6',
  surface: '#FFFFFF',
  surfaceSubtle: '#E9EFEC',
  primary: '#176B52',
  primaryPressed: '#105440',
  onPrimary: '#FFFFFF',
  text: '#17201D',
  textMuted: '#65736E',
  border: '#DDE5E1',
  danger: '#BA3131',
};

export const darkColors: ThemeColors = {
  background: '#101613',
  surface: '#18211D',
  surfaceSubtle: '#202C27',
  primary: '#55C99D',
  primaryPressed: '#3EAA82',
  onPrimary: '#092117',
  text: '#F2F6F4',
  textMuted: '#A5B3AD',
  border: '#2B3933',
  danger: '#FF8989',
};
