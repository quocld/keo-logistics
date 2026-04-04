import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { infinityPagination } from '../utils/infinity-pagination';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { User } from './domain/user';
import { CreateManagedDriverDto } from './dto/create-managed-driver.dto';
import { UpdateManagedDriverDto } from './dto/update-managed-driver.dto';
import { UsersService } from './users.service';

@ApiBearerAuth()
@ApiTags('OwnerDrivers')
@Roles(RoleEnum.owner)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'owner/drivers',
  version: '1',
})
export class OwnerDriversController {
  constructor(private readonly usersService: UsersService) {}

  @ApiCreatedResponse({ type: User })
  @SerializeOptions({ groups: ['admin', 'owner'] })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() request: { user: JwtPayloadType },
    @Body() dto: CreateManagedDriverDto,
  ): Promise<User> {
    return this.usersService.createManagedDriverForOwner(
      Number(request.user.id),
      dto,
    );
  }

  @ApiOkResponse({
    type: InfinityPaginationResponse(User),
  })
  @SerializeOptions({ groups: ['admin', 'owner'] })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Request() request: { user: JwtPayloadType },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<InfinityPaginationResponseDto<User>> {
    const p = page ? Number(page) : 1;
    let l = limit ? Number(limit) : 10;
    if (l > 50) {
      l = 50;
    }
    const data = await this.usersService.findManagedDrivers(
      Number(request.user.id),
      { page: p, limit: l },
    );
    return infinityPagination(data, { page: p, limit: l });
  }

  @ApiOkResponse({ type: User })
  @SerializeOptions({ groups: ['admin', 'owner'] })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  async findOne(
    @Request() request: { user: JwtPayloadType },
    @Param('id') id: string,
  ): Promise<User> {
    const user = await this.usersService.findManagedDriver(
      Number(request.user.id),
      Number(id),
    );
    if (!user) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
    return user;
  }

  @ApiOkResponse({ type: User })
  @SerializeOptions({ groups: ['admin', 'owner'] })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  update(
    @Request() request: { user: JwtPayloadType },
    @Param('id') id: string,
    @Body() dto: UpdateManagedDriverDto,
  ): Promise<User | null> {
    return this.usersService.updateManagedDriver(
      Number(request.user.id),
      Number(id),
      dto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', type: String, required: true })
  remove(
    @Request() request: { user: JwtPayloadType },
    @Param('id') id: string,
  ): Promise<void> {
    return this.usersService.removeManagedDriver(
      Number(request.user.id),
      Number(id),
    );
  }
}
