import { memo, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { AvatarResolvedImage } from '@/components/profile/AvatarResolvedImage';
import type { DriverFreshness } from '@/lib/map/pin-styles';
import type { ResolvedAvatarDisplay } from '@/lib/avatar/resolve-display';

const AVATAR = 44;
const RING = 3;

type Props = {
  borderColor: string;
  freshness: DriverFreshness;
  avatarDisplay: ResolvedAvatarDisplay;
};

function PulseRing({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.45,
            duration: 1400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.5, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity, scale]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulseRing,
        {
          borderColor: color,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

/** Marker tài xế: viền theo freshness, pulse khi đang hoạt động, ảnh từ API hoặc avatar mặc định. */
export const DriverTrackingMapMarker = memo(function DriverTrackingMapMarker({
  borderColor,
  freshness,
  avatarDisplay,
}: Props) {
  const isActive = freshness === 'active';
  const dim = freshness === 'offline' ? 0.72 : freshness === 'stale' ? 0.88 : 1;

  return (
    <View style={[styles.wrap, { opacity: dim }]}>
      <View style={styles.stack}>
        {isActive ? <PulseRing color={borderColor} /> : null}
        <View style={[styles.card, { borderColor: borderColor }]}>
          <View style={styles.avatarClip}>
            <AvatarResolvedImage display={avatarDisplay} style={styles.avatarImg} contentFit="cover" />
          </View>
        </View>
      </View>
      <View style={[styles.pinTail, { borderTopColor: borderColor }]} />
    </View>
  );
});

const PULSE_SIZE = 58;

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  stack: {
    position: 'relative',
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    borderRadius: PULSE_SIZE / 2,
    top: '50%',
    left: '50%',
    marginTop: -PULSE_SIZE / 2,
    marginLeft: -PULSE_SIZE / 2,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  card: {
    borderWidth: RING,
    borderRadius: 999,
    padding: 2,
    backgroundColor: 'rgba(255,255,255,0.98)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 6,
  },
  avatarClip: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: 'hidden',
    backgroundColor: '#e8ebe9',
  },
  avatarImg: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
  },
  pinTail: {
    marginTop: -2,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
