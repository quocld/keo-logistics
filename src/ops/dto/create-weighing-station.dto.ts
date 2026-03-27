import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateWeighingStationDto {
  @ApiProperty({ example: 'Tram Station A' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'TRM-001' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: 'ChIJ...' })
  @IsOptional()
  @IsString()
  googlePlaceId?: string;

  @ApiPropertyOptional({ example: 10.762622 })
  @IsNumber()
  latitude: number;

  @ApiPropertyOptional({ example: 106.660172 })
  @IsNumber()
  longitude: number;

  @ApiPropertyOptional({ example: '123 Main St' })
  @IsString()
  @IsNotEmpty()
  formattedAddress: string;

  @ApiProperty({ example: 1200 })
  @IsNumber()
  unitPrice: number;

  @ApiPropertyOptional({ example: 'active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
