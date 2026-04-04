import { PartialType } from '@nestjs/swagger';
import { CreateWeighingStationDto } from './create-weighing-station.dto';

export class UpdateWeighingStationDto extends PartialType(
  CreateWeighingStationDto,
) {}
