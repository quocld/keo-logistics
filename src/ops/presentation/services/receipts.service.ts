import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { ReceiptStatusEnum } from '../../domain/receipt-status.enum';
import { SubmitReceiptDto } from '../../dto/submit-receipt.dto';
import { RejectReceiptDto } from '../../dto/reject-receipt.dto';
import { ReceiptEntity } from '../../infrastructure/persistence/relational/entities/receipt.entity';
import { OpsAuthorizationService } from './ops-authorization.service';

@Injectable()
export class ReceiptsService {
  constructor(
    @InjectRepository(ReceiptEntity)
    private readonly receiptsRepository: Repository<ReceiptEntity>,
    private readonly opsAuthorizationService: OpsAuthorizationService,
  ) {}

  async submit(actor: JwtPayloadType, dto: SubmitReceiptDto) {
    this.opsAuthorizationService.assertDriver(actor);

    const receipt = this.receiptsRepository.create({
      trip: dto.tripId ? ({ id: dto.tripId } as any) : null,
      driver: { id: actor.id } as any,
      harvestArea: { id: dto.harvestAreaId } as any,
      weighingStation: dto.weighingStationId
        ? ({ id: dto.weighingStationId } as any)
        : null,
      weight: dto.weight.toString(),
      amount: dto.amount.toString(),
      receiptDate: new Date(dto.receiptDate),
      billCode: dto.billCode ?? null,
      notes: dto.notes ?? null,
      status: ReceiptStatusEnum.pending,
      submittedAt: new Date(),
    });

    return this.receiptsRepository.save(receipt);
  }

  async approve(actor: JwtPayloadType, receiptId: string) {
    this.opsAuthorizationService.assertAdminOrOwner(actor);

    const receipt = await this.receiptsRepository.findOne({
      where: { id: receiptId },
      relations: ['harvestArea', 'harvestArea.owner'],
    });

    if (!receipt) {
      throw new NotFoundException({ error: 'receiptNotFound' });
    }

    if (receipt.status !== ReceiptStatusEnum.pending) {
      throw new UnprocessableEntityException({
        error: 'receiptMustBePending',
      });
    }

    await this.opsAuthorizationService.assertOwnerOwnsHarvestArea(
      actor,
      receipt.harvestArea.id,
    );

    receipt.status = ReceiptStatusEnum.approved;
    receipt.approvedBy = { id: actor.id } as any;
    receipt.approvedAt = new Date();
    receipt.rejectedReason = null;

    return this.receiptsRepository.save(receipt);
  }

  async reject(
    actor: JwtPayloadType,
    receiptId: string,
    dto: RejectReceiptDto,
  ) {
    this.opsAuthorizationService.assertAdminOrOwner(actor);

    const receipt = await this.receiptsRepository.findOne({
      where: { id: receiptId },
      relations: ['harvestArea', 'harvestArea.owner'],
    });

    if (!receipt) {
      throw new NotFoundException({ error: 'receiptNotFound' });
    }

    if (receipt.status !== ReceiptStatusEnum.pending) {
      throw new UnprocessableEntityException({
        error: 'receiptMustBePending',
      });
    }

    await this.opsAuthorizationService.assertOwnerOwnsHarvestArea(
      actor,
      receipt.harvestArea.id,
    );

    receipt.status = ReceiptStatusEnum.rejected;
    receipt.approvedBy = null;
    receipt.approvedAt = null;
    receipt.rejectedReason = dto.rejectedReason;

    return this.receiptsRepository.save(receipt);
  }
}
