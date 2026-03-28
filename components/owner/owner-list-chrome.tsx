import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';

type Props = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
};

export function OwnerListChrome({ title, subtitle, children }: Props) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 12,
    backgroundColor: Brand.canvas,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.metallic,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Brand.ink,
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: Brand.inkMuted,
    lineHeight: 20,
  },
});
