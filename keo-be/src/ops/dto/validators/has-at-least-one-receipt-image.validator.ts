import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

type ReceiptImagePayload = {
  imageUrls?: string[];
  imageFileIds?: string[];
  receiptImageUrl?: string;
};

@ValidatorConstraint({ name: 'hasAtLeastOneReceiptImage', async: false })
export class HasAtLeastOneReceiptImageConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const o = args.object as ReceiptImagePayload;
    const urlCount =
      (o.imageUrls?.filter((u) => u?.trim()).length ?? 0) +
      (o.receiptImageUrl?.trim() ? 1 : 0);
    const fileCount = o.imageFileIds?.filter(Boolean).length ?? 0;
    return urlCount + fileCount >= 1;
  }

  defaultMessage(): string {
    return 'atLeastOneReceiptImage';
  }
}
