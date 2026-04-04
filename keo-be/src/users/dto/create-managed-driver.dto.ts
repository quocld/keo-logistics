import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { StatusDto } from '../../statuses/dto/status.dto';

export class CreateManagedDriverDto {
  @ApiProperty({ example: 'driver.worker@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Tài' })
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Xế' })
  @IsNotEmpty()
  lastName: string;

  @ApiPropertyOptional({ type: () => StatusDto })
  @IsOptional()
  @Type(() => StatusDto)
  status?: StatusDto;
}
