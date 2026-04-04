import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormFieldLabel } from '@/components/forms/FormFieldLabel';
import { Brand } from '@/constants/brand';
import { formatIsoDateVi, parseIsoDateToLocal, toIsoDateString } from '@/lib/date/iso-date';

const S = Brand.stitch;

export type FormDatePickerFieldProps = {
  label: string;
  required?: boolean;
  /** `YYYY-MM-DD` or empty */
  value: string;
  onChangeValue: (iso: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Show "Xoá" when there is a value */
  allowClear?: boolean;
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

export function FormDatePickerField({
  label,
  required,
  value,
  onChangeValue,
  placeholder = 'Chọn ngày',
  minimumDate,
  maximumDate,
  allowClear = true,
}: FormDatePickerFieldProps) {
  const insets = useSafeAreaInsets();
  const [androidOpen, setAndroidOpen] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(() => parseIsoDateToLocal(value) ?? startOfToday());

  const displayText = useMemo(() => {
    if (!value.trim()) return '';
    return formatIsoDateVi(value) || value.trim();
  }, [value]);

  const resolvedPickerValue = useMemo(
    () => parseIsoDateToLocal(value) ?? startOfToday(),
    [value],
  );

  const openPicker = useCallback(() => {
    if (Platform.OS === 'ios') {
      setIosDraft(parseIsoDateToLocal(value) ?? startOfToday());
      setIosOpen(true);
    } else if (Platform.OS === 'android') {
      setAndroidOpen(true);
    }
  }, [value]);

  const onAndroidChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      setAndroidOpen(false);
      if (event.type === 'set' && date) {
        onChangeValue(toIsoDateString(date));
      }
    },
    [onChangeValue],
  );

  const confirmIos = useCallback(() => {
    onChangeValue(toIsoDateString(iosDraft));
    setIosOpen(false);
  }, [iosDraft, onChangeValue]);

  const cancelIos = useCallback(() => {
    setIosOpen(false);
  }, []);

  const clearDate = useCallback(() => {
    onChangeValue('');
  }, [onChangeValue]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrap}>
        <FormFieldLabel required={required}>{label}</FormFieldLabel>
        <TextInput
          value={value}
          onChangeText={onChangeValue}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={`${S.outline}80`}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.webInput}
        />
        <Text style={styles.webHint}>Trên web nhập đúng định dạng YYYY-MM-DD (ví dụ 2026-03-29).</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <FormFieldLabel required={required}>{label}</FormFieldLabel>
      <Pressable
        onPress={openPicker}
        style={({ pressed }) => [styles.fieldRow, pressed && styles.fieldRowPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${displayText || placeholder}`}>
        <MaterialIcons name="calendar-today" size={20} color={`${S.outline}99`} />
        <Text
          style={[styles.fieldValue, !value.trim() && styles.fieldPlaceholder]}
          numberOfLines={1}>
          {value.trim() ? displayText : placeholder}
        </Text>
        <MaterialIcons name="chevron-right" size={22} color={S.outline} />
      </Pressable>
      {allowClear && value.trim() ? (
        <Pressable onPress={clearDate} hitSlop={8} style={styles.clearBtn}>
          <Text style={styles.clearBtnText}>Xoá ngày</Text>
        </Pressable>
      ) : null}

      {Platform.OS === 'android' && androidOpen ? (
        <DateTimePicker
          value={resolvedPickerValue}
          mode="date"
          display="default"
          onChange={onAndroidChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={iosOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={cancelIos}>
          <View style={[styles.iosSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.iosToolbar}>
              <Pressable onPress={cancelIos} hitSlop={12}>
                <Text style={styles.iosToolbarBtn}>Huỷ</Text>
              </Pressable>
              <Text style={styles.iosToolbarTitle} numberOfLines={1}>
                {label}
              </Text>
              <Pressable onPress={confirmIos} hitSlop={12}>
                <Text style={[styles.iosToolbarBtn, styles.iosToolbarDone]}>Xong</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={iosDraft}
              mode="date"
              display="spinner"
              onChange={(_: DateTimePickerEvent, date?: Date) => {
                if (date) setIosDraft(date);
              }}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 4,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: S.surfaceContainerLow,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: `${S.outlineVariant}99`,
  },
  fieldRowPressed: {
    opacity: 0.92,
  },
  fieldValue: {
    flex: 1,
    fontSize: 16,
    color: Brand.ink,
  },
  fieldPlaceholder: {
    color: `${S.outline}aa`,
  },
  clearBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 4,
  },
  clearBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: S.primary,
  },
  iosSheet: {
    flex: 1,
    backgroundColor: Brand.surface,
    paddingTop: 8,
  },
  iosToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: S.outlineVariant,
  },
  iosToolbarBtn: {
    fontSize: 16,
    color: S.onSurfaceVariant,
    minWidth: 52,
  },
  iosToolbarDone: {
    color: S.primary,
    fontWeight: '700',
    textAlign: 'right',
  },
  iosToolbarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: Brand.ink,
    paddingHorizontal: 8,
  },
  webInput: {
    backgroundColor: S.surfaceContainerLow,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Brand.ink,
    borderWidth: 1,
    borderColor: `${S.outlineVariant}99`,
  },
  webHint: {
    marginTop: 6,
    fontSize: 12,
    color: `${S.outline}b3`,
    lineHeight: 16,
  },
});
