import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { ReceiptSubmitForm } from '@/components/receipt/ReceiptSubmitForm';
import { useAuth } from '@/contexts/auth-context';

export default function ReceiptDriverScreen() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user && user.role !== 'driver') {
      Alert.alert('Không khả dụng', 'Chỉ tài xế dùng màn gửi phiếu này.');
      router.back();
    }
  }, [user, router]);

  return <ReceiptSubmitForm variant="driver" />;
}
