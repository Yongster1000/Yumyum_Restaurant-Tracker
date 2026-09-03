import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { UtensilsIcon } from '@/components/icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Shadows, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignIn() {
    setError(null);
    setIsSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);
    if (signInError) {
      setError(signInError.message);
    }
  }

  return (
    <ThemedView type="background" style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.blob, styles.blobTop]} />
          <View style={[styles.blob, styles.blobBottom]} />

          <View style={styles.content}>
            <View style={styles.logo}>
              <UtensilsIcon size={30} color={Colors.background} />
            </View>
            <ThemedText variant="heading" style={styles.title}>
              Yumyums
            </ThemedText>
            <ThemedText variant="body" color="neutral700" style={styles.tagline}>
              Every place you loved, and every place you keep meaning to try.
            </ThemedText>

            <View style={styles.field}>
              <ThemedText variant="body" color="neutral700" style={styles.label}>
                Email
              </ThemedText>
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                placeholder="you@yumyums.app"
                placeholderTextColor={Colors.neutral500}
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <ThemedText variant="body" color="neutral700" style={styles.label}>
                Password
              </ThemedText>
              <TextInput
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={Colors.neutral500}
                style={styles.input}
              />
            </View>

            {error && (
              <ThemedText variant="body" color="accent700">
                {error}
              </ThemedText>
            )}

            <Button block onPress={handleSignIn} disabled={isSubmitting} style={styles.submit} textStyle={styles.submitLabel}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>

            <View style={styles.footer}>
              <ThemedText variant="body" color="neutral700">
                New here?{' '}
              </ThemedText>
              <Link href="/(auth)/sign-up">
                <ThemedText variant="bodySemibold" color="text">
                  Make an account
                </ThemedText>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.space6,
    paddingVertical: Spacing.space8,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobTop: {
    top: -90,
    right: -70,
    width: 280,
    height: 280,
    backgroundColor: Colors.accent2200,
  },
  blobBottom: {
    bottom: 60,
    left: -110,
    width: 220,
    height: 220,
    backgroundColor: Colors.accent200,
  },
  content: {
    gap: Spacing.space3,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  title: {
    fontSize: 52,
    marginTop: Spacing.space2,
  },
  tagline: {
    fontSize: 17,
    maxWidth: 280,
    marginBottom: Spacing.space2,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
  },
  input: {
    minHeight: 52,
    fontSize: 16,
    fontFamily: 'Figtree_400Regular',
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.space3,
  },
  submit: {
    minHeight: 54,
    marginTop: Spacing.space3,
  },
  submitLabel: {
    fontSize: 17,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.space2,
  },
});
