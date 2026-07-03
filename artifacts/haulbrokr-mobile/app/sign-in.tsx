import { useAuth, useClerk, useSSO } from "@clerk/expo";
import { Feather, FontAwesome } from "@expo/vector-icons";
import { router } from "expo-router";
import * as AuthSession from "expo-auth-session";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import {
  DevSettings,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { resetAllClerkLocalState, markClerkActiveSession } from "@/lib/clerkTokenCache";

type Mode = "signin" | "signup";
type Step = "credentials" | "verify";

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { isLoaded: authLoaded } = useAuth();
  const clerk = useClerk();
  const signIn = clerk.client?.signIn;
  const signUp = clerk.client?.signUp;
  const setActive = clerk.setActive?.bind(clerk);
  const { startSSOFlow } = useSSO();
  const [ssoBusy, setSsoBusy] = useState<null | "google" | "apple">(null);
  const [resettingAuth, setResettingAuth] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);

  const handleSSO = async (strategy: "oauth_google" | "oauth_apple") => {
    const which = strategy === "oauth_google" ? "google" : "apple";
    setSsoBusy(which);
    setError("");
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy,
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        await markClerkActiveSession();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/" as any);
      } else {
        setError(`Sign-in with ${which} couldn't complete. Please try again.`);
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? err?.message ?? "";
      if (/not enabled|provider.*not.*configured|strategy.*not.*allowed/i.test(msg)) {
        setError(`Sign in with ${which === "google" ? "Google" : "Apple"} isn't enabled yet — turn it on in the Auth pane.`);
      } else if (msg) {
        setError(msg);
      }
    } finally {
      setSsoBusy(null);
    }
  };

  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<Step>("credentials");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const clerkReady = authLoaded && !!signIn && !!signUp && !!setActive;
  const authStuck = authLoaded && (!signIn || !signUp);

  const resetFormForMode = (nextMode: Mode) => {
    setMode(nextMode);
    setStep("credentials");
    setError("");
    setCode("");
    if (nextMode === "signin") {
      setEmail("");
      setUsername("");
    }
  };

  const handleResetAuth = async () => {
    setResettingAuth(true);
    setError("");
    try {
      await resetAllClerkLocalState();
      if (Platform.OS === "web") {
        window.location.reload();
        return;
      }
      DevSettings.reload();
    } catch (err: any) {
      setError(err?.message ?? "Could not reset authentication data.");
    } finally {
      setResettingAuth(false);
    }
  };

  const completeSignIn = async (sessionId: string | null | undefined) => {
    if (!sessionId || !setActive) {
      setError("Sign-in incomplete. Please try again.");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await setActive({ session: sessionId });
    await markClerkActiveSession();
    router.replace("/" as any);
  };

  const completeSignUp = async (sessionId: string | null | undefined) => {
    if (!sessionId || !setActive) {
      setError("Sign-up incomplete. Please try again.");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await setActive({ session: sessionId });
    await markClerkActiveSession();
    router.replace("/onboarding" as any);
  };

  const handleSignIn = async () => {
    setError("");
    const id = identifier.trim();
    if (!id) {
      setError("Please enter your username or email.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    if (!clerkReady || !signIn) {
      setError("Authentication is initialising. Please wait a moment.");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: id, password });
      if (result.status === "complete") {
        await completeSignIn(result.createdSessionId);
        return;
      }

      const passwordFactor = signIn.supportedFirstFactors?.find(
        (f) => f.strategy === "password"
      );
      if (passwordFactor) {
        const attempt = await signIn.attemptFirstFactor({
          strategy: "password",
          password,
        });
        if (attempt.status === "complete") {
          await completeSignIn(attempt.createdSessionId);
          return;
        }
      }

      setError("Sign-in incomplete. Check your username/email and password.");
    } catch (err: any) {
      const errCode = err?.errors?.[0]?.code;
      if (errCode === "form_identifier_not_found") {
        setError("No account found with that username or email. Try signing up.");
      } else if (errCode === "form_password_incorrect") {
        setError("Incorrect password. Please try again.");
      } else {
        setError(err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? "Could not sign in. Try again.");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setError("");
    const nextEmail = email.trim();
    const nextUsername = username.trim();
    if (!nextEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (!nextUsername) {
      setError("Please choose a username.");
      return;
    }
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!clerkReady || !signUp) {
      setError("Authentication is initialising. Please wait a moment.");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    try {
      const result = await signUp.create({
        emailAddress: nextEmail,
        username: nextUsername,
        password,
      });

      if (result.status === "complete") {
        await completeSignUp(result.createdSessionId);
        return;
      }

      if (result.status === "missing_requirements") {
        const needsEmailVerification = signUp.unverifiedFields?.includes("email_address");
        if (needsEmailVerification) {
          await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
          setStep("verify");
          return;
        }
      }

      setError("Sign-up incomplete. Please try again.");
    } catch (err: any) {
      const errCode = err?.errors?.[0]?.code;
      if (errCode === "form_identifier_exists") {
        setError("An account with that email or username already exists. Try signing in.");
      } else {
        setError(err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? "Could not create account. Try again.");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (mode === "signin") {
      void handleSignIn();
    } else {
      void handleSignUp();
    }
  };

  const handleVerifyCode = async () => {
    setError("");
    if (!code.trim()) {
      setError("Please enter the 6-digit code from your email.");
      return;
    }
    if (!clerkReady || !signUp || !setActive) {
      setError("Authentication is initialising. Please wait a moment.");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.status === "complete") {
        await completeSignUp(result.createdSessionId);
      } else {
        setError("Verification incomplete. Please try again.");
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? "Incorrect code. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToCredentials = () => {
    setError("");
    setCode("");
    setStep("credentials");
  };

  const verifyEmail = email.trim() || identifier.trim();

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoRow}>
          <Image
            source={require("../assets/images/haulbrokr-logo.png")}
            style={styles.logoImg}
            resizeMode="contain"
          />
        </View>

        {step === "credentials" && (
          <View style={styles.modeRow}>
            <Pressable
              onPress={() => resetFormForMode("signin")}
              style={[styles.modeTab, mode === "signin" && styles.modeTabActive]}
            >
              <Text style={[styles.modeTabText, mode === "signin" && styles.modeTabTextActive]}>
                Sign In
              </Text>
            </Pressable>
            <Pressable
              onPress={() => resetFormForMode("signup")}
              style={[styles.modeTab, mode === "signup" && styles.modeTabActive]}
            >
              <Text style={[styles.modeTabText, mode === "signup" && styles.modeTabTextActive]}>
                Sign Up
              </Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.subtitle}>
          {step === "credentials"
            ? mode === "signin"
              ? "Welcome back — sign in with your username or email and password"
              : "Create your account with a username, email, and password"
            : `We sent a 6-digit code to\n${verifyEmail}`}
        </Text>

        {step === "credentials" ? (
          <>
            <Pressable
              style={[styles.ssoBtn, styles.ssoGoogle, (ssoBusy !== null || !clerkReady) && styles.btnDisabled]}
              onPress={() => handleSSO("oauth_google")}
              disabled={ssoBusy !== null || !clerkReady}
            >
              {ssoBusy === "google" ? (
                <ActivityIndicator color="#1e2235" />
              ) : (
                <>
                  <FontAwesome name="google" size={17} color="#1e2235" />
                  <Text style={styles.ssoGoogleText}>Continue with Google</Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={[styles.ssoBtn, styles.ssoApple, (ssoBusy !== null || !clerkReady) && styles.btnDisabled]}
              onPress={() => handleSSO("oauth_apple")}
              disabled={ssoBusy !== null || !clerkReady}
            >
              {ssoBusy === "apple" ? (
                <ActivityIndicator color="#f0f6ff" />
              ) : (
                <>
                  <FontAwesome name="apple" size={19} color="#f0f6ff" />
                  <Text style={styles.ssoAppleText}>Continue with Apple</Text>
                </>
              )}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or use password</Text>
              <View style={styles.dividerLine} />
            </View>

            {mode === "signin" ? (
              <View style={[styles.inputRow, !clerkReady && styles.inputDisabled]}>
                <Feather name="user" size={16} color="#8ba0b8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Username or email"
                  placeholderTextColor="#4a5568"
                  value={identifier}
                  onChangeText={(t) => { setIdentifier(t); setError(""); }}
                  autoCapitalize="none"
                  autoComplete="username"
                  returnKeyType="next"
                  editable={clerkReady}
                />
              </View>
            ) : (
              <>
                <View style={[styles.inputRow, !clerkReady && styles.inputDisabled]}>
                  <Feather name="user" size={16} color="#8ba0b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Username"
                    placeholderTextColor="#4a5568"
                    value={username}
                    onChangeText={(t) => { setUsername(t); setError(""); }}
                    autoCapitalize="none"
                    autoComplete="username"
                    returnKeyType="next"
                    editable={clerkReady}
                  />
                </View>
                <View style={[styles.inputRow, !clerkReady && styles.inputDisabled]}>
                  <Feather name="mail" size={16} color="#8ba0b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="your@email.com"
                    placeholderTextColor="#4a5568"
                    value={email}
                    onChangeText={(t) => { setEmail(t); setError(""); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    returnKeyType="next"
                    editable={clerkReady}
                  />
                </View>
              </>
            )}

            <View style={[styles.inputRow, !clerkReady && styles.inputDisabled]}>
              <Feather name="lock" size={16} color="#8ba0b8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#4a5568"
                value={password}
                onChangeText={(t) => { setPassword(t); setError(""); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete={mode === "signin" ? "password" : "new-password"}
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
                editable={clerkReady}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                disabled={!clerkReady}
              >
                <Feather name={showPassword ? "eye-off" : "eye"} size={16} color="#8ba0b8" />
              </Pressable>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={[styles.btn, (loading || !clerkReady || ssoBusy !== null) && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading || !clerkReady || ssoBusy !== null}
            >
              {loading ? (
                <ActivityIndicator color="#1e2235" />
              ) : (
                <Text style={styles.btnText}>
                  {mode === "signin" ? "Sign In" : "Create Account"}
                </Text>
              )}
            </Pressable>

            {!clerkReady && (
              <>
                <Text style={styles.initText}>
                  {authStuck
                    ? "Clerk could not start. Enable Native applications in the Clerk dashboard, then reset below."
                    : "Authentication initialising…"}
                </Text>
                <Pressable
                  onPress={handleResetAuth}
                  disabled={resettingAuth}
                  style={styles.resetBtn}
                >
                  {resettingAuth ? (
                    <ActivityIndicator size="small" color="#e9a600" />
                  ) : (
                    <Text style={styles.resetText}>Reset saved auth data</Text>
                  )}
                </Pressable>
              </>
            )}
          </>
        ) : (
          <>
            <View style={styles.codeHint}>
              <Feather name="mail" size={14} color="#e9a600" />
              <Text style={styles.codeHintText}>
                Verify your email to finish creating your account
              </Text>
            </View>

            <View style={styles.inputRow}>
              <Feather name="hash" size={16} color="#8ba0b8" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="000000"
                placeholderTextColor="#4a5568"
                value={code}
                onChangeText={(t) => { setCode(t.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="go"
                onSubmitEditing={handleVerifyCode}
                autoFocus
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={[styles.btn, (loading || code.length < 6) && styles.btnDisabled]}
              onPress={handleVerifyCode}
              disabled={loading || code.length < 6}
            >
              {loading ? (
                <ActivityIndicator color="#1e2235" />
              ) : (
                <Text style={styles.btnText}>Verify & Continue</Text>
              )}
            </Pressable>

            <View style={styles.resendRow}>
              <Text style={styles.resendLabel}>Wrong email? </Text>
              <Pressable onPress={handleBackToCredentials}>
                <Text style={styles.resendLink}>Go back</Text>
              </Pressable>
            </View>
          </>
        )}

        <Text style={styles.footerNote}>
          By continuing you agree to HaulBrokr's Terms of Service and Privacy Policy
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1e2235" },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 28,
  },
  logoRow: { marginBottom: 20, width: "100%", alignItems: "center" },
  logoImg: { width: "82%", height: 96 },
  modeRow: {
    flexDirection: "row",
    backgroundColor: "#2a3352",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    width: "100%",
  },
  modeTab: {
    flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center",
  },
  modeTabActive: {
    backgroundColor: "#e9a600",
  },
  modeTabText: {
    fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#8ba0b8",
  },
  modeTabTextActive: {
    color: "#1e2235",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#8ba0b8",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 21,
  },
  inputRow: {
    width: "100%", flexDirection: "row", alignItems: "center",
    backgroundColor: "#2a3352", borderRadius: 12, borderWidth: 1, borderColor: "#3a4565",
    paddingHorizontal: 14, marginBottom: 14,
  },
  inputDisabled: { opacity: 0.6 },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1, height: 52, color: "#f0f6ff",
    fontFamily: "Inter_400Regular", fontSize: 15,
  },
  codeInput: {
    fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: 6, textAlign: "center",
  },
  btn: {
    width: "100%", backgroundColor: "#e9a600", borderRadius: 12,
    height: 52, alignItems: "center", justifyContent: "center", marginBottom: 14,
  },
  btnDisabled: { opacity: 0.55 },
  btnText: { color: "#1e2235", fontFamily: "Inter_700Bold", fontSize: 16 },
  ssoBtn: {
    width: "100%", height: 50, borderRadius: 12, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10,
    borderWidth: 1,
  },
  ssoGoogle: { backgroundColor: "#f0f6ff", borderColor: "#f0f6ff" },
  ssoGoogleText: { color: "#1e2235", fontFamily: "Inter_700Bold", fontSize: 15 },
  ssoApple: { backgroundColor: "#0a0a0a", borderColor: "#2a3352" },
  ssoAppleText: { color: "#f0f6ff", fontFamily: "Inter_700Bold", fontSize: 15 },
  dividerRow: {
    flexDirection: "row", alignItems: "center", width: "100%",
    marginVertical: 12, gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#3a4565" },
  dividerText: { color: "#6b7280", fontFamily: "Inter_500Medium", fontSize: 11, letterSpacing: 1 },
  errorText: {
    color: "#f87171", fontFamily: "Inter_400Regular", fontSize: 13,
    textAlign: "center", marginBottom: 12, lineHeight: 18,
  },
  initText: {
    color: "#8ba0b8", fontFamily: "Inter_400Regular", fontSize: 12,
    textAlign: "center", marginTop: -4,
  },
  resetBtn: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  resetText: {
    color: "#e9a600", fontFamily: "Inter_600SemiBold", fontSize: 12,
    textAlign: "center",
  },
  codeHint: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#e9a60012", borderWidth: 1, borderColor: "#e9a60030",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 16, width: "100%",
  },
  codeHintText: {
    color: "#e9a600", fontFamily: "Inter_400Regular", fontSize: 13,
  },
  resendRow: {
    flexDirection: "row", alignItems: "center", marginBottom: 24,
  },
  resendLabel: { color: "#8ba0b8", fontFamily: "Inter_400Regular", fontSize: 13 },
  resendLink: { color: "#e9a600", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  footerNote: {
    color: "#3a4565", fontFamily: "Inter_400Regular",
    fontSize: 11, textAlign: "center", lineHeight: 16, marginTop: 8,
  },
});
