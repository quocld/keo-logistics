import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { HarvestAreaCostEntryEntity } from '../../infrastructure/persistence/relational/entities/harvest-area-cost-entry.entity';
import { CreateHarvestAreaCostEntryDto } from '../../dto/create-harvest-area-cost-entry.dto';
import { UpdateHarvestAreaCostEntryDto } from '../../dto/update-harvest-area-cost-entry.dto';
import { QueryHarvestAreaCostEntriesDto } from '../../dto/query-harvest-area-cost-entries.dto';
import { OpsAuthorizationService } from './ops-authorization.service';
import { HarvestAreasService } from './harvest-areas.service';
import { infinityPagination } from '../../../utils/infinity-pagination';
import { InfinityPaginationResponseDto } from '../../../utils/dto/infinity-pagination-response.dto';

@Injectable()
export class HarvestAreaCostEntriesService {
  constructor(
    @InjectRepository(HarvestAreaCostEntryEntity)
    private readonly costEntriesRepository: Repository<HarvestAreaCostEntryEntity>,
    private readonly opsAuthorizationService: OpsAuthorizationService,
    private readonly harvestAreasService: HarvestAreasService,
  ) {}

  private async assertCanManageHarvestAreaCosts(
    actor: JwtPayloadType,
    harvestAreaId: string,
  ): Promise<void> {
    if (this.opsAuthorizationService.isAdmin(actor)) {
      return;
    }
    if (this.opsAuthorizationService.isOwner(actor)) {
      await this.opsAuthorizationService.assertOwnerOwnsHarvestArea(
        actor,
        harvestAreaId,
      );
      return;
    }
    throw new ForbiddenException({ error: 'forbidden' });
  }

  async create(
    actor: JwtPayloadType,
    harvestAreaId: string,
    dto: CreateHarvestAreaCostEntryDto,
  ): Promise<HarvestAreaCostEntryEntity> {
    await this.assertCanManageHarvestAreaCosts(actor, harvestAreaId);

    const entity = this.costEntriesRepository.create({
      harvestArea: { id: harvestAreaId } as any,
      category: dto.category,
      amount: dto.amount.toFixed(2),
      incurredAt: new Date(dto.incurredAt),
      notes: dto.notes ?? null,
      createdBy: { id: Number(actor.id) } as any,
    });

    return this.costEntriesRepository.save(entity);
  }

  async findMany(
    actor: JwtPayloadType,
    harvestAreaId: string,
    query: QueryHarvestAreaCostEntriesDto,
  ): Promise<InfinityPaginationResponseDto<HarvestAreaCostEntryEntity>> {
    await this.harvestAreasService.findOne(actor, harvestAreaId);

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50);
    const skip = (page - 1) * limit;

    const qb = this.costEntriesRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.createdBy', 'cb')
      .where('e.harvest_area_id = :haId', { haId: harvestAreaId })
      .orderBy('e.incurredAt', 'DESC')
      .addOrderBy('e.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.category) {
      qb.andWhere('e.category = :cat', { cat: query.category });
    }
    if (query.incurredFrom) {
      qb.andWhere('e.incurred_at >= :ifrom', {
        ifrom: new Date(query.incurredFrom),
      });
    }
    if (query.incurredTo) {
      qb.andWhere('e.incurred_at <= :ito', {
        ito: new Date(query.incurredTo),
      });
    }

    const data = await qb.getMany();

    return infinityPagination(data, { page, limit });
  }

  async update(
    actor: JwtPayloadType,
    harvestAreaId: string,
    entryId: string,
    dto: UpdateHarvestAreaCostEntryDto,
  ): Promise<HarvestAreaCostEntryEntity> {
    await this.assertCanManageHarvestAreaCosts(actor, harvestAreaId);

    const entity = await this.costEntriesRepository.findOne({
      where: { id: entryId, harvestArea: { id: harvestAreaId } },
    });

    if (!entity) {
      throw new NotFoundException({ error: 'harvestAreaCostEntryNotFound' });
    }

    if (dto.category !== undefined) entity.category = dto.category;
    if (dto.amount !== undefined) entity.amount = dto.amount.toFixed(2);
    if (dto.incurredAt !== undefined)
      entity.incurredAt = new Date(dto.incurredAt);
    if (dto.notes !== undefined) entity.notes = dto.notes ?? null;

    return this.costEntriesRepository.save(entity);
  }

  async remove(
    actor: JwtPayloadType,
    harvestAreaId: string,
    entryId: string,
  ): Promise<void> {
    await this.assertCanManageHarvestAreaCosts(actor, harvestAreaId);

    const entity = await this.costEntriesRepository.findOne({
      where: { id: entryId, harvestArea: { id: harvestAreaId } },
    });

    if (!entity) {
      throw new NotFoundException({ error: 'harvestAreaCostEntryNotFound' });
    }

    await this.costEntriesRepository.remove(entity);
  }
}
