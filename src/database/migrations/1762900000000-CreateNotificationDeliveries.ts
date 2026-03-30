import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationDeliveries1762900000000 implements MigrationInterface {
  name = 'CreateNotificationDeliveries1762900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "notification_deliveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "notification_id" uuid NOT NULL, "expo_push_token" text NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'queued', "error_code" text, "attempt_count" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_notification_deliveries_id" PRIMARY KEY ("id"), CONSTRAINT "FK_notification_deliveries_notification_id" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "UQ_notification_deliveries_notification_id_token" UNIQUE ("notification_id", "expo_push_token"))`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_notification_deliveries_status" ON "notification_deliveries" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_notification_deliveries_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_deliveries" DROP CONSTRAINT "FK_notification_deliveries_notification_id"`,
    );
    await queryRunner.query(`DROP TABLE "notification_deliveries"`);
  }
}
