import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useLiveActivity } from "@/hooks/useLiveApi";
import { useColors } from "@/hooks/useColors";
import {
  liveActivityToView,
  type ActivityView,
  type LiveActivity,
} from "@/lib/liveJob";

const LAST_READ_KEY = "notif:lastReadAt";

const CAT_COLOR: Record<ActivityView["type"], string> = {
  bid: "#e9a600",
  job: "#16a34a",
  bin: "#8b5cf6",
  payment: "#0891b2",
  alert: "#ef4444",
};

type NotifItem = ActivityView & {
  createdAt: string;
  relatedId: number | null;
  read: boolean;
};

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data, isLoading, isFetching, refetch } = useLiveActivity();
  const [lastReadAt, setLastReadAt] = React.useState<number>(0);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    AsyncStorage.getItem(LAST_READ_KEY).then((v) => {
      if (v) setLastReadAt(Number(v) || 0);
    });
  }, []);

  const items: NotifItem[] = React.useMemo(() => {
    const rows = (data ?? []) as LiveActivity[];
    return rows.map((a) => {
      const view = liveActivityToView(a);
      const created = new Date(a.createdAt).getTime();
      return {
        ...view,
        createdAt:
          typeof a.createdAt === "string"
            ? a.createdAt
            : a.createdAt.toISOString(),
        relatedId: a.relatedId ?? null,
        read: created <= lastReadAt,
      };
    });
  }, [data, lastReadAt]);

  const unread = items.filter((n) => !n.read).length;

  const markAllRead = async () => {
    const now = Date.now();
    setLastReadAt(now);
    await AsyncStorage.setItem(LAST_READ_KEY, String(now));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const openItem = (n: NotifItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (n.binOrderId) router.push(`/bin/${n.binOrderId}`);
    else if (n.relatedId) router.push(`/job/${n.relatedId}`);
  };

  const grouped: { label: string; items: NotifItem[] }[] = [
    { label: "New", items: items.filter((n) => !n.read) },
    { label: "Earlier", items: items.filter((n) => n.read) },
  ].filter((g) => g.items.length > 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            paddingTop: topPad + 12,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.backBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.title,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            Notifications
          </Text>
          {unread > 0 && (
            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {unread} unread
            </Text>
          )}
        </View>
        {unread > 0 && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              markAllRead();
            }}
          >
            <Text
              style={[
                styles.markAll,
                { color: colors.primary, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              Mark all read
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 40 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading && (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {!isLoading && isFetching && !refreshing && (
          <View
            style={[
              styles.refreshPill,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <ActivityIndicator size="small" color={colors.mutedForeground} />
            <Text
              style={[
                styles.refreshPillText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              Updating…
            </Text>
          </View>
        )}

        {grouped.map((group, gi) => (
          <Animated.View
            key={group.label}
            entering={FadeInDown.delay(gi * 60).springify()}
          >
            <Text
              style={[
                styles.groupLabel,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              {group.label.toUpperCase()}
            </Text>
            <View
              style={[
                styles.groupCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {group.items.map((notif, idx) => {
                const ic = CAT_COLOR[notif.type];
                const tappable = !!notif.binOrderId || !!notif.relatedId;
                return (
                  <View key={notif.id}>
                    <Pressable
                      onPress={() => openItem(notif)}
                      disabled={!tappable}
                      style={[
                        styles.notifRow,
                        {
                          backgroundColor: notif.read
                            ? "transparent"
                            : ic + "08",
                        },
                      ]}
                    >
                      {!notif.read && (
                        <View
                          style={[styles.unreadDot, { backgroundColor: ic }]}
                        />
                      )}
                      {notif.read && (
                        <View style={styles.unreadDotPlaceholder} />
                      )}

                      <View
                        style={[
                          styles.notifIcon,
                          { backgroundColor: ic + "18" },
                        ]}
                      >
                        <Feather
                          name={notif.icon as any}
                          size={16}
                          color={ic}
                        />
                      </View>

                      <View style={{ flex: 1, gap: 3 }}>
                        <Text
                          style={[
                            styles.notifTitle,
                            {
                              color: notif.read
                                ? colors.mutedForeground
                                : colors.foreground,
                              fontFamily: notif.read
                                ? "Inter_400Regular"
                                : "Inter_600SemiBold",
                            },
                          ]}
                        >
                          {notif.text}
                        </Text>
                        <View style={styles.notifMeta}>
                          <Text
                            style={[
                              styles.notifTime,
                              {
                                color: colors.mutedForeground,
                                fontFamily: "Inter_400Regular",
                              },
                            ]}
                          >
                            {notif.time}
                          </Text>
                          {tappable && (
                            <Text
                              style={[
                                styles.notifLink,
                                { color: ic, fontFamily: "Inter_500Medium" },
                              ]}
                            >
                              {notif.binOrderId ? "View Order →" : "View Job →"}
                            </Text>
                          )}
                        </View>
                      </View>
                    </Pressable>
                    {idx < group.items.length - 1 && (
                      <View
                        style={[
                          styles.divider,
                          { backgroundColor: colors.border },
                        ]}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          </Animated.View>
        ))}

        {!isLoading && items.length === 0 && (
          <View style={styles.empty}>
            <Feather name="bell-off" size={48} color={colors.border} />
            <Text
              style={[
                styles.emptyText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              No notifications yet
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 10,
  },
  title: { fontSize: 20 },
  subtitle: { fontSize: 13, marginTop: 1 },
  markAll: { fontSize: 13 },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 8 },
  refreshPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 999,
    marginBottom: 4,
  },
  refreshPillText: { fontSize: 12 },
  groupLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 4,
  },
  groupCard: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    paddingLeft: 10,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    flexShrink: 0,
  },
  unreadDotPlaceholder: { width: 8, flexShrink: 0 },
  notifIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  notifTitle: { fontSize: 14, lineHeight: 18 },
  notifBody: { fontSize: 13, lineHeight: 18 },
  notifMeta: { flexDirection: "row", alignItems: "center", gap: 12 },
  notifTime: { fontSize: 11 },
  notifLink: { fontSize: 11 },
  divider: { height: 1, marginHorizontal: 14 },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingTop: 80,
  },
  emptyText: { fontSize: 15 },
});
