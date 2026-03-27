import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HarvestAreaEntity } from './infrastructure/persistence/relational/entities/harvest-area.entity';
import { WeighingStationEntity } from './infrastructure/persistence/relational/entities/weighing-station.entity';
import { ReceiptEntity } from './infrastructure/persistence/relational/entities/receipt.entity';
import { HarvestAreasController } from './presentation/controllers/harvest-areas.controller';
import { WeighingStationsController } from './presentation/controllers/weighing-stations.controller';
import { ReceiptsController } from './presentation/controllers/receipts.controller';
import { HarvestAreasService } from './presentation/services/harvest-areas.service';
import { WeighingStationsService } from './presentation/services/weighing-stations.service';
import { ReceiptsService } from './presentation/services/receipts.service';
import { OpsAuthorizationService } from './presentation/services/ops-authorization.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HarvestAreaEntity,
      WeighingStationEntity,
      ReceiptEntity,
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
