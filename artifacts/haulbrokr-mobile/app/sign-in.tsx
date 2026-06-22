import { useClerk, useSSO } from "@clerk/expo";
import { Feather, FontAwesome } from "@expo/vector-icons";
import { router } from "expo-router";
import * as AuthSession from "expo-auth-session";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import {
  Alert,
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

type Mode = "signin" | "signup";
type Step = "email" | "otp";

// Complete any pending OAuth redirects when the screen loads
WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const clerk = useClerk() as any;
  const { startSSOFlow } = useSSO();
  const [ssoBusy, setSsoBusy] = useState<null | "google" | "apple">(null);

  // Preload browser on Android so OAuth pops faster
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // New users land in onboarding to pick a role; returning users go home.
        // The root /index route already routes signed-in users without a profile to /onboarding.
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
      } else {
        // User cancelled — silent
      }
    } finally {
      setSsoBusy(null);
    }
  };

  const clerkLoaded = !!clerk?.loaded;
  const signIn = clerk?.client?.signIn;
  const signUp = clerk?.client?.signUp;
  const setSignInActive = clerk?.setActive?.bind(clerk);
  const setSignUpActive = clerk?.setActive?.bind(clerk);
  const signInLoaded = clerkLoaded && !!signIn;
  const signUpLoaded = clerkLoaded && !!signUp;

  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const clerkReady = signInLoaded && signUpLoaded;

  const handleSendCode = async () => {
    setError("");
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!clerkReady) {
      setError("Authentication is initialising. Please wait a moment.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    try {
      if (mode === "signin") {
        try {
          await signIn.create({ identifier: email.trim() });
          const firstFactor = signIn.supportedFirstFactors?.find(
            (f: any) => f.strategy === "email_code"
          );
          if (firstFactor) {
            await signIn.prepareFirstFactor({
              strategy: "email_code",
              emailAddressId: firstFactor.emailAddressId,
            });
            setStep("otp");
          } else {
            setError("Email code sign-in is not available. Contact support.");
          }
        } catch (err: any) {
          const code = err?.errors?.[0]?.code;
          if (code === "form_identifier_not_found") {
            // Email doesn't exist — auto-switch to sign-up
            setMode("signup");
            await signUp.create({ emailAddress: email.trim() });
            await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
            setStep("otp");
          } else {
            setError(err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? "Could not send code. Try again.");
          }
        }
      } else {
        try {
          await signUp.create({ emailAddress: email.trim() });
          await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
          setStep("otp");
        } catch (err: any) {
          const code = err?.errors?.[0]?.code;
          if (code === "form_identifier_exists") {
            // Account exists — switch to sign-in
            setMode("signin");
            await signIn.create({ identifier: email.trim() });
            const firstFactor = signIn.supportedFirstFactors?.find(
              (f: any) => f.strategy === "email_code"
            );
            if (firstFactor) {
              await signIn.prepareFirstFactor({
                strategy: "email_code",
                emailAddressId: firstFactor.emailAddressId,
              });
              setStep("otp");
            } else {
              setError("Email code sign-in is not available for this account. Contact support.");
            }
          } else {
            setError(err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? "Could not create account. Try again.");
          }
        }
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setError("");
    if (!code.trim()) {
      setError("Please enter the 6-digit code from your email.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    try {
      if (mode === "signin") {
        const result = await signIn.attemptFirstFactor({
          strategy: "email_code",
          code: code.trim(),
        });
        if (result.status === "complete") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await setSignInActive({ session: result.createdSessionId });
          router.replace("/" as any);
        } else {
          setError("Sign-in incomplete. Please try again.");
        }
      } else {
        const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
        if (result.status === "complete") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await setSignUpActive({ session: result.createdSessionId });
          router.replace("/onboarding" as any);
        } else {
          setError("Verification incomplete. Please try again.");
        }
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? "Incorrect code. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setCode("");
    setStep("email");
  };

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
        {/* Logo */}
        <View style={styles.logoRow}>
          <Image
            source={require("../assets/images/haulbrokr-logo.png")}
            style={styles.logoImg}
            resizeMode="contain"
          />
        </View>

        {/* Mode tabs — only show on email step */}
        {step === "email" && (
          <View style={styles.modeRow}>
            <Pressable
              onPress={() => { setMode("signin"); setError(""); }}
              style={[styles.modeTab, mode === "signin" && styles.modeTabActive]}
            >
              <Text style={[styles.modeTabText, mode === "signin" && styles.modeTabTextActive]}>
                Sign In
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { setMode("signup"); setError(""); }}
              style={[styles.modeTab, mode === "signup" && styles.modeTabActive]}
            >
              <Text style={[styles.modeTabText, mode === "signup" && styles.modeTabTextActive]}>
                Sign Up
              </Text>
            </Pressable>
          </View>
        )}

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          {step === "email"
            ? mode === "signin"
              ? "Welcome back — enter your email to receive a sign-in code"
              : "New here? Enter your email to sign up — you'll pick your role next"
            : `We sent a 6-digit code to\n${email}`}
        </Text>

        {/* Auto-switched notice */}
        {step === "email" && error === "" && (
          <View style={styles.spacer} />
        )}

        {step === "email" ? (
          <>
            {/* Social sign-in */}
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
              <Text style={styles.dividerText}>or use email</Text>
              <View style={styles.dividerLine} />
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
                returnKeyType="go"
                onSubmitEditing={handleSendCode}
                editable={clerkReady}
              />
              {!clerkReady && <ActivityIndicator size="small" color="#8ba0b8" />}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={[styles.btn, (loading || !clerkReady || ssoBusy !== null) && styles.btnDisabled]}
              onPress={handleSendCode}
              disabled={loading || !clerkReady || ssoBusy !== null}
            >
              {loading ? (
                <ActivityIndicator color="#1e2235" />
              ) : (
                <Text style={styles.btnText}>
                  {mode === "signin" ? "Send Sign-In Code" : "Send Verification Code"}
                </Text>
              )}
            </Pressable>

            {!clerkReady && (
              <Text style={styles.initText}>Authentication initialising…</Text>
            )}
          </>
        ) : (
          <>
            <View style={styles.codeHint}>
              <Feather name="mail" size={14} color="#e9a600" />
              <Text style={styles.codeHintText}>
                Check your inbox{mode === "signup" ? " and spam folder" : ""} for the code
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
                <Text style={styles.btnText}>
                  {mode === "signin" ? "Verify & Sign In" : "Verify & Sign Up"}
                </Text>
              )}
            </Pressable>

            <View style={styles.resendRow}>
              <Text style={styles.resendLabel}>Didn't receive it? </Text>
              <Pressable onPress={handleResend}>
                <Text style={styles.resendLink}>Change email / Resend</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* Footer note */}
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
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#f0f6ff",
    marginBottom: 20,
    textAlign: "center",
  },
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
  spacer: { height: 4 },
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
