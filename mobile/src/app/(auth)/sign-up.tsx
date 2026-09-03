import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { UtensilsIcon } from '@/components/icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Shadows, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function SignUpScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignUp() {
    setError(null);
    setIsSubmitting(true);
    // `display_name` lands in raw_user_meta_data, which the handle_new_user
    // trigger (see supabase/migrations) copies into public.users on insert.
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    setIsSubmitting(false);
    if (signUpError) {
      setError(signUpError.message);
    }
  }

  return (
    <ThemedView type="background" style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <View style={styles.logo}>
              <UtensilsIcon size={26} color={Colors.background} />
            </View>
            <ThemedText variant="heading" style={styles.title}>
              Create account
            </ThemedText>

            <View style={styles.field}>
              <ThemedText variant="body" color="neutral700" style={styles.label}>
                Display name
              </ThemedText>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="What should we call you?"
                placeholderTextColor={Colors.neutral500}
                style={styles.input}
              />
            </View>
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

            <Button block onPress={handleSignUp} disabled={isSubmitting} style={styles.submit} textStyle={styles.submitLabel}>
              {isSubmitting ? 'Creating account…' : 'Sign up'}
            </Button>

            <View style={styles.footer}>
              <ThemedText variant="body" color="neutral700">
                Already have an account?{' '}
              </ThemedText>
              <Link href="/(auth)/sign-in">
                <ThemedText variant="bodySemibold" color="text">
                  Sign in
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
  content: {
    gap: Spacing.space3,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  title: {
    fontSize: 34,
    marginTop: Spacing.space2,
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
