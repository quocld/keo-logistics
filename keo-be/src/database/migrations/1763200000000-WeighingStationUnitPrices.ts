import { MigrationInterface, QueryRunner } from 'typeorm';

export class WeighingStationUnitPrices1763200000000 implements MigrationInterface {
  name = 'WeighingStationUnitPrices1763200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "weighing_station_unit_prices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "weighing_station_id" uuid NOT NULL,
        "unit_price" numeric(12,2) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_weighing_station_unit_prices" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "weighing_station_unit_prices" ADD CONSTRAINT "FK_ws_unit_prices_weighing_station" FOREIGN KEY ("weighing_station_id") REFERENCES "weighing_stations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ws_unit_prices_station_created" ON "weighing_station_unit_prices" ("weighing_station_id", "created_at" DESC)`,
    );

    await queryRunner.query(
      `INSERT INTO "weighing_station_unit_prices" ("id", "weighing_station_id", "unit_price", "created_at")
       SELECT uuid_generate_v4(), "id", "unit_price", "updated_at" FROM "weighing_stations"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ws_unit_prices_station_created"`,
    );
    await queryRunner.query(
      `ALTER TABLE "weighing_station_unit_prices" DROP CONSTRAINT "FK_ws_unit_prices_weighing_station"`,
    );
    await queryRunner.query(`DROP TABLE "weighing_station_unit_prices"`);
  }
}
