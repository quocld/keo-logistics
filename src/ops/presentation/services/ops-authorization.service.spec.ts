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
    const repo = {
      findOne: jest.fn(),
    } as unknown as Repository<HarvestAreaEntity>;
    const service = new OpsAuthorizationService(repo);

    await expect(
      service.assertOwnerOwnsHarvestArea(makeActor(RoleEnum.admin), 'any-uuid'),
    ).resolves.toBeUndefined();

    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it('should throw Forbidden when owner does not own harvest-area', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as Repository<HarvestAreaEntity>;
    const service = new OpsAuthorizationService(repo);

    await expect(
      service.assertOwnerOwnsHarvestArea(makeActor(RoleEnum.owner), 'any-uuid'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should resolve when owner owns harvest-area', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'any-uuid',
      }),
    } as unknown as Repository<HarvestAreaEntity>;
    const service = new OpsAuthorizationService(repo);

    await expect(
      service.assertOwnerOwnsHarvestArea(makeActor(RoleEnum.owner), 'any-uuid'),
    ).resolves.toBeUndefined();
  });
});
