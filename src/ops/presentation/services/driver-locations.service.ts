import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { DriverLocationEntity } from '../../infrastructure/persistence/relational/entities/driver-location.entity';
import { CreateDriverLocationDto } from '../../dto/create-driver-location.dto';
import { OpsAuthorizationService } from './ops-authorization.service';
import { LocationCacheService } from './location-cache.service';

@Injectable()
export class DriverLocationsService {
  constructor(
    @InjectRepository(DriverLocationEntity)
    private readonly driverLocationsRepository: Repository<DriverLocationEntity>,
    private readonly opsAuthorizationService: OpsAuthorizationService,
    private readonly locationCacheService: LocationCacheService,
  ) {}

  async createMyLocation(
    actor: JwtPayloadType,
    dto: CreateDriverLocationDto,
  ): Promise<void> {
    this.opsAuthorizationService.assertDriver(actor);

    if (dto.accuracy != null && dto.accuracy > 200) {
      throw new UnprocessableEntityException({
        error: 'locationAccuracyTooLow',
      });
    }

    const ok = await this.locationCacheService.rateLimitDriver(
      Number(actor.id),
      10,
      50,
    );
    if (!ok) {
      throw new UnprocessableEntityException({ error: 'locationRateLimited' });
    }

    const ts = dto.timestamp ? new Date(dto.timestamp) : new Date();
    const created = this.driverLocationsRepository.create({
      driver: { id: actor.id } as any,
      latitude: dto.latitude.toString(),
      longitude: dto.longitude.toString(),
      speed: dto.speed != null ? dto.speed.toString() : null,
      accuracy: dto.accuracy != null ? dto.accuracy.toString() : null,
      timestamp: ts,
    });
    await this.driverLocationsRepository.save(created);

    await this.locationCacheService.setDriverLastLocation(Number(actor.id), {
      latitude: dto.latitude,
      longitude: dto.longitude,
      timestamp: ts.toISOString(),
      accuracy: dto.accuracy ?? null,
      speed: dto.speed ?? null,
    });
  }
}
