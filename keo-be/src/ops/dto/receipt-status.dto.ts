import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { ReceiptStatusEnum } from '../domain/receipt-status.enum';

export class ReceiptStatusDto {
  @Allow()
  @ApiProperty({
    enum: ReceiptStatusEnum,
    example: ReceiptStatusEnum.pending,
  })
  status: ReceiptStatusEnum;
}
