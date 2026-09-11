import * as Updates from 'expo-updates';
import { Component, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '@/constants/theme';

type Props = { children: ReactNode };
type State = { error: Error | null; componentStack: string | null };

// Catches otherwise-uncaught render errors anywhere below it and shows the
// actual error instead of the blank white screen a release build would
// otherwise show (there's no red-box overlay outside of dev). Deliberately
// avoids ThemedText/theme-dependent components other than raw colors, since
// this needs to render correctly even if the crash came from the app's own
// theming/font setup.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('Uncaught render error', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  handleReload = () => {
    Updates.reloadAsync().catch(() => {
      this.setState({ error: null, componentStack: null });
    });
  };

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Something crashed</Text>
          <Text style={styles.message}>{error.message}</Text>
          {componentStack && <Text style={styles.stack}>{componentStack.trim()}</Text>}
          <Pressable style={styles.button} onPress={this.handleReload}>
            <Text style={styles.buttonLabel}>Reload app</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.space6,
    gap: Spacing.space3,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  message: {
    fontSize: 15,
    color: Colors.text,
  },
  stack: {
    fontSize: 12,
    color: Colors.neutral700,
    fontFamily: 'monospace',
  },
  button: {
    marginTop: Spacing.space3,
    alignSelf: 'flex-start',
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.space2,
    paddingHorizontal: Spacing.space4,
  },
  buttonLabel: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: '600',
  },
});
