import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserExpoPushDevices1762800000000 implements MigrationInterface {
  name = 'CreateUserExpoPushDevices1762800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_expo_push_devices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" integer NOT NULL, "expo_push_token" text NOT NULL, "platform" character varying(15) NOT NULL, "eas_project_id" character varying(80), "eas_environment" character varying(50), "is_enabled" boolean NOT NULL DEFAULT true, "last_seen_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_user_expo_push_devices_id" PRIMARY KEY ("id"), CONSTRAINT "UQ_user_expo_push_devices_expo_push_token" UNIQUE ("expo_push_token"))`,
    );

    await queryRunner.query(
      `ALTER TABLE "user_expo_push_devices" ADD CONSTRAINT "FK_user_expo_push_devices_user_id" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_user_expo_push_devices_user_id" ON "user_expo_push_devices" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_expo_push_devices_is_enabled" ON "user_expo_push_devices" ("is_enabled")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_user_expo_push_devices_is_enabled"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_user_expo_push_devices_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_expo_push_devices" DROP CONSTRAINT "FK_user_expo_push_devices_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "user_expo_push_devices"`);
  }
}
