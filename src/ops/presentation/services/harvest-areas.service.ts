import {
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { HarvestAreaEntity } from '../../infrastructure/persistence/relational/entities/harvest-area.entity';
import { CreateHarvestAreaDto } from '../../dto/create-harvest-area.dto';
import { OpsAuthorizationService } from './ops-authorization.service';

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
      googlePlaceId: dto.googlePlaceId ?? null,
      latitude: dto.latitude?.toString() ?? null,
      longitude: dto.longitude?.toString() ?? null,
      targetTons: dto.targetTons?.toString() ?? null,
    });

    return this.harvestAreasRepository.save(entity);
  }
}
