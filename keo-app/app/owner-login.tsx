import { Redirect } from 'expo-router';

export default function LegacyOwnerLoginScreen() {
  return <Redirect href="/(auth)/login" />;
}
