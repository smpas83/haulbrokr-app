import { Feather } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState, useRef } from "react";
import {
  Alert, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVerifyTicket } from "@/hooks/useLiveApi";

// Lazy-import expo-camera so web bundling doesn't break.
let CameraView: any = null;
let useCameraPermissions: any = null;
if (Platform.OS !== "web") {
  try {
    const mod = require("expo-camera");
    CameraView = mod.CameraView;
    useCameraPermissions = mod.useCameraPermissions;
  } catch {}
}

export default function TicketScanScreen() {
  const verifyTicket = useVerifyTicket();
  const [permission, requestPermission] = useCameraPermissions ? useCameraPermissions() : [null, () => Promise.resolve({ granted: false })];
  const [manualToken, setManualToken] = useState("");
  const lastScanRef = useRef<string>("");
  const lockedRef = useRef(false);

  const handleResult = (token: string) => {
    verifyTicket.mutate(token, {
      onSuccess: (result) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Ticket Verified ✓", `Load #${result.ticket?.loadNumber} verified successfully.`, [
          { text: "Scan Another", onPress: () => { lockedRef.current = false; } },
          { text: "Done", onPress: () => router.back() },
        ]);
      },
      onError: (e: any) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Couldn't Verify", e?.message ?? "Unknown error.", [
          { text: "Try Again", onPress: () => { lockedRef.current = false; } },
        ]);
      },
    });
  };

  const handleManualSubmit = () => {
    if (!manualToken.trim()) {
      Alert.alert("Empty", "Paste a verification token first.");
      return;
    }
    handleResult(manualToken.trim());
    setManualToken("");
  };

  const onBarcodeScanned = (e: { data: string }) => {
    if (lockedRef.current) return;
    if (e.data === lastScanRef.current) return;
    lastScanRef.current = e.data;
    lockedRef.current = true;
    handleResult(e.data);
  };

  // Web / camera not available — show manual entry only
  if (Platform.OS === "web" || !CameraView) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: "Scan Ticket", headerStyle: { backgroundColor: "#1e2235" }, headerTintColor: "#f0f6ff" }} />
        <View style={styles.manualWrap}>
          <Feather name="smartphone" size={48} color="#8ba0b8" />
          <Text style={styles.manualTitle}>Camera Required</Text>
          <Text style={styles.manualBody}>
            QR scanning needs the iOS or Android app. For testing, paste a verification token below.
          </Text>
          <View style={styles.inputRow}>
            <Feather name="key" size={15} color="#8ba0b8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              placeholder="db:1:lt1:..."
              placeholderTextColor="#4a5568"
              value={manualToken}
              onChangeText={setManualToken}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Pressable style={styles.primaryBtn} onPress={handleManualSubmit}>
            <Text style={styles.primaryBtnText}>Verify Token</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Native — request permission if needed
  if (!permission) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: "Scan Ticket", headerStyle: { backgroundColor: "#1e2235" }, headerTintColor: "#f0f6ff" }} />
        <View style={styles.center}><Text style={styles.permText}>Loading camera…</Text></View>
      </SafeAreaView>
    );
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: "Scan Ticket", headerStyle: { backgroundColor: "#1e2235" }, headerTintColor: "#f0f6ff" }} />
        <View style={styles.center}>
          <Feather name="camera-off" size={42} color="#8ba0b8" />
          <Text style={styles.permTitle}>Camera Permission Needed</Text>
          <Text style={styles.permText}>To scan ticket QR codes from drivers, allow camera access.</Text>
          <Pressable style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryBtnText}>Grant Permission</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: "#000" }]}>
      <Stack.Screen options={{ title: "Scan Ticket", headerStyle: { backgroundColor: "#1e2235" }, headerTintColor: "#f0f6ff" }} />
      <View style={{ flex: 1 }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={onBarcodeScanned}
        />
        {/* Overlay */}
        <View pointerEvents="none" style={styles.overlay}>
          <View style={styles.reticle} />
          <Text style={styles.overlayHint}>Align the driver's QR code inside the box</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1e2235" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  manualWrap: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 12 },
  manualTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#f0f6ff", marginTop: 4 },
  manualBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#8ba0b8", textAlign: "center", marginBottom: 16, lineHeight: 19 },
  inputRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#2a3352",
    borderRadius: 12, borderWidth: 1, borderColor: "#3a4565",
    paddingHorizontal: 14, marginBottom: 14, width: "100%",
  },
  input: { flex: 1, height: 48, color: "#f0f6ff", fontFamily: "Inter_400Regular", fontSize: 13 },
  primaryBtn: { backgroundColor: "#e9a600", borderRadius: 10, paddingVertical: 14, paddingHorizontal: 32 },
  primaryBtnText: { color: "#1e2235", fontFamily: "Inter_700Bold", fontSize: 15 },
  permTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#f0f6ff" },
  permText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#8ba0b8", textAlign: "center", marginBottom: 8 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  reticle: { width: 240, height: 240, borderWidth: 3, borderColor: "#e9a600", borderRadius: 16, backgroundColor: "transparent" },
  overlayHint: { marginTop: 22, color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14, backgroundColor: "rgba(30,34,53,0.7)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
});
