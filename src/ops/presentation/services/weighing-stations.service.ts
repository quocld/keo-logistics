import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { WeighingStationEntity } from '../../infrastructure/persistence/relational/entities/weighing-station.entity';
import { CreateWeighingStationDto } from '../../dto/create-weighing-station.dto';
import { OpsAuthorizationService } from './ops-authorization.service';

@Injectable()
export class WeighingStationsService {
  constructor(
    @InjectRepository(WeighingStationEntity)
    private readonly weighingStationsRepository: Repository<WeighingStationEntity>,
    private readonly opsAuthorizationService: OpsAuthorizationService,
  ) {}

  async create(
    actor: JwtPayloadType,
    dto: CreateWeighingStationDto,
  ): Promise<WeighingStationEntity> {
    this.opsAuthorizationService.assertAdmin(actor);

    if (!dto.latitude || !dto.longitude || !dto.unitPrice) {
      throw new UnprocessableEntityException({ error: 'invalid payload' });
    }

    const entity = this.weighingStationsRepository.create({
      name: dto.name,
      code: dto.code ?? null,
      googlePlaceId: dto.googlePlaceId ?? null,
      latitude: dto.latitude.toString(),
      longitude: dto.longitude.toString(),
      formattedAddress: dto.formattedAddress,
      unitPrice: dto.unitPrice.toString(),
      status: dto.status ?? undefined,
      notes: dto.notes ?? null,
    });

    return this.weighingStationsRepository.save(entity);
  }
}
