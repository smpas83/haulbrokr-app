const appJson = require("./app.json");

const googleMapsApiKey =
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

const config = {
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    clerkPublishableKey,
    expoPublicDomain: process.env.EXPO_PUBLIC_DOMAIN ?? "haulbrokr.com",
  },
};

if (googleMapsApiKey) {
  config.android = {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        ...config.android?.config?.googleMaps,
        apiKey: googleMapsApiKey,
      },
    },
  };
}

module.exports = config;
