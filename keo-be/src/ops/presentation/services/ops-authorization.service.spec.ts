import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { OpsAuthorizationService } from './ops-authorization.service';
import { HarvestAreaEntity } from '../../infrastructure/persistence/relational/entities/harvest-area.entity';
import { RoleEnum } from '../../../roles/roles.enum';

describe('OpsAuthorizationService', () => {
  const makeActor = (roleId: number) =>
    ({
      id: 1,
      role: { id: roleId, name: undefined },
    }) as any;

  it('should bypass owner harvest-area check for admin', async () => {
    const harvestAreasRepo = {
      findOne: jest.fn(),
    } as unknown as Repository<HarvestAreaEntity>;
    const service = new OpsAuthorizationService(
      harvestAreasRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.assertOwnerOwnsHarvestArea(makeActor(RoleEnum.admin), 'any-uuid'),
    ).resolves.toBeUndefined();

    expect(harvestAreasRepo.findOne).not.toHaveBeenCalled();
  });

  it('should throw Forbidden when owner does not own harvest-area', async () => {
    const harvestAreasRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as Repository<HarvestAreaEntity>;
    const service = new OpsAuthorizationService(
      harvestAreasRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.assertOwnerOwnsHarvestArea(makeActor(RoleEnum.owner), 'any-uuid'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should resolve when owner owns harvest-area', async () => {
    const harvestAreasRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'any-uuid',
      }),
    } as unknown as Repository<HarvestAreaEntity>;
    const service = new OpsAuthorizationService(
      harvestAreasRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.assertOwnerOwnsHarvestArea(makeActor(RoleEnum.owner), 'any-uuid'),
    ).resolves.toBeUndefined();
  });
});
