import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ThemeColors } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import type { radii, spacing } from '@/theme/tokens';

interface State { hasError: boolean }

interface AppErrorBoundaryBaseProps extends PropsWithChildren {
  colors: ThemeColors;
  radii: typeof radii;
  spacing: typeof spacing;
}

class AppErrorBoundaryBase extends Component<AppErrorBoundaryBaseProps, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State { return { hasError: true }; }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Connect Crashlytics here in a later phase.
  }

  private retry = () => this.setState({ hasError: false });

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    const { colors, radii: themeRadii, spacing: themeSpacing } = this.props;
    return (
      <View style={[styles.container, { backgroundColor: colors.background, padding: themeSpacing.lg }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Bir şeyler ters gitti</Text>
        <Text style={[styles.description, { color: colors.textMuted }]}>Beklenmeyen bir sorun oluştu. Lütfen tekrar deneyin.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Uygulamayı tekrar yükle"
          onPress={this.retry}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: pressed ? colors.primaryPressed : colors.primary, borderRadius: themeRadii.md },
          ]}
        >
          <Text style={[styles.buttonLabel, { color: colors.textInverse }]}>Tekrar dene</Text>
        </Pressable>
      </View>
    );
  }
}

export function AppErrorBoundary({ children }: PropsWithChildren) {
  const { colors, radii: themeRadii, spacing: themeSpacing } = useTheme();
  return (
    <AppErrorBoundaryBase colors={colors} radii={themeRadii} spacing={themeSpacing}>
      {children}
    </AppErrorBoundaryBase>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  description: { fontSize: 16, lineHeight: 24, textAlign: 'center', marginBottom: 24 },
  button: { paddingHorizontal: 24, paddingVertical: 14 },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
});
