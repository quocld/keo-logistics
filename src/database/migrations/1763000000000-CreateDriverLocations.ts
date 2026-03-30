import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDriverLocations1763000000000 implements MigrationInterface {
  name = 'CreateDriverLocations1763000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "driver_locations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "driver_id" integer NOT NULL, "latitude" numeric(10,8) NOT NULL, "longitude" numeric(11,8) NOT NULL, "speed" numeric(5,2), "accuracy" numeric(6,2), "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_driver_locations_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "driver_locations" ADD CONSTRAINT "FK_driver_locations_driver_id_user" FOREIGN KEY ("driver_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_driver_locations_driver_time" ON "driver_locations" ("driver_id", "timestamp" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_driver_locations_timestamp" ON "driver_locations" ("timestamp" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_driver_locations_timestamp"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_driver_locations_driver_time"`,
    );

    await queryRunner.query(
      `ALTER TABLE "driver_locations" DROP CONSTRAINT "FK_driver_locations_driver_id_user"`,
    );
    await queryRunner.query(`DROP TABLE "driver_locations"`);
  }
}
