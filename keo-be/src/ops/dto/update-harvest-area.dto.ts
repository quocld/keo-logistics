import { PartialType } from '@nestjs/swagger';
import { CreateHarvestAreaDto } from './create-harvest-area.dto';

export class UpdateHarvestAreaDto extends PartialType(CreateHarvestAreaDto) {}
