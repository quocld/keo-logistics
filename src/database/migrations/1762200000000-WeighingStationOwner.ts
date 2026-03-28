import { MigrationInterface, QueryRunner } from 'typeorm';

export class WeighingStationOwner1762200000000 implements MigrationInterface {
  name = 'WeighingStationOwner1762200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "weighing_stations" ADD "owner_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "weighing_stations" ADD CONSTRAINT "FK_weighing_stations_owner_id_user" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_weighing_stations_owner_id" ON "weighing_stations" ("owner_id") WHERE "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_weighing_stations_owner_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "weighing_stations" DROP CONSTRAINT "FK_weighing_stations_owner_id_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "weighing_stations" DROP COLUMN "owner_id"`,
    );
  }
}
