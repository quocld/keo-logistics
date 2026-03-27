import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { RoleEnum } from './roles.enum';

describe('RolesGuard', () => {
  const makeContext = (userRoleId: number | string) =>
    ({
      getClass: () => ({}),
      getHandler: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            role: { id: userRoleId },
          },
        }),
      }),
    }) as unknown as ExecutionContext;

  it('should return true when roles metadata is undefined', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(makeContext(RoleEnum.owner))).toBe(true);
  });

  it('should return true when roles metadata is empty', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(makeContext(RoleEnum.owner))).toBe(true);
  });

  it('should allow when request.user.role.id is included', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([RoleEnum.owner]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(makeContext(RoleEnum.owner))).toBe(true);
  });

  it('should deny when request.user.role.id is not included', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([RoleEnum.owner]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(makeContext(RoleEnum.driver))).toBe(false);
  });
});
