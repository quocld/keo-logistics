import Svg, { Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { Brand } from '@/constants/brand';

type KeoTramLogoProps = {
  size?: number;
};

/**
 * Vector mark: stylized dump truck (xe ben), forest → emerald gradient, metallic accents.
 */
export function KeoTramLogo({ size = 112 }: KeoTramLogoProps) {
  const w = size;
  const h = size * 0.72;
  const gid = 'kt-body';
  const mid = 'kt-metallic';

  return (
    <Svg
      width={w}
      height={h}
      viewBox="0 0 120 86"
      accessibilityRole="image"
      accessibilityLabel="KeoTram, logo xe ben logistics">
      <Defs>
        <LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={Brand.forest} />
          <Stop offset="100%" stopColor={Brand.emerald} />
        </LinearGradient>
        <LinearGradient id={mid} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#E8EFEB" />
          <Stop offset="50%" stopColor={Brand.metallic} />
          <Stop offset="100%" stopColor={Brand.metallicDeep} />
        </LinearGradient>
      </Defs>
      {/* Soft ground / depth */}
      <Ellipse cx={60} cy={78} rx={44} ry={5} fill="#1B1C1C" opacity={0.08} />
      {/* Rear wheel */}
      <Ellipse cx={26} cy={68} rx={11} ry={11} fill="#2A3D33" />
      <Ellipse cx={26} cy={68} rx={6} ry={6} fill={Brand.metallicDeep} opacity={0.9} />
      {/* Front wheel */}
      <Ellipse cx={88} cy={68} rx={11} ry={11} fill="#2A3D33" />
      <Ellipse cx={88} cy={68} rx={6} ry={6} fill={Brand.metallicDeep} opacity={0.9} />
      {/* Chassis */}
      <Path
        d="M14 58 L104 58 L104 64 L14 64 Z"
        fill={`url(#${gid})`}
        opacity={0.92}
      />
      {/* Cab */}
      <Path
        d="M72 28 L98 28 L104 58 L72 58 Z"
        fill={`url(#${gid})`}
      />
      <Path
        d="M76 32 L94 32 L98 52 L76 52 Z"
        fill={`url(#${mid})`}
        opacity={0.85}
      />
      {/* Dump bed */}
      <Path
        d="M12 22 L62 14 L70 48 L8 52 Z"
        fill={`url(#${gid})`}
      />
      <Path
        d="M18 26 L56 20 L62 44 L14 48 Z"
        fill="#0F5C30"
        opacity={0.22}
      />
      {/* Bed lip / metallic rail */}
      <Path
        d="M8 50 L70 46 L71 50 L9 54 Z"
        fill={`url(#${mid})`}
        opacity={0.95}
      />
      {/* Wood load hint — horizontal planks */}
      <G opacity={0.35}>
        <Path d="M22 30 L54 24" stroke="#FFFFFF" strokeWidth={1.2} strokeLinecap="round" />
        <Path d="M24 34 L56 28" stroke="#FFFFFF" strokeWidth={1.2} strokeLinecap="round" />
        <Path d="M26 38 L58 32" stroke="#FFFFFF" strokeWidth={1.2} strokeLinecap="round" />
      </G>
    </Svg>
  );
}
