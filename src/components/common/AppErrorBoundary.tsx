import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface State { hasError: boolean }

export class AppErrorBoundary extends Component<PropsWithChildren, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State { return { hasError: true }; }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Connect Crashlytics here in a later phase.
  }

  private retry = () => this.setState({ hasError: false });

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Bir şeyler ters gitti</Text>
        <Text style={styles.description}>Beklenmeyen bir sorun oluştu. Lütfen tekrar deneyin.</Text>
        <Pressable accessibilityRole="button" onPress={this.retry} style={styles.button}>
          <Text style={styles.buttonLabel}>Tekrar dene</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F7F6', padding: 24 },
  title: { color: '#17201D', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  description: { color: '#65736E', fontSize: 16, lineHeight: 24, textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: '#176B52', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  buttonLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
