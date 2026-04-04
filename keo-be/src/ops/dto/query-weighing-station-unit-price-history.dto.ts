import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryWeighingStationUnitPriceHistoryDto {
  @ApiPropertyOptional({ default: 1 })
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 10 })
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number;
}
