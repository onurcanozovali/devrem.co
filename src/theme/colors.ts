export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSecondary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  border: string;
  divider: string;
  primary: string;
  primaryPressed: string;
  primarySubtle: string;
  success: string;
  warning: string;
  danger: string;
  inputBackground: string;
  placeholder: string;
  overlay: string;
  overlayContent: string;
}

export const lightColors: ThemeColors = {
  background: '#F5F7F6',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSecondary: '#E9EFEC',
  textPrimary: '#17201D',
  textSecondary: '#44514C',
  textMuted: '#65736E',
  textInverse: '#FFFFFF',
  border: '#DDE5E1',
  divider: '#E6ECE9',
  primary: '#176B52',
  primaryPressed: '#105440',
  primarySubtle: '#DCEEE7',
  success: '#247A57',
  warning: '#956515',
  danger: '#BA3131',
  inputBackground: '#FFFFFF',
  placeholder: '#65736E',
  overlay: 'rgba(9, 20, 16, 0.48)',
  overlayContent: '#FFFFFF',
};

export const darkColors: ThemeColors = {
  background: '#101613',
  surface: '#18211D',
  surfaceElevated: '#1D2823',
  surfaceSecondary: '#202C27',
  textPrimary: '#F2F6F4',
  textSecondary: '#CCD7D2',
  textMuted: '#A5B3AD',
  textInverse: '#092117',
  border: '#34453D',
  divider: '#26342E',
  primary: '#55C99D',
  primaryPressed: '#3EAA82',
  primarySubtle: '#163B2E',
  success: '#66D6A9',
  warning: '#E6B864',
  danger: '#FF8989',
  inputBackground: '#18211D',
  placeholder: '#A5B3AD',
  overlay: 'rgba(2, 8, 5, 0.68)',
  overlayContent: '#F2F6F4',
};
