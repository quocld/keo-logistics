import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { RoleEnum } from '../../../roles/roles.enum';
import { HarvestAreaEntity } from '../../infrastructure/persistence/relational/entities/harvest-area.entity';

@Injectable()
export class OpsAuthorizationService {
  constructor(
    @InjectRepository(HarvestAreaEntity)
    private readonly harvestAreasRepository: Repository<HarvestAreaEntity>,
  ) {}

  isAdmin(actor: JwtPayloadType): boolean {
    return actor?.role?.id?.toString() === RoleEnum.admin.toString();
  }

  isOwner(actor: JwtPayloadType): boolean {
    return actor?.role?.id?.toString() === RoleEnum.owner.toString();
  }

  isDriver(actor: JwtPayloadType): boolean {
    return actor?.role?.id?.toString() === RoleEnum.driver.toString();
  }

  assertAdmin(actor: JwtPayloadType): void {
    if (!this.isAdmin(actor)) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
  }

  assertAdminOrOwner(actor: JwtPayloadType): void {
    if (!this.isAdmin(actor) && !this.isOwner(actor)) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
  }

  assertDriver(actor: JwtPayloadType): void {
    if (!this.isDriver(actor)) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
  }

  async assertOwnerOwnsHarvestArea(
    actor: JwtPayloadType,
    harvestAreaId: string,
  ): Promise<void> {
    if (!this.isOwner(actor)) {
      this.assertAdmin(actor);
      return;
    }

    const ownedHarvestArea = await this.harvestAreasRepository.findOne({
      where: {
        id: harvestAreaId,
        owner: {
          id: Number(actor.id),
        },
      },
    });

    if (!ownedHarvestArea) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
  }
}
