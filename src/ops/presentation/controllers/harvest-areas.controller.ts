import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../../roles/roles.decorator';
import { RolesGuard } from '../../../roles/roles.guard';
import { RoleEnum } from '../../../roles/roles.enum';
import { CreateHarvestAreaDto } from '../../dto/create-harvest-area.dto';
import { HarvestAreaEntity } from '../../infrastructure/persistence/relational/entities/harvest-area.entity';
import { HarvestAreasService } from '../services/harvest-areas.service';

@ApiBearerAuth()
@ApiTags('HarvestAreas')
@Roles(RoleEnum.admin, RoleEnum.owner)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'harvest-areas',
  version: '1',
})
export class HarvestAreasController {
  constructor(private readonly harvestAreasService: HarvestAreasService) {}

  @ApiCreatedResponse({ type: HarvestAreaEntity })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() request,
    @Body() dto: CreateHarvestAreaDto,
  ): Promise<HarvestAreaEntity> {
    return this.harvestAreasService.create(request.user, dto);
  }
}
