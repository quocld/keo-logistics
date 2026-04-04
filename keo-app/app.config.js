/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Dynamic Expo config: Google Maps native keys from env (EAS secret or .env.local).
 * Static fields live in app.json.
 */
const appJson = require('./app.json');

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? '';

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
