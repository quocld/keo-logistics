import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateManagedDriverDto } from './dto/create-managed-driver.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateManagedDriverDto } from './dto/update-managed-driver.dto';
import { NullableType } from '../utils/types/nullable.type';
import { FilterUserDto, SortUserDto } from './dto/query-user.dto';
import { UserRepository } from './infrastructure/persistence/user.repository';
import { User } from './domain/user';
import bcrypt from 'bcryptjs';
import { AuthProvidersEnum } from '../auth/auth-providers.enum';
import { FilesService } from '../files/files.service';
import { RoleEnum } from '../roles/roles.enum';
import { StatusEnum } from '../statuses/statuses.enum';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { FileType } from '../files/domain/file';
import { Role } from '../roles/domain/role';
import { Status } from '../statuses/domain/status';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UserRepository,
    private readonly filesService: FilesService,
  ) {}

  async create(
    createUserDto: CreateUserDto,
    options?: { forceManagedByOwnerUserId?: number },
  ): Promise<User> {
    // Do not remove comment below.
    // <creating-property />

    let password: string | undefined = undefined;

    if (createUserDto.password) {
      const salt = await bcrypt.genSalt();
      password = await bcrypt.hash(createUserDto.password, salt);
    }

    let email: string | null = null;

    if (createUserDto.email) {
      const userObject = await this.usersRepository.findByEmail(
        createUserDto.email,
      );
      if (userObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: 'emailAlreadyExists',
          },
        });
      }
      email = createUserDto.email;
    }

    let photo: FileType | null | undefined = undefined;

    if (createUserDto.photo?.id) {
      const fileObject = await this.filesService.findById(
        createUserDto.photo.id,
      );
      if (!fileObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            photo: 'imageNotExists',
          },
        });
      }
      photo = fileObject;
    } else if (createUserDto.photo === null) {
      photo = null;
    }

    let isCustomAvatar = false;
    let appAvatar: string | null = null;

    if (photo) {
      isCustomAvatar = true;
      appAvatar = null;
    } else if (
      createUserDto.appAvatar != null &&
      String(createUserDto.appAvatar).trim() !== ''
    ) {
      isCustomAvatar = false;
      appAvatar = String(createUserDto.appAvatar).trim();
    } else if (createUserDto.isCustomAvatar === true) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          photo: 'customAvatarRequiresPhoto',
        },
      });
    } else if (createUserDto.isCustomAvatar === false) {
      isCustomAvatar = false;
      appAvatar =
        createUserDto.appAvatar != null &&
        String(createUserDto.appAvatar).trim() !== ''
          ? String(createUserDto.appAvatar).trim()
          : null;
    }

    let role: Role | undefined = undefined;

    if (createUserDto.role?.id) {
      const roleObject = Object.values(RoleEnum)
        .map(String)
        .includes(String(createUserDto.role.id));
      if (!roleObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            role: 'roleNotExists',
          },
        });
      }

      role = {
        id: createUserDto.role.id,
      };
    }

    let status: Status | undefined = undefined;

    if (createUserDto.status?.id) {
      const statusObject = Object.values(StatusEnum)
        .map(String)
        .includes(String(createUserDto.status.id));
      if (!statusObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            status: 'statusNotExists',
          },
        });
      }

      status = {
        id: createUserDto.status.id,
      };
    }

    let managedByOwner: { id: number } | null | undefined = undefined;

    if (options?.forceManagedByOwnerUserId != null) {
      if (Number(createUserDto.role?.id) !== RoleEnum.driver) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            role: 'managedDriverRequiresDriverRole',
          },
        });
      }
      const ownerAccount = await this.usersRepository.findById(
        options.forceManagedByOwnerUserId,
      );
      if (!ownerAccount || Number(ownerAccount.role?.id) !== RoleEnum.owner) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            managedByOwner: 'invalidOwner',
          },
        });
      }
      managedByOwner = { id: Number(ownerAccount.id) };
    } else if (createUserDto.managedByOwnerId != null) {
      if (Number(createUserDto.role?.id) !== RoleEnum.driver) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            managedByOwnerId: 'requiresDriverRole',
          },
        });
      }
      const ownerAccount = await this.usersRepository.findById(
        createUserDto.managedByOwnerId,
      );
      if (!ownerAccount || Number(ownerAccount.role?.id) !== RoleEnum.owner) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            managedByOwnerId: 'invalidOwner',
          },
        });
      }
      managedByOwner = { id: Number(ownerAccount.id) };
    }

    return this.usersRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      email: email,
      password: password,
      photo: photo,
      role: role,
      status: status,
      provider: createUserDto.provider ?? AuthProvidersEnum.email,
      socialId: createUserDto.socialId,
      managedByOwner,
      isCustomAvatar,
      appAvatar,
    });
  }

  async createManagedDriverForOwner(
    ownerUserId: number,
    dto: CreateManagedDriverDto,
  ): Promise<User> {
    return this.create(
      {
        email: dto.email,
        password: dto.password,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: { id: RoleEnum.driver },
        status: dto.status ?? { id: StatusEnum.active },
      },
      { forceManagedByOwnerUserId: ownerUserId },
    );
  }

  findManagedDrivers(
    ownerUserId: number,
    paginationOptions: IPaginationOptions,
  ): Promise<User[]> {
    return this.usersRepository.findDriversByManagedOwnerId(
      ownerUserId,
      paginationOptions,
    );
  }

  async findManagedDriver(
    ownerUserId: number,
    driverId: User['id'],
  ): Promise<NullableType<User>> {
    return this.usersRepository.findDriverByIdAndManagedOwnerId(
      driverId,
      ownerUserId,
    );
  }

  async updateManagedDriver(
    ownerUserId: number,
    driverId: User['id'],
    dto: UpdateManagedDriverDto,
  ): Promise<User | null> {
    const existing = await this.usersRepository.findDriverByIdAndManagedOwnerId(
      driverId,
      ownerUserId,
    );
    if (!existing) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
    return this.update(driverId, dto as UpdateUserDto);
  }

  async removeManagedDriver(
    ownerUserId: number,
    driverId: User['id'],
  ): Promise<void> {
    const existing = await this.usersRepository.findDriverByIdAndManagedOwnerId(
      driverId,
      ownerUserId,
    );
    if (!existing) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
    await this.usersRepository.remove(driverId);
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterUserDto | null;
    sortOptions?: SortUserDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<User[]> {
    return this.usersRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: User['id']): Promise<NullableType<User>> {
    return this.usersRepository.findById(id);
  }

  findByIds(ids: User['id'][]): Promise<User[]> {
    return this.usersRepository.findByIds(ids);
  }

  findByEmail(email: User['email']): Promise<NullableType<User>> {
    return this.usersRepository.findByEmail(email);
  }

  findBySocialIdAndProvider({
    socialId,
    provider,
  }: {
    socialId: User['socialId'];
    provider: User['provider'];
  }): Promise<NullableType<User>> {
    return this.usersRepository.findBySocialIdAndProvider({
      socialId,
      provider,
    });
  }

  async update(
    id: User['id'],
    updateUserDto: UpdateUserDto,
  ): Promise<User | null> {
    // Do not remove comment below.
    // <updating-property />

    let password: string | undefined = undefined;

    if (updateUserDto.password) {
      const userObject = await this.usersRepository.findById(id);

      if (userObject && userObject?.password !== updateUserDto.password) {
        const salt = await bcrypt.genSalt();
        password = await bcrypt.hash(updateUserDto.password, salt);
      }
    }

    let email: string | null | undefined = undefined;

    if (updateUserDto.email) {
      const userObject = await this.usersRepository.findByEmail(
        updateUserDto.email,
      );

      if (userObject && userObject.id !== id) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: 'emailAlreadyExists',
          },
        });
      }

      email = updateUserDto.email;
    } else if (updateUserDto.email === null) {
      email = null;
    }

    let photo: FileType | null | undefined = undefined;

    if (updateUserDto.photo?.id) {
      const fileObject = await this.filesService.findById(
        updateUserDto.photo.id,
      );
      if (!fileObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            photo: 'imageNotExists',
          },
        });
      }
      photo = fileObject;
    } else if (updateUserDto.photo === null) {
      photo = null;
    }

    let isCustomAvatar: boolean | undefined = undefined;
    let appAvatar: string | null | undefined = undefined;

    if (updateUserDto.photo?.id) {
      isCustomAvatar = true;
      appAvatar = null;
    } else if (updateUserDto.photo === null) {
      if (updateUserDto.appAvatar !== undefined) {
        isCustomAvatar = false;
        appAvatar =
          updateUserDto.appAvatar != null &&
          String(updateUserDto.appAvatar).trim() !== ''
            ? String(updateUserDto.appAvatar).trim()
            : null;
      } else if (updateUserDto.isCustomAvatar === false) {
        isCustomAvatar = false;
      } else {
        isCustomAvatar = false;
        appAvatar = null;
      }
    } else if (updateUserDto.isCustomAvatar === true) {
      isCustomAvatar = true;
      appAvatar = null;
    } else if (
      updateUserDto.isCustomAvatar === false ||
      updateUserDto.appAvatar !== undefined
    ) {
      isCustomAvatar = false;
      photo = null;
      if (updateUserDto.appAvatar !== undefined) {
        appAvatar =
          updateUserDto.appAvatar != null &&
          String(updateUserDto.appAvatar).trim() !== ''
            ? String(updateUserDto.appAvatar).trim()
            : null;
      }
    }

    let role: Role | undefined = undefined;

    if (updateUserDto.role?.id) {
      const roleObject = Object.values(RoleEnum)
        .map(String)
        .includes(String(updateUserDto.role.id));
      if (!roleObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            role: 'roleNotExists',
          },
        });
      }

      role = {
        id: updateUserDto.role.id,
      };
    }

    let status: Status | undefined = undefined;

    if (updateUserDto.status?.id) {
      const statusObject = Object.values(StatusEnum)
        .map(String)
        .includes(String(updateUserDto.status.id));
      if (!statusObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            status: 'statusNotExists',
          },
        });
      }

      status = {
        id: updateUserDto.status.id,
      };
    }

    let managedByOwner: { id: number } | null | undefined = undefined;

    if (role !== undefined && Number(role.id) !== RoleEnum.driver) {
      managedByOwner = null;
    } else if (updateUserDto.managedByOwnerId !== undefined) {
      const current = await this.usersRepository.findById(id);
      if (!current) {
        return null;
      }
      if (Number(current.role?.id) !== RoleEnum.driver) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            managedByOwnerId: 'targetMustBeDriver',
          },
        });
      }
      if (updateUserDto.managedByOwnerId === null) {
        managedByOwner = null;
      } else {
        const ownerAccount = await this.usersRepository.findById(
          updateUserDto.managedByOwnerId,
        );
        if (!ownerAccount || Number(ownerAccount.role?.id) !== RoleEnum.owner) {
          throw new UnprocessableEntityException({
            status: HttpStatus.UNPROCESSABLE_ENTITY,
            errors: {
              managedByOwnerId: 'invalidOwner',
            },
          });
        }
        managedByOwner = { id: Number(ownerAccount.id) };
      }
    }

    return this.usersRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      firstName: updateUserDto.firstName,
      lastName: updateUserDto.lastName,
      email,
      password,
      photo,
      role,
      status,
      provider: updateUserDto.provider,
      socialId: updateUserDto.socialId,
      managedByOwner,
      isCustomAvatar,
      appAvatar,
    });
  }

  async remove(id: User['id']): Promise<void> {
    await this.usersRepository.remove(id);
  }
}
