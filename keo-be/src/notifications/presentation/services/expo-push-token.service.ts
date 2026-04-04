import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { RegisterExpoPushDeviceDto } from '../dto/register-expo-push-device.dto';
import { UserExpoPushDeviceEntity } from '../../infrastructure/persistence/relational/entities/user-expo-push-device.entity';

@Injectable()
export class ExpoPushTokenService {
  constructor(
    @InjectRepository(UserExpoPushDeviceEntity)
    private readonly devicesRepository: Repository<UserExpoPushDeviceEntity>,
  ) {}

  async registerToken(
    actor: JwtPayloadType,
    dto: RegisterExpoPushDeviceDto,
  ): Promise<UserExpoPushDeviceEntity> {
    if (!actor?.id) {
      throw new UnauthorizedException();
    }

    const userId = Number(actor.id);
    const enabled = dto.enabled ?? true;
    const now = new Date();

    const existing = await this.devicesRepository.findOne({
      where: { expoPushToken: dto.expoPushToken },
    });

    if (existing) {
      existing.user = { id: userId } as any;
      existing.platform = dto.platform;
      existing.easProjectId = dto.easProjectId ?? null;
      existing.easEnvironment = dto.easEnvironment ?? null;
      existing.isEnabled = enabled;
      existing.lastSeenAt = enabled ? now : existing.lastSeenAt;
      return this.devicesRepository.save(existing);
    }

    const created = this.devicesRepository.create({
      user: { id: userId } as any,
      expoPushToken: dto.expoPushToken,
      platform: dto.platform,
      easProjectId: dto.easProjectId ?? null,
      easEnvironment: dto.easEnvironment ?? null,
      isEnabled: enabled,
      lastSeenAt: enabled ? now : null,
    });

    return this.devicesRepository.save(created);
  }
}
