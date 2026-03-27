import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitReceiptDto {
  @ApiPropertyOptional({ description: 'Optional: receipt belongs to a trip' })
  @IsOptional()
  @IsUUID()
  tripId?: string;

  @ApiProperty({ example: 'a7c2f2d0-7c2e-4e44-9fd0-1d9f1b8b7a11' })
  @IsUUID()
  harvestAreaId: string;

  @ApiPropertyOptional({ example: 'b6e3b4b5-2c0f-4a9f-a8e8-4b2a9c1c7b2c' })
  @IsOptional()
  @IsUUID()
  weighingStationId?: string;

  @ApiProperty({ example: 120.5 })
  @IsNumber()
  @Min(0.000001)
  @Type(() => Number)
  weight: number;

  @ApiProperty({ example: 250000 })
  @IsNumber()
  @Type(() => Number)
  amount: number;

  @ApiProperty({ example: '2026-03-27T10:00:00.000Z' })
  @IsDateString()
  receiptDate: string;

  @ApiPropertyOptional({ example: 'BILL-2026-0001' })
  @IsOptional()
  @IsString()
  billCode?: string;

  @ApiPropertyOptional({ example: 'Ghi chú...' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'primary image url' })
  @IsOptional()
  @IsString()
  receiptImageUrl?: string;
}
