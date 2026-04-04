import { MigrationInterface, QueryRunner } from 'typeorm';

export class HarvestAreaAreaAndStatuses1762100000000 implements MigrationInterface {
  name = 'HarvestAreaAreaAndStatuses1762100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "harvest_areas" DROP CONSTRAINT "CHK_harvest_areas_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "harvest_areas" ADD CONSTRAINT "CHK_harvest_areas_status" CHECK ("status" IN ('inactive','preparing','active','paused','awaiting_renewal','completed'))`,
    );

    await queryRunner.query(
      `ALTER TABLE "harvest_areas" ADD "area_hectares" numeric(12,4)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "harvest_areas" SET "status" = 'inactive' WHERE "status" IN ('preparing','awaiting_renewal')`,
    );

    await queryRunner.query(
      `ALTER TABLE "harvest_areas" DROP COLUMN "area_hectares"`,
    );

    await queryRunner.query(
      `ALTER TABLE "harvest_areas" DROP CONSTRAINT "CHK_harvest_areas_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "harvest_areas" ADD CONSTRAINT "CHK_harvest_areas_status" CHECK ("status" IN ('active','inactive','paused','completed'))`,
    );
  }
}
