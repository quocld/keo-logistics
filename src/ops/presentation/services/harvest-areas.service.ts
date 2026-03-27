import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { HarvestAreaEntity } from '../../infrastructure/persistence/relational/entities/harvest-area.entity';
import { HarvestAreaStatusEnum } from '../../domain/harvest-area-status.enum';
import { CreateHarvestAreaDto } from '../../dto/create-harvest-area.dto';
import { UpdateHarvestAreaDto } from '../../dto/update-harvest-area.dto';
import { QueryHarvestAreaDto } from '../../dto/query-harvest-area.dto';
import { OpsAuthorizationService } from './ops-authorization.service';
import { infinityPagination } from '../../../utils/infinity-pagination';
import { InfinityPaginationResponseDto } from '../../../utils/dto/infinity-pagination-response.dto';

@Injectable()
export class HarvestAreasService {
  constructor(
    @InjectRepository(HarvestAreaEntity)
    private readonly harvestAreasRepository: Repository<HarvestAreaEntity>,
    private readonly opsAuthorizationService: OpsAuthorizationService,
  ) {}

  async create(
    actor: JwtPayloadType,
    dto: CreateHarvestAreaDto,
  ): Promise<HarvestAreaEntity> {
    let ownerId: number;

    if (this.opsAuthorizationService.isOwner(actor)) {
      ownerId = Number(actor.id);
    } else if (this.opsAuthorizationService.isAdmin(actor)) {
      if (!dto.ownerId) {
        throw new UnprocessableEntityException({
          error: 'missing ownerId',
        });
      }
      ownerId = dto.ownerId;
    } else {
      throw new ForbiddenException({ error: 'forbidden' });
    }

    const entity = this.harvestAreasRepository.create({
      name: dto.name,
      owner: { id: ownerId } as any,
      status: dto.status ?? HarvestAreaStatusEnum.active,
      googlePlaceId: dto.googlePlaceId ?? null,
      latitude: dto.latitude?.toString() ?? null,
      longitude: dto.longitude?.toString() ?? null,
      targetTons: dto.targetTons?.toString() ?? null,
      siteContactName: dto.siteContactName ?? null,
      siteContactPhone: dto.siteContactPhone ?? null,
      siteContactEmail: dto.siteContactEmail ?? null,
      sitePurchaseDate: dto.sitePurchaseDate ?? null,
      siteNotes: dto.siteNotes ?? null,
    });

    return this.harvestAreasRepository.save(entity);
  }

  async findMany(
    actor: JwtPayloadType,
    query: QueryHarvestAreaDto,
  ): Promise<InfinityPaginationResponseDto<HarvestAreaEntity>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50);
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<HarvestAreaEntity> = {};

    if (query.filters?.status) {
      where.status = query.filters.status;
    }

    if (this.opsAuthorizationService.isOwner(actor)) {
      where.owner = { id: Number(actor.id) };
    } else if (
      this.opsAuthorizationService.isAdmin(actor) &&
      query.filters?.ownerId
    ) {
      where.owner = { id: query.filters.ownerId };
    }

    const data = await this.harvestAreasRepository.find({
      where,
      relations: ['owner'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return infinityPagination(data, { page, limit });
  }

  async findOne(actor: JwtPayloadType, id: string): Promise<HarvestAreaEntity> {
    const entity = await this.harvestAreasRepository.findOne({
      where: { id },
      relations: ['owner'],
    });

    if (!entity) {
      throw new NotFoundException({ error: 'harvest area not found' });
    }

    if (this.opsAuthorizationService.isOwner(actor)) {
      if (entity.owner?.id !== Number(actor.id)) {
        throw new ForbiddenException({ error: 'forbidden' });
      }
    }

    return entity;
  }

  async update(
    actor: JwtPayloadType,
    id: string,
    dto: UpdateHarvestAreaDto,
  ): Promise<HarvestAreaEntity> {
    await this.opsAuthorizationService.assertOwnerOwnsHarvestArea(actor, id);

    const entity = await this.harvestAreasRepository.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException({ error: 'harvest area not found' });
    }

    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.status !== undefined) entity.status = dto.status;
    if (dto.googlePlaceId !== undefined)
      entity.googlePlaceId = dto.googlePlaceId ?? null;
    if (dto.latitude !== undefined)
      entity.latitude = dto.latitude?.toString() ?? null;
    if (dto.longitude !== undefined)
      entity.longitude = dto.longitude?.toString() ?? null;
    if (dto.targetTons !== undefined)
      entity.targetTons = dto.targetTons?.toString() ?? null;
    if (dto.siteContactName !== undefined)
      entity.siteContactName = dto.siteContactName ?? null;
    if (dto.siteContactPhone !== undefined)
      entity.siteContactPhone = dto.siteContactPhone ?? null;
    if (dto.siteContactEmail !== undefined)
      entity.siteContactEmail = dto.siteContactEmail ?? null;
    if (dto.sitePurchaseDate !== undefined)
      entity.sitePurchaseDate = dto.sitePurchaseDate ?? null;
    if (dto.siteNotes !== undefined) entity.siteNotes = dto.siteNotes ?? null;

    return this.harvestAreasRepository.save(entity);
  }

  async softDelete(actor: JwtPayloadType, id: string): Promise<void> {
    await this.opsAuthorizationService.assertOwnerOwnsHarvestArea(actor, id);

    const entity = await this.harvestAreasRepository.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException({ error: 'harvest area not found' });
    }

    await this.harvestAreasRepository.softDelete(id);
  }
}
