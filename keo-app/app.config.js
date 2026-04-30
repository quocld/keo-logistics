/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Dynamic Expo config: Google Maps native keys from env (EAS secret or .env.local).
 * Static fields live in app.base.json (we avoid app.json to satisfy Expo Doctor checks).
 */
const appJson = require('./app.base.json');

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? '';
const easProfile = (process.env.EAS_BUILD_PROFILE || '').trim();

// Fail fast for release-like builds: a missing key produces a blank/grey Google Map on Android.
if (!googleMapsApiKey) {
  const isReleaseLike = easProfile === 'preview' || easProfile === 'production';
  if (isReleaseLike) {
    throw new Error(
      [
        'Missing GOOGLE_MAPS_API_KEY for EAS build profile:',
        easProfile,
        '',
        'Set it via EAS secret (recommended):',
        '  eas secret:create --name GOOGLE_MAPS_API_KEY --value <YOUR_KEY>',
        '',
        'Or export it in the shell for local builds.',
      ].join('\n'),
    );
  }
}

/** Expo Push / EAS: cần để `getExpoPushTokenAsync` chạy. Lấy từ expo.dev → Project settings → Project ID, hoặc sau `eas init`. */
const easProjectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || process.env.EAS_PROJECT_ID?.trim() || '';

/** Phải có trong Info.plist của app native (không chỉ Expo Go). Trùng app.json + plugin expo-location. */
const IOS_LOCATION = {
  NSLocationWhenInUseUsageDescription:
    'KeoTram cần vị trí khi bạn chọn điểm trên bản đồ, đặt trạm cân / khu khai thác, hoặc theo dõi chuyến xe.',
  NSLocationAlwaysAndWhenInUseUsageDescription:
    'KeoTram cần vị trí nền để chủ vườn theo dõi chuyến khi bạn không mở app.',
  NSLocationAlwaysUsageDescription:
    'KeoTram cần vị trí nền để chủ vườn theo dõi chuyến khi bạn không mở app.',
};

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra ?? {}),
      googleMapsApiKeyConfigured: Boolean(googleMapsApiKey),
      eas: {
        ...(appJson.expo.extra?.eas ?? {}),
        ...(easProjectId ? { projectId: easProjectId } : {}),
      },
    },
    ios: {
      ...appJson.expo.ios,
      bundleIdentifier: 'com.keo.app',
      infoPlist: {
        ...(appJson.expo.ios?.infoPlist ?? {}),
        ...IOS_LOCATION,
      },
      config: {
        ...(appJson.expo.ios?.config ?? {}),
        googleMapsApiKey,
      },
    },
    android: {
      ...appJson.expo.android,
      package: 'com.keo.app',
      config: {
        ...(appJson.expo.android?.config ?? {}),
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
  },
};
