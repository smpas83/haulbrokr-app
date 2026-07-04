import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const stub = (p: string) => path.resolve(root, "test/stubs", p);

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${root}/` },
      { find: "@expo/vector-icons", replacement: stub("vectorIcons.tsx") },
      { find: "expo-haptics", replacement: stub("expoHaptics.ts") },
      { find: "expo-router", replacement: stub("expoRouter.ts") },
      { find: "react-native-reanimated", replacement: stub("reanimated.tsx") },
      {
        find: "react-native-safe-area-context",
        replacement: stub("safeArea.ts"),
      },
      { find: "@clerk/expo", replacement: stub("clerkExpo.ts") },
      { find: /^expo$/, replacement: stub("expo.ts") },
      { find: "react-native", replacement: "react-native-web" },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["test/**/*.test.tsx", "test/**/*.test.ts"],
    env: { EXPO_PUBLIC_DOMAIN: "test.local" },
    setupFiles: ["test/setup.ts"],
    globalSetup: ["test/global-port-guard.ts"],
  },
});
