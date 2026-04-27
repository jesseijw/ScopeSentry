export default {
  expo: {
    name: "ScopeSentry",
    slug: "scopesentry",
    version: "1.0.0",
    platforms: ["ios"],
    ios: {
      bundleIdentifier: "com.scopesentry.app",
      supportsTablet: false,
    },
    scheme: "scopesentry",
    plugins: [
      "expo-secure-store",
      "expo-notifications",
    ],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001",
    },
  },
}
