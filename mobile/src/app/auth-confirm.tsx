import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/toast';
import { Colors, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

// Lands here when the user taps the "confirm your email" link from Supabase.
// sign-up.tsx points that link's emailRedirectTo at `yumyums://auth-confirm`
// (via Linking.createURL), so expo-router resolves it straight to this
// screen with the PKCE `code` (or an `error`/`error_description` pair, e.g.
// for an expired/already-used link) available as search params. The
// supabase client has detectSessionInUrl: false, so nothing else picks this
// up automatically — the exchange has to happen here.
export default function AuthConfirmScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Effects can run twice under StrictMode/fast refresh; a PKCE code is
  // single-use, so guard against exchanging it more than once.
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    async function confirm() {
      if (params.error) {
        setErrorMessage(params.error_description ?? params.error ?? 'That confirmation link is no longer valid.');
        showToast('That confirmation link is no longer valid — sign in or sign up again');
        router.replace('/(auth)/sign-in');
        return;
      }

      if (!params.code) {
        setErrorMessage('Missing confirmation code.');
        showToast('That confirmation link is missing information — try signing in');
        router.replace('/(auth)/sign-in');
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(params.code);
      if (error) {
        setErrorMessage(error.message);
        showToast('Could not confirm your email — try signing in');
        router.replace('/(auth)/sign-in');
        return;
      }

      showToast('Email confirmed — you\'re all set');
      router.replace('/(tabs)');
    }

    confirm();
  }, [params.code, params.error, params.error_description, router, showToast]);

  return (
    <ThemedView type="background" style={styles.container}>
      <View style={styles.content}>
        {errorMessage ? (
          <ThemedText variant="body" color="accent700" style={styles.text}>
            {errorMessage}
          </ThemedText>
        ) : (
          <>
            <ActivityIndicator size="large" color={Colors.accent} />
            <ThemedText variant="body" color="neutral700" style={styles.text}>
              Confirming your email…
            </ThemedText>
          </>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.space6,
  },
  content: {
    alignItems: 'center',
    gap: Spacing.space3,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
  },
});
