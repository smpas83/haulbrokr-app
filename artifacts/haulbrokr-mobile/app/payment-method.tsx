import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import React, { useCallback } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { usePaymentMethod } from "@/hooks/useLiveApi";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "localhost:8080";
const PAYMENT_URL = `https://${DOMAIN}/mobile-payment`;

export default function PaymentMethodScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const pmQuery = usePaymentMethod();

  const openCardSetup = useCallback(async () => {
    try {
      const returnTo = Linking.createURL("payment-return");
      await WebBrowser.openAuthSessionAsync(PAYMENT_URL, returnTo);
      pmQuery.refetch();
    } catch (err: any) {
      Alert.alert("Could not open card setup", err?.message ?? "Please try again.");
    }
  }, [pmQuery]);

  const pm = pmQuery.data as { cardBrand?: string; cardLast4?: string; methodType?: string } | null | undefined;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border, paddingTop: topPad + 12 }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Payment Method</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {pmQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : pm?.cardLast4 ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="credit-card" size={24} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 16 }}>
                {pm.cardBrand ?? "Card"} ··· {pm.cardLast4}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 4 }}>
                Saved for job payments
              </Text>
            </View>
          </View>
        ) : (
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 }}>
            Add a card to pay for completed jobs. You can also pay per job via Stripe Checkout without saving a card.
          </Text>
        )}

        <Pressable
          onPress={openCardSetup}
          style={[styles.btn, { backgroundColor: colors.primary }]}
        >
          <Feather name="external-link" size={16} color={colors.primaryForeground} />
          <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
            {pm?.cardLast4 ? "Update card" : "Add card securely"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 10 },
  title: { fontSize: 18 },
  content: { padding: 20, gap: 16 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderWidth: 1, borderRadius: 12 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10 },
});
