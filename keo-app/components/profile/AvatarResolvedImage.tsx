import { Image } from 'expo-image';
import type { StyleProp, ImageStyle } from 'react-native';

import type { ResolvedAvatarDisplay } from '@/lib/avatar/resolve-display';

type Props = {
  display: ResolvedAvatarDisplay;
  style: StyleProp<ImageStyle>;
  /** @default 'cover' */
  contentFit?: 'cover' | 'contain';
};

/** Render ảnh từ `resolveAvatarDisplay` / `resolveDriverLocationAvatar`. */
export function AvatarResolvedImage({ display, style, contentFit = 'cover' }: Props) {
  if (display.kind === 'remote') {
    return <Image source={{ uri: display.uri }} style={style} contentFit={contentFit} />;
  }
  return <Image source={display.source} style={style} contentFit={contentFit} />;
}
