import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router, Stack } from "expo-router";
import React from "react";
import {
  ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { useApp, type Role } from "@/context/AppContext";
import { useMyOrganization, useOrgMembers, useRotateInviteCode } from "@/hooks/useLiveApi";

const ROLE_LABEL: Record<string, string> = {
  customer: "Owner", provider: "Owner", driver: "Driver", supervisor: "Supervisor",
};
const ROLE_COLOR: Record<string, string> = {
  customer: "#3B82F6", provider: "#3B82F6", driver: "#5fb878", supervisor: "#6aa9ff",
};

function formatJoined(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function TeamScreen() {
  const { isSignedIn } = useAuth();
  const { profile, team: localTeam, rotateInviteCode: rotateLocal } = useApp();
  const isOwner = profile.role === "customer" || profile.role === "provider";

  const orgQ = useMyOrganization();
  const membersQ = useOrgMembers();
  const rotateMut = useRotateInviteCode();

  const liveOrg = orgQ.data;
  const liveMembers = (membersQ.data as { members?: Array<{ id: number; role: Role; contactName?: string | null; companyName: string; phone?: string | null; createdAt: string }> } | undefined)?.members;

  // Signed-in users never fall back to demo team data.
  const usingLive = !!isSignedIn;
  const inviteCode = usingLive
    ? (orgQ.isLoading && !liveOrg ? "······" : (liveOrg?.inviteCode ?? "—"))
    : (profile.orgInviteCode ?? "—");

  const members = usingLive
    ? (liveMembers ?? [])
        .filter((m) => m.role !== "customer" && m.role !== "provider")
        .map((m) => ({
          id: String(m.id),
          name: m.contactName?.trim() || m.companyName || `Member ${m.id}`,
          role: m.role as Role,
          phone: m.phone ?? undefined,
          joinedAt: formatJoined(m.createdAt),
          active: true,
        }))
    : localTeam;

  const memberType = profile.role === "provider" ? "drivers" : "supervisors";
  const memberTypeCap = memberType.charAt(0).toUpperCase() + memberType.slice(1);
  const activeCount = members.filter((m) => m.active).length;

  const copyCode = async () => {
    await Clipboard.setStringAsync(inviteCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied", `Invite code ${inviteCode} copied to clipboard.`);
  };
  const shareCode = async () => {
    try {
      await Share.share({
        message: `Join my HaulBrokr team with code: ${inviteCode}\n\nDownload the app, choose ${profile.role === "provider" ? "Driver" : "Supervisor"} during signup, and enter this code.`,
      });
    } catch {}
  };

  const handleRotate = () => {
    Alert.alert(
      "Rotate invite code?",
      "The old code will stop working. People who already joined keep access.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Rotate",
          style: "destructive",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (usingLive) {
              try {
                await rotateMut.mutateAsync();
              } catch (err: any) {
                Alert.alert("Couldn't rotate", err?.message ?? "Try again in a moment.");
              }
            } else {
              rotateLocal();
            }
          },
        },
      ],
    );
  };

  if (!isOwner) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: "My Team", headerStyle: { backgroundColor: "#0A0A0C" }, headerTintColor: "#F4F4F5" }} />
        <View style={styles.emptyWrap}>
          <Feather name="users" size={48} color="#4a5568" />
          <Text style={styles.emptyTitle}>You're a {ROLE_LABEL[profile.role]}</Text>
          <Text style={styles.emptyBody}>
            Team management is available to the company owner. Ask your manager if you need to invite someone.
          </Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isLoading = orgQ.isLoading || membersQ.isLoading;

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: "My Team", headerStyle: { backgroundColor: "#0A0A0C" }, headerTintColor: "#F4F4F5" }} />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Invite code card */}
        <View style={styles.inviteCard}>
          <View style={styles.sourceRow}>
            <Text style={styles.inviteLabel}>YOUR TEAM INVITE CODE</Text>
            <View style={[styles.sourcePill, { backgroundColor: usingLive ? "#5fb87822" : "#8B8B9622", borderColor: usingLive ? "#5fb87866" : "#8B8B9666" }]}>
              <View style={[styles.sourceDot, { backgroundColor: usingLive ? "#5fb878" : "#8B8B96" }]} />
              <Text style={[styles.sourcePillText, { color: usingLive ? "#5fb878" : "#8B8B96" }]}>
                {usingLive ? "Live" : isLoading ? "Loading…" : "Demo"}
              </Text>
            </View>
          </View>
          <Text style={styles.inviteCode}>
            {isLoading && !liveOrg ? "······" : inviteCode}
          </Text>
          <Text style={styles.inviteHint}>
            Share this with {memberType} you want to invite. They enter it during signup.
          </Text>
          <View style={styles.inviteActions}>
            <Pressable style={styles.actionBtn} onPress={copyCode}>
              <Feather name="copy" size={16} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Copy</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={shareCode}>
              <Feather name="share-2" size={16} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Share</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtnGhost, rotateMut.isPending && { opacity: 0.6 }]}
              onPress={handleRotate}
              disabled={rotateMut.isPending}
            >
              {rotateMut.isPending ? (
                <ActivityIndicator size="small" color="#3B82F6" />
              ) : (
                <>
                  <Feather name="refresh-cw" size={16} color="#3B82F6" />
                  <Text style={styles.actionBtnGhostText}>Rotate</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {/* Member stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{members.length}</Text>
            <Text style={styles.statLabel}>Total {memberTypeCap}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: "#5fb878" }]}>{activeCount}</Text>
            <Text style={styles.statLabel}>Active Now</Text>
          </View>
        </View>

        {/* Members list */}
        <Text style={styles.sectionLabel}>{memberTypeCap.toUpperCase()}</Text>
        {isLoading && !liveMembers ? (
          <View style={styles.emptyList}><ActivityIndicator color="#8B8B96" /></View>
        ) : members.length === 0 ? (
          <View style={styles.emptyList}>
            <Feather name="user-plus" size={32} color="#4a5568" />
            <Text style={styles.emptyListText}>No {memberType} yet</Text>
            <Text style={styles.emptyListSub}>Share your code above to invite them.</Text>
          </View>
        ) : (
          members.map((m) => (
            <View key={m.id} style={styles.memberCard}>
              <View style={[styles.avatar, { backgroundColor: `${ROLE_COLOR[m.role]}22`, borderColor: `${ROLE_COLOR[m.role]}66` }]}>
                <Text style={[styles.avatarText, { color: ROLE_COLOR[m.role] }]}>
                  {(m.name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.memberHeader}>
                  <Text style={styles.memberName}>{m.name}</Text>
                  <View style={[styles.statusDot, { backgroundColor: m.active ? "#5fb878" : "#6b7280" }]} />
                </View>
                <Text style={styles.memberMeta}>
                  {ROLE_LABEL[m.role]} • Joined {m.joinedAt}
                </Text>
                {m.phone && <Text style={styles.memberPhone}>{m.phone}</Text>}
              </View>
            </View>
          ))
        )}

        {!usingLive && !isLoading && (
          <Text style={styles.footnote}>
            Showing demo data — sign in to see your real team and live invite code.
          </Text>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0A0A0C" },
  container: { padding: 20, paddingBottom: 40 },
  inviteCard: {
    backgroundColor: "#141416", borderRadius: 16, padding: 20,
    borderWidth: 1.5, borderColor: "#3B82F630", marginBottom: 20,
  },
  sourceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  sourcePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  sourceDot: { width: 6, height: 6, borderRadius: 3 },
  sourcePillText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  inviteLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#8B8B96", letterSpacing: 1 },
  inviteCode: {
    fontSize: 36, fontFamily: "Inter_700Bold", color: "#3B82F6",
    letterSpacing: 3, textAlign: "center", marginVertical: 8,
  },
  inviteHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#8B8B96", textAlign: "center", marginBottom: 14 },
  inviteActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: "#3B82F6", height: 40, borderRadius: 10,
  },
  actionBtnText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 13 },
  actionBtnGhost: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, borderWidth: 1.5, borderColor: "#3B82F655", height: 40, borderRadius: 10,
  },
  actionBtnGhostText: { color: "#3B82F6", fontFamily: "Inter_700Bold", fontSize: 13 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: "#141416", borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "#27272A", alignItems: "center",
  },
  statValue: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#F4F4F5" },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#8B8B96", marginTop: 4 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#8B8B96", letterSpacing: 1, marginBottom: 12 },
  memberCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#141416",
    borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#27272A", gap: 12,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5,
  },
  avatarText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  memberHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  memberName: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#F4F4F5" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  memberMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#8B8B96", marginTop: 2 },
  memberPhone: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#8B8B96", marginTop: 1 },
  emptyList: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyListText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#8B8B96" },
  emptyListSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6b7280" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#F4F4F5", marginTop: 8 },
  emptyBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#8B8B96", textAlign: "center", lineHeight: 19 },
  backBtn: { marginTop: 16, backgroundColor: "#141416", paddingVertical: 12, paddingHorizontal: 28, borderRadius: 10 },
  backBtnText: { color: "#F4F4F5", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  footnote: { marginTop: 16, fontSize: 11, color: "#6b7280", textAlign: "center", fontFamily: "Inter_400Regular" },
});
