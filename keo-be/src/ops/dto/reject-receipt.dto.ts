import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectReceiptDto {
  @ApiProperty({ example: 'Receipt is invalid' })
  @IsString()
  @IsNotEmpty()
  rejectedReason: string;
}
