import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { Roles } from '../../../roles/roles.decorator';
import { RoleEnum } from '../../../roles/roles.enum';
import { RolesGuard } from '../../../roles/roles.guard';
import { CreateVehicleLocationDto } from '../../dto/create-vehicle-location.dto';
import { TripLocationsService } from '../services/trip-locations.service';

@ApiBearerAuth()
@ApiTags('TripLocations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'trips',
  version: '1',
})
export class TripLocationsController {
  constructor(private readonly tripLocationsService: TripLocationsService) {}

  @ApiNoContentResponse({ description: 'Location accepted' })
  @ApiParam({ name: 'id', type: String })
  @Post(':id/locations')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(RoleEnum.driver)
  async create(
    @Request() request: { user: JwtPayloadType },
    @Param('id') tripId: string,
    @Body() dto: CreateVehicleLocationDto,
  ): Promise<void> {
    await this.tripLocationsService.createTripLocation(
      request.user,
      tripId,
      dto,
    );
  }
}
