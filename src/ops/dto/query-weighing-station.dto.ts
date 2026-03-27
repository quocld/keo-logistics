import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';

export class FilterWeighingStationDto {
  @ApiPropertyOptional({ example: 'active' })
  @IsOptional()
  @IsString()
  status?: string | null;

  @ApiPropertyOptional({ example: 'TRM-001' })
  @IsOptional()
  @IsString()
  code?: string | null;
}

export class QueryWeighingStationDto {
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

  @ApiPropertyOptional({
    type: String,
    description: 'JSON string: {"status":"active","code":"TRM-001"}',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value
      ? plainToInstance(FilterWeighingStationDto, JSON.parse(value))
      : undefined,
  )
  @ValidateNested()
  @Type(() => FilterWeighingStationDto)
  filters?: FilterWeighingStationDto | null;
}
