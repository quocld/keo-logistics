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
import { CreateWeighingStationDto } from '../../dto/create-weighing-station.dto';
import { WeighingStationEntity } from '../../infrastructure/persistence/relational/entities/weighing-station.entity';
import { WeighingStationsService } from '../services/weighing-stations.service';

@ApiBearerAuth()
@ApiTags('WeighingStations')
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'weighing-stations',
  version: '1',
})
export class WeighingStationsController {
  constructor(
    private readonly weighingStationsService: WeighingStationsService,
  ) {}

  @ApiCreatedResponse({ type: WeighingStationEntity })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() request,
    @Body() dto: CreateWeighingStationDto,
  ): Promise<WeighingStationEntity> {
    return this.weighingStationsService.create(request.user, dto);
  }
}
