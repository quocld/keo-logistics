import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { HarvestAreaCostCategoryEnum } from '../domain/harvest-area-cost-category.enum';

export class CreateHarvestAreaCostEntryDto {
  @ApiProperty({ enum: HarvestAreaCostCategoryEnum })
  @IsEnum(HarvestAreaCostCategoryEnum)
  category: HarvestAreaCostCategoryEnum;

  @ApiProperty({ example: 5_000_000 })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @ApiProperty({ example: '2026-04-02T00:00:00.000Z' })
  @IsDateString()
  incurredAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
