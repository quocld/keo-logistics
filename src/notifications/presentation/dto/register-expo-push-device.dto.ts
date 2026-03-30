import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class RegisterExpoPushDeviceDto {
  @ApiProperty({
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    description: 'Expo push token obtained from expo-notifications.',
  })
  @IsString()
  @MaxLength(200)
  expoPushToken: string;

  @ApiProperty({
    example: 'android',
    description: 'Push platform.',
    enum: ['ios', 'android'],
  })
  @IsIn(['ios', 'android'])
  platform: 'ios' | 'android';

  @ApiPropertyOptional({
    example: 'eas-some-project-id',
    description:
      'Optional: EAS project/experience id (helps separate environments).',
  })
  @IsOptional()
  @IsString()
  easProjectId?: string;

  @ApiPropertyOptional({
    example: 'development',
    description: 'Optional: environment label (helps separate environments).',
  })
  @IsOptional()
  @IsString()
  easEnvironment?: string;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Set false to disable/unregister this push token.',
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
