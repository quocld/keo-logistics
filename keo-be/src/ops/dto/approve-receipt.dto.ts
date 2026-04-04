import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ApproveReceiptDto {
  @ApiPropertyOptional({
    description:
      'Required when the receipt has no weighing station and none can be inferred from the trip.',
  })
  @IsOptional()
  @IsUUID()
  weighingStationId?: string;
}
