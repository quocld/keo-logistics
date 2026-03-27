import { ReceiptStatusEnum } from './receipt-status.enum';
import { TripStatusEnum } from './trip-status.enum';

export function isTripStatus(value: unknown): value is TripStatusEnum {
  return Object.values(TripStatusEnum).includes(value as TripStatusEnum);
}

export function isReceiptStatus(value: unknown): value is ReceiptStatusEnum {
  return Object.values(ReceiptStatusEnum).includes(value as ReceiptStatusEnum);
}

export function assertTripStatus(value: unknown): TripStatusEnum {
  if (!isTripStatus(value)) {
    throw new Error(`Invalid trip status: ${String(value)}`);
  }
  return value;
}

export function assertReceiptStatus(value: unknown): ReceiptStatusEnum {
  if (!isReceiptStatus(value)) {
    throw new Error(`Invalid receipt status: ${String(value)}`);
  }
  return value;
}
