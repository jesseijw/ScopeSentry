export default {
  expo: {
    name: "ScopeSentry",
    slug: "scopesentry",
    version: "1.0.0",
    sdkVersion: "54.0.0",
    platforms: ["ios"],
    ios: {
      bundleIdentifier: "com.scopesentry.app",
      supportsTablet: false,
      usesAppleSignIn: true,
    },
    scheme: "scopesentry",
    plugins: [
      "expo-secure-store",
      "expo-apple-authentication",
    ],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001",
    },
    experiments: {
      newArchEnabled: false,
    },
  },
}
