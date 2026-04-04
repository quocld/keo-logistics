import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { ReceiptSubmitForm } from '@/components/receipt/ReceiptSubmitForm';
import { useAuth } from '@/contexts/auth-context';

export default function ReceiptFormScreen() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user && user.role !== 'owner') {
      Alert.alert('Không khả dụng', 'Chỉ chủ vườn (owner) dùng màn tạo phiếu này. Tài xế dùng Gửi phiếu cân trên trang chủ.');
      router.back();
    }
  }, [user, router]);

  return <ReceiptSubmitForm variant="owner" />;
}
