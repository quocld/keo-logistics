import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { HarvestAreaStatusEnum } from '../domain/harvest-area-status.enum';

export class CreateHarvestAreaDto {
  @ApiProperty({ example: 'Harvest Area 1' })
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  ownerId?: number;

  @ApiPropertyOptional({
    enum: HarvestAreaStatusEnum,
    description:
      'inactive | preparing (chuẩn bị/khảo sát) | active | paused | awaiting_renewal (chờ mua cây tiếp) | completed',
  })
  @IsOptional()
  @IsEnum(HarvestAreaStatusEnum)
  status?: HarvestAreaStatusEnum;

  @ApiPropertyOptional({ example: 'ChIJ...' })
  @IsOptional()
  @IsString()
  googlePlaceId?: string;

  @ApiPropertyOptional({ example: 10.762622 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 106.660172 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({
    example: 12.5,
    description: 'Diện tích bãi (ha)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  areaHectares?: number;

  @ApiPropertyOptional({
    example: 1000,
    description: 'Số tấn dự kiến khai thác',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  targetTons?: number;

  @ApiPropertyOptional({
    example: 'Ông A',
    description: 'Liên hệ chủ bãi / chủ đất (phía hợp đồng cây)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  siteContactName?: string;

  @ApiPropertyOptional({ example: '0901234567' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  siteContactPhone?: string;

  @ApiPropertyOptional({ example: 'chu-bai@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  siteContactEmail?: string;

  @ApiPropertyOptional({
    example: '2024-06-15',
    description: 'Ngày mua/thuê cây tại bãi (ISO date)',
  })
  @IsOptional()
  @IsDateString()
  sitePurchaseDate?: string;

  @ApiPropertyOptional({
    example: 'Mua đợt 1/2024; dự kiến mua tiếp sau 3 năm.',
  })
  @IsOptional()
  @IsString()
  siteNotes?: string;
}
