import { router } from 'expo-router';
import { useRef, useState, type RefObject } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { KeyboardScroll } from '@/components/Keyboard';
import { Logo } from '@/components/Logo';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { useSignIn, useSignUp } from '@/data/account';
import { useGuest } from '@/store/guest';
import { colors, radius, space, type } from '@/theme';

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const signIn = useSignIn();
  const signUp = useSignUp();
  const guestCount = useGuest((s) => Object.keys(s.items).length);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const pending = signIn.isPending || signUp.isPending;
  const error = (mode === 'signin' ? signIn.error : signUp.error) as Error | null;

  const canSubmit =
    mode === 'signin'
      ? email.trim().length > 0 && password.length > 0
      : username.trim().length >= 3 && /\S+@\S+\.\S+/.test(email) && password.length >= 8;

  const submit = () => {
    if (!canSubmit || pending) return;
    const done = { onSuccess: () => (router.canGoBack() ? router.back() : router.replace('/')) };
    if (mode === 'signin') signIn.mutate({ identifier: email.trim(), password }, done);
    else signUp.mutate({ username: username.trim(), email: email.trim(), password }, done);
  };

  return (
    <View style={styles.screen}>
      <KeyboardScroll contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.top}>
          <Logo size={56} />
          <IconButton icon="close" accessibilityLabel="Close" onPress={() => router.back()} />
        </View>

        <Text variant="display">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</Text>
        <Text tone="muted" style={{ marginTop: space.sm }}>
          {guestCount > 0
            ? `The ${guestCount} title${guestCount === 1 ? '' : 's'} on this device will move into your account.`
            : 'Back up your library and keep it in sync everywhere.'}
        </Text>

        <View style={{ marginTop: space.xl }}>
          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'signin', label: 'Sign in' },
              { value: 'signup', label: 'Create account' },
            ]}
          />
        </View>

        <View style={styles.form}>
          {/* The keyboard's action key walks the form: Next, Next, Go. */}
          {mode === 'signup' && (
            <Field
              label="Username"
              value={username}
              onChangeText={setUsername}
              autoComplete="username-new"
              textContentType="username"
              hint="3–30 letters, numbers, . _ -"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          )}
          <Field
            inputRef={emailRef}
            label={mode === 'signin' ? 'Email or username' : 'Email'}
            value={email}
            onChangeText={setEmail}
            keyboardType={mode === 'signup' ? 'email-address' : 'default'}
            autoComplete={mode === 'signin' ? 'username' : 'email'}
            textContentType={mode === 'signin' ? 'username' : 'emailAddress'}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <Field
            inputRef={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            textContentType={mode === 'signin' ? 'password' : 'newPassword'}
            hint={mode === 'signup' ? 'At least 8 characters' : undefined}
            onSubmitEditing={submit}
            returnKeyType="go"
          />
        </View>

        {error && (
          <Text variant="caption" tone="danger" style={{ marginTop: space.md }} accessibilityLiveRegion="polite">
            {error.message}
          </Text>
        )}

        <Button
          label={mode === 'signin' ? 'Sign in' : 'Create account'}
          onPress={submit}
          loading={pending}
          disabled={!canSubmit}
          style={{ marginTop: space.xl }}
        />
        {mode === 'signin' && guestCount === 0 && (
          <Button label="Continue without an account" variant="ghost" onPress={() => router.back()} style={{ marginTop: space.sm }} />
        )}
      </KeyboardScroll>
    </View>
  );
}

function Field({
  label,
  hint,
  inputRef,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string; hint?: string; inputRef?: RefObject<TextInput | null> }) {
  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption" tone="muted" style={{ fontWeight: '600' }}>
        {label}
      </Text>
      <TextInput
        ref={inputRef}
        {...props}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.textFaint}
        style={styles.input}
        accessibilityLabel={label}
      />
      {hint && (
        <Text variant="caption" tone="faint">
          {hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: space.xl, width: '100%', maxWidth: 480, alignSelf: 'center' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.xl },
  form: { gap: space.lg, marginTop: space.xl },
  input: {
    height: 50,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    color: colors.text,
    ...type.body,
    fontSize: 16, // ≥16 so iOS Safari doesn't zoom on focus
  },
});
