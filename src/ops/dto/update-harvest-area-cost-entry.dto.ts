import { PartialType } from '@nestjs/swagger';
import { CreateHarvestAreaCostEntryDto } from './create-harvest-area-cost-entry.dto';

export class UpdateHarvestAreaCostEntryDto extends PartialType(
  CreateHarvestAreaCostEntryDto,
) {}
