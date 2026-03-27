import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../../roles/roles.decorator';
import { RolesGuard } from '../../../roles/roles.guard';
import { RoleEnum } from '../../../roles/roles.enum';
import { SubmitReceiptDto } from '../../dto/submit-receipt.dto';
import { RejectReceiptDto } from '../../dto/reject-receipt.dto';
import { ReceiptEntity } from '../../infrastructure/persistence/relational/entities/receipt.entity';
import { ReceiptsService } from '../services/receipts.service';

@ApiBearerAuth()
@ApiTags('Receipts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'receipts',
  version: '1',
})
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @ApiCreatedResponse({ type: ReceiptEntity })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleEnum.driver)
  submit(
    @Request() request,
    @Body() dto: SubmitReceiptDto,
  ): Promise<ReceiptEntity> {
    return this.receiptsService.submit(request.user, dto);
  }

  @ApiCreatedResponse({ type: ReceiptEntity })
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleEnum.admin, RoleEnum.owner)
  approve(
    @Request() request,
    @Param('id') receiptId: string,
  ): Promise<ReceiptEntity> {
    return this.receiptsService.approve(request.user, receiptId);
  }

  @ApiCreatedResponse({ type: ReceiptEntity })
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleEnum.admin, RoleEnum.owner)
  reject(
    @Request() request,
    @Param('id') receiptId: string,
    @Body() dto: RejectReceiptDto,
  ): Promise<ReceiptEntity> {
    return this.receiptsService.reject(request.user, receiptId, dto);
  }
}
