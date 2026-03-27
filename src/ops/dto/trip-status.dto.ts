import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { TripStatusEnum } from '../domain/trip-status.enum';

export class TripStatusDto {
  @Allow()
  @ApiProperty({
    enum: TripStatusEnum,
    example: TripStatusEnum.inProgress,
  })
  status: TripStatusEnum;
}
