import { Text, type StyleProp, type TextStyle } from 'react-native';

import { stitchHarvestFormStyles } from '@/components/owner/stitch-harvest-form-styles';

/** Màu dấu * bắt buộc — tách khỏi màu chữ label */
const REQUIRED_MARK_COLOR = '#c62828';

function RequiredMark() {
  return (
    <Text style={{ color: REQUIRED_MARK_COLOR, fontWeight: '700' }} accessibilityLabel="bắt buộc">
      {' *'}
    </Text>
  );
}

/** Label trường form (font `fieldLabel`). Chỉ hiện * đỏ khi `required`. */
export function FormFieldLabel({
  children,
  required,
  style,
}: {
  children: React.ReactNode;
  required?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text style={[stitchHarvestFormStyles.fieldLabel, style]}>
      {children}
      {required ? <RequiredMark /> : null}
    </Text>
  );
}

/** Tiêu đề block kiểu `sectionEyebrow`. Chỉ hiện * đỏ khi `required`. */
export function FormSectionLabel({
  children,
  required,
  style,
}: {
  children: React.ReactNode;
  required?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text style={[stitchHarvestFormStyles.sectionEyebrow, style]}>
      {children}
      {required ? <RequiredMark /> : null}
    </Text>
  );
}
