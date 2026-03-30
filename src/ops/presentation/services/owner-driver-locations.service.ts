import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { RoleEnum } from '../../../roles/roles.enum';
import { UserEntity } from '../../../users/infrastructure/persistence/relational/entities/user.entity';
import { DriverLocationEntity } from '../../infrastructure/persistence/relational/entities/driver-location.entity';
import {
  LocationCacheService,
  type LastKnownLocation,
} from './location-cache.service';
import { OpsAuthorizationService } from './ops-authorization.service';

export type ManagedDriverLatestLocation = {
  driverId: number;
  location: LastKnownLocation | null;
};

@Injectable()
export class OwnerDriverLocationsService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(DriverLocationEntity)
    private readonly driverLocationsRepository: Repository<DriverLocationEntity>,
    private readonly opsAuthorizationService: OpsAuthorizationService,
    private readonly locationCacheService: LocationCacheService,
  ) {}

  private async getVisibleDriverIds(actor: JwtPayloadType): Promise<number[]> {
    if (this.opsAuthorizationService.isAdmin(actor)) {
      const drivers = await this.usersRepository.find({
        where: { role: { id: RoleEnum.driver } as any },
        select: { id: true } as any,
      });
      return drivers.map((d) => Number(d.id));
    }

    this.opsAuthorizationService.assertAdminOrOwner(actor);

    const drivers = await this.usersRepository.find({
      where: {
        role: { id: RoleEnum.driver } as any,
        managedByOwner: { id: Number(actor.id) } as any,
      },
      select: { id: true } as any,
    });
    return drivers.map((d) => Number(d.id));
  }

  async getLatestLocationsForVisibleDrivers(
    actor: JwtPayloadType,
    page: number,
    limit: number,
  ): Promise<ManagedDriverLatestLocation[]> {
    const driverIds = await this.getVisibleDriverIds(actor);
    const start = (page - 1) * limit;
    const paged = driverIds.slice(start, start + limit);

    const cached =
      await this.locationCacheService.getDriversLastLocations(paged);

    const missingIds = paged.filter((id) => cached[id] == null);
    const fallback: Record<number, LastKnownLocation> = {};

    if (missingIds.length > 0) {
      const rows: Array<{
        driver_id: number;
        latitude: string;
        longitude: string;
        speed: string | null;
        accuracy: string | null;
        timestamp: Date;
      }> = await this.driverLocationsRepository.query(
        `
        SELECT DISTINCT ON (driver_id)
          driver_id, latitude, longitude, speed, accuracy, timestamp
        FROM driver_locations
        WHERE driver_id = ANY($1)
        ORDER BY driver_id, timestamp DESC
        `,
        [missingIds],
      );

      for (const r of rows) {
        fallback[Number(r.driver_id)] = {
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          timestamp: new Date(r.timestamp).toISOString(),
          accuracy: r.accuracy != null ? Number(r.accuracy) : null,
          speed: r.speed != null ? Number(r.speed) : null,
        };
      }

      // Warm cache for those we found in DB
      for (const id of missingIds) {
        const loc = fallback[id];
        if (loc) {
          await this.locationCacheService.setDriverLastLocation(id, loc);
        }
      }
    }

    return paged.map((driverId) => ({
      driverId,
      location: cached[driverId] ?? fallback[driverId] ?? null,
    }));
  }
}
