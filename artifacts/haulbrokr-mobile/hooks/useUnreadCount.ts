import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";

import { useLiveActivity } from "@/hooks/useLiveApi";
import type { LiveActivity } from "@/lib/liveJob";

const LAST_READ_KEY = "notif:lastReadAt";

/**
 * Derives the unread-notification count from the live activity feed and the
 * locally persisted "last read" timestamp (shared with the notifications
 * screen). Refreshes the stored timestamp whenever the consuming screen
 * regains focus so badges clear after the user opens notifications.
 */
export function useUnreadCount(): number {
  const { data } = useLiveActivity();
  const [lastReadAt, setLastReadAt] = React.useState<number>(0);

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      AsyncStorage.getItem(LAST_READ_KEY).then((v) => {
        if (active && v) setLastReadAt(Number(v) || 0);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  return React.useMemo(() => {
    const rows = (data ?? []) as LiveActivity[];
    return rows.reduce((count, a) => {
      const created = new Date(a.createdAt).getTime();
      return created > lastReadAt ? count + 1 : count;
    }, 0);
  }, [data, lastReadAt]);
}
