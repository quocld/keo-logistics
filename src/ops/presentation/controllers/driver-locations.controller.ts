import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../roles/roles.decorator';
import { RoleEnum } from '../../../roles/roles.enum';
import { RolesGuard } from '../../../roles/roles.guard';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { CreateDriverLocationDto } from '../../dto/create-driver-location.dto';
import { DriverLocationsService } from '../services/driver-locations.service';

@ApiBearerAuth()
@ApiTags('DriverLocations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'drivers/me/location',
  version: '1',
})
export class DriverLocationsController {
  constructor(
    private readonly driverLocationsService: DriverLocationsService,
  ) {}

  @ApiNoContentResponse({ description: 'Location accepted' })
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(RoleEnum.driver)
  async create(
    @Request() request: { user: JwtPayloadType },
    @Body() dto: CreateDriverLocationDto,
  ): Promise<void> {
    await this.driverLocationsService.createMyLocation(request.user, dto);
  }
}
