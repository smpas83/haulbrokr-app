import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, Share, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import * as Haptics from "expo-haptics";
import { useTickets, useIssueTicketQR } from "@/hooks/useLiveApi";

export default function TicketQRScreen() {
  const params = useLocalSearchParams<{ jobId?: string; ticketId?: string }>();
  const jobId = parseInt(String(params.jobId ?? ""), 10);
  const ticketId = parseInt(String(params.ticketId ?? ""), 10);

  const { data: ticketsData } = useTickets(Number.isFinite(jobId) ? jobId : null);
  const tickets: any[] = ticketsData?.tickets ?? [];
  const ticket = tickets.find((t) => t.id === ticketId);

  const issueQR = useIssueTicketQR();
  const [token, setToken] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [error, setError] = useState<string>("");
  const issuedRef = React.useRef(false);

  const isVerified = !!ticket?.verifiedAt;

  const issue = React.useCallback(() => {
    if (!Number.isFinite(ticketId)) return;
    setError("");
    issueQR.mutate(ticketId, {
      onSuccess: (res) => {
        setToken(res.token);
        setExpiresAt(res.expiresAt);
      },
      onError: (e: any) => setError(e?.message ?? "Couldn't issue QR code."),
    });
  }, [ticketId]);

  // Issue a fresh signed token once the ticket is loaded and not yet verified.
  useEffect(() => {
    if (ticket && !isVerified && !issuedRef.current) {
      issuedRef.current = true;
      issue();
    }
  }, [ticket, isVerified, issue]);

  const handleShare = async () => {
    if (!token) return;
    try {
      await Share.share({ message: `HaulBrokr ticket #${ticket?.loadNumber}\nVerification token: ${token}` });
    } catch {}
  };

  const handleRegenerate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    issue();
  };

  if (!ticket) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: "Ticket QR", headerStyle: { backgroundColor: "#0A0A0C" }, headerTintColor: "#F4F4F5" }} />
        <View style={styles.center}>
          <Feather name="alert-circle" size={36} color="#8B8B96" />
          <Text style={styles.errorText}>Ticket not found.</Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const expiryLabel = expiresAt
    ? new Date(expiresAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "";

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: `Ticket #${ticket.loadNumber}`, headerStyle: { backgroundColor: "#0A0A0C" }, headerTintColor: "#F4F4F5" }} />
      <View style={styles.container}>
        <Text style={styles.title}>{isVerified ? "Verified ✓" : "Show this code to your supervisor"}</Text>
        <Text style={styles.subtitle}>
          {isVerified
            ? `Verified at ${new Date(ticket.verifiedAt).toLocaleString()}`
            : `Load #${ticket.loadNumber}${expiryLabel ? ` • Code valid until ${expiryLabel}` : ""}`}
        </Text>

        <View style={[styles.qrFrame, isVerified && styles.qrFrameVerified]}>
          <View style={styles.qrInner}>
            {isVerified ? (
              <View style={styles.qrWebFallback}>
                <Feather name="check-circle" size={120} color="#5fb878" />
              </View>
            ) : Platform.OS === "web" ? (
              <View style={styles.qrWebFallback}>
                <Feather name="grid" size={120} color="#0A0A0C" />
                <Text style={styles.qrWebFallbackText}>QR Preview</Text>
              </View>
            ) : token ? (
              <QRCode value={token} size={240} backgroundColor="#ffffff" color="#0A0A0C" />
            ) : (
              <View style={styles.qrWebFallback}>
                <ActivityIndicator color="#0A0A0C" />
              </View>
            )}
          </View>
          {isVerified && (
            <View style={styles.verifiedBadge}>
              <Feather name="check" size={20} color="#fff" />
            </View>
          )}
        </View>

        {error ? (
          <View style={styles.tokenBox}>
            <Text style={[styles.tokenText, { color: "#ff8a8a" }]}>{error}</Text>
          </View>
        ) : !isVerified && token ? (
          <View style={styles.tokenBox}>
            <Text style={styles.tokenLabel}>VERIFICATION TOKEN</Text>
            <Text style={styles.tokenText} selectable numberOfLines={2}>{token}</Text>
          </View>
        ) : null}

        {!isVerified && (
          <View style={styles.actions}>
            <Pressable style={styles.actionBtn} onPress={handleShare} disabled={!token}>
              <Feather name="share-2" size={16} color="#FFFFFF" />
              <Text style={styles.actionText}>Share</Text>
            </Pressable>
            <Pressable style={styles.actionBtnGhost} onPress={handleRegenerate} disabled={issueQR.isPending}>
              <Feather name="refresh-cw" size={16} color="#FF5500" />
              <Text style={styles.actionGhostText}>{issueQR.isPending ? "Issuing…" : "New Code"}</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.hint}>
          {Platform.OS === "web"
            ? "Real QR code renders on the iOS / Android app. Use the verification token above to test scanning from the supervisor screen."
            : "Supervisor scans this code from their Scan Ticket screen. Codes expire after 15 minutes — tap New Code to refresh."}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0A0A0C" },
  container: { flex: 1, padding: 24, alignItems: "center" },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#F4F4F5", textAlign: "center", marginTop: 8 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#8B8B96", textAlign: "center", marginTop: 6, marginBottom: 24 },
  qrFrame: {
    padding: 16, backgroundColor: "#fff", borderRadius: 20,
    borderWidth: 3, borderColor: "#FF5500", marginBottom: 20,
    position: "relative",
  },
  qrFrameVerified: { borderColor: "#5fb878" },
  qrInner: { padding: 4 },
  qrWebFallback: { width: 240, height: 240, alignItems: "center", justifyContent: "center", gap: 8 },
  qrWebFallbackText: { fontFamily: "Inter_600SemiBold", color: "#0A0A0C", fontSize: 12 },
  verifiedBadge: {
    position: "absolute", top: -10, right: -10, width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#5fb878", alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "#0A0A0C",
  },
  tokenBox: { backgroundColor: "#141416", borderRadius: 10, padding: 12, marginBottom: 20, width: "100%", borderWidth: 1, borderColor: "#27272A" },
  tokenLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#8B8B96", letterSpacing: 1, marginBottom: 4 },
  tokenText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#FF5500" },
  actions: { flexDirection: "row", gap: 10, width: "100%" },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#FF5500", height: 44, borderRadius: 10 },
  actionText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 14 },
  actionBtnGhost: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1.5, borderColor: "#FF550055", height: 44, borderRadius: 10 },
  actionGhostText: { color: "#FF5500", fontFamily: "Inter_700Bold", fontSize: 14 },
  hint: { marginTop: 18, fontSize: 12, color: "#8B8B96", textAlign: "center", lineHeight: 18 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { color: "#F4F4F5", fontFamily: "Inter_600SemiBold", fontSize: 15 },
  backBtn: { backgroundColor: "#141416", paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10 },
  backText: { color: "#F4F4F5", fontFamily: "Inter_600SemiBold" },
});
