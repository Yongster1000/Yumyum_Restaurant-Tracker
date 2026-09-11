import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Yumyums',
  slug: 'yumyums',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'yumyums',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: 'com.yumyums.app',
    config: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY,
    },
  },
  android: {
    package: 'com.yumyums.app',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
      },
    },
  },
  web: {
    // 'single' (plain SPA) instead of the template default 'static': this is
    // an auth-gated app, not a static site, and static export tries to
    // server-render routes in Node where `window` (needed by the Supabase
    // client) doesn't exist.
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-image-picker',
    'expo-font',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#f5ead8',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  owner: 'yongster1000',
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: {
    url: 'https://u.expo.dev/765ba74b-e204-426f-924d-c09cf8517b51',
  },
  extra: {
    eas: {
      projectId: '765ba74b-e204-426f-924d-c09cf8517b51',
    },
  },
};

export default config;
