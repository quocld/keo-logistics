import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { HarvestAreaCostCategoryEnum } from '../domain/harvest-area-cost-category.enum';

export class QueryHarvestAreaCostEntriesDto {
  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ enum: HarvestAreaCostCategoryEnum })
  @IsOptional()
  @IsEnum(HarvestAreaCostCategoryEnum)
  category?: HarvestAreaCostCategoryEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  incurredFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  incurredTo?: string;
}
