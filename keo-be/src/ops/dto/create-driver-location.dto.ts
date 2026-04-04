import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CreateDriverLocationDto {
  @ApiPropertyOptional({ example: 10.12345678 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  latitude: number;

  @ApiPropertyOptional({ example: 106.12345678 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  longitude: number;

  @ApiPropertyOptional({ example: 12.5, description: 'km/h' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  speed?: number;

  @ApiPropertyOptional({ example: 15.2, description: 'meters' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  accuracy?: number;

  @ApiPropertyOptional({
    description: 'Device timestamp (ISO). Defaults to server time.',
  })
  @IsOptional()
  @IsDateString()
  timestamp?: string;
}
