import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useAuth } from "@clerk/expo";
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

async function registerPushToken(
  getToken: () => Promise<string | null>,
  token: string,
  platform: string,
) {
  const authToken = await getToken();
  await fetch(`${API_BASE}/notifications/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ expoPushToken: token, platform }),
  });
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function resolveExpoPushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) return null;

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

/** Register this device for OS push notifications when the user is signed in. */
export function usePushNotifications(enabled: boolean) {
  const { isSignedIn, getToken } = useAuth();

  useEffect(() => {
    if (!enabled || !isSignedIn || Platform.OS === "web") return;

    let cancelled = false;

    (async () => {
      try {
        const token = await resolveExpoPushToken();
        if (!token || cancelled) return;
        await registerPushToken(getToken, token, Platform.OS);
      } catch {
        // Push is best-effort — simulators and missing EAS creds are common in dev.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, isSignedIn, getToken]);
}
