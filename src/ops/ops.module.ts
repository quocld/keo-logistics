import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesModule } from '../files/files.module';
import { HarvestAreaEntity } from './infrastructure/persistence/relational/entities/harvest-area.entity';
import { WeighingStationEntity } from './infrastructure/persistence/relational/entities/weighing-station.entity';
import { ReceiptEntity } from './infrastructure/persistence/relational/entities/receipt.entity';
import { ReceiptImageEntity } from './infrastructure/persistence/relational/entities/receipt-image.entity';
import { FinanceRecordEntity } from './infrastructure/persistence/relational/entities/finance-record.entity';
import { TripEntity } from './infrastructure/persistence/relational/entities/trip.entity';
import { HarvestAreasController } from './presentation/controllers/harvest-areas.controller';
import { WeighingStationsController } from './presentation/controllers/weighing-stations.controller';
import { ReceiptsController } from './presentation/controllers/receipts.controller';
import { HarvestAreasService } from './presentation/services/harvest-areas.service';
import { WeighingStationsService } from './presentation/services/weighing-stations.service';
import { ReceiptsService } from './presentation/services/receipts.service';
import { OpsAuthorizationService } from './presentation/services/ops-authorization.service';

@Module({
  imports: [
    FilesModule,
    TypeOrmModule.forFeature([
      HarvestAreaEntity,
      WeighingStationEntity,
      ReceiptEntity,
      ReceiptImageEntity,
      FinanceRecordEntity,
      TripEntity,
    ]),
  ],
  controllers: [
    HarvestAreasController,
    WeighingStationsController,
    ReceiptsController,
  ],
  providers: [
    OpsAuthorizationService,
    HarvestAreasService,
    WeighingStationsService,
    ReceiptsService,
  ],
})
export class OpsModule {}
