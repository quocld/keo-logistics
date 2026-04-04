import { MigrationInterface, QueryRunner } from 'typeorm';

export class HarvestAreaSiteContact1762000000000 implements MigrationInterface {
  name = 'HarvestAreaSiteContact1762000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "harvest_areas" DROP CONSTRAINT "CHK_harvest_areas_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "harvest_areas" ADD CONSTRAINT "CHK_harvest_areas_status" CHECK ("status" IN ('active','inactive','paused','completed'))`,
    );

    await queryRunner.query(
      `ALTER TABLE "harvest_areas" ADD "site_contact_name" character varying(150)`,
    );
    await queryRunner.query(
      `ALTER TABLE "harvest_areas" ADD "site_contact_phone" character varying(30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "harvest_areas" ADD "site_contact_email" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "harvest_areas" ADD "site_purchase_date" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "harvest_areas" ADD "site_notes" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "harvest_areas" SET "status" = 'paused' WHERE "status" = 'inactive'`,
    );
    await queryRunner.query(
      `ALTER TABLE "harvest_areas" DROP CONSTRAINT "CHK_harvest_areas_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "harvest_areas" ADD CONSTRAINT "CHK_harvest_areas_status" CHECK ("status" IN ('active','completed','paused'))`,
    );

    await queryRunner.query(
      `ALTER TABLE "harvest_areas" DROP COLUMN "site_notes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "harvest_areas" DROP COLUMN "site_purchase_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "harvest_areas" DROP COLUMN "site_contact_email"`,
    );
    await queryRunner.query(
      `ALTER TABLE "harvest_areas" DROP COLUMN "site_contact_phone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "harvest_areas" DROP COLUMN "site_contact_name"`,
    );
  }
}
