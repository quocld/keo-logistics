import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ownerStitchListStyles as os } from '@/components/owner/owner-stitch-list-styles';
import { Brand } from '@/constants/brand';

const S = Brand.stitch;

type Props = {
  badgeText: string | null;
  onPress: () => void;
};

export function NotificationBellButton({ badgeText, onPress }: Props) {
  const showBadge = badgeText != null && badgeText !== '';
  const accessibilityLabel = showBadge
    ? `Thông báo, ${badgeText.includes('+') ? 'hơn ' : ''}${badgeText.replace('+', '')} chưa đọc`
    : 'Thông báo';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [os.iconBtn, pressed && os.iconBtnPressed]}
      hitSlop={8}
      accessibilityLabel={accessibilityLabel}>
      <View style={styles.iconWrap}>
        <MaterialIcons name="notifications-none" size={24} color={S.onSurfaceVariant} />
        {showBadge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {badgeText}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: '#c62828',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
});
