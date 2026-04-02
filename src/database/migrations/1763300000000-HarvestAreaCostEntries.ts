import { MigrationInterface, QueryRunner } from 'typeorm';

export class HarvestAreaCostEntries1763300000000 implements MigrationInterface {
  name = 'HarvestAreaCostEntries1763300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "harvest_area_cost_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "harvest_area_id" uuid NOT NULL,
        "category" character varying(20) NOT NULL,
        "amount" numeric(15,2) NOT NULL,
        "incurred_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "notes" text,
        "created_by" integer,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_harvest_area_cost_entries" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_harvest_area_cost_category" CHECK ("category" IN ('road','loading','labor','other'))
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "harvest_area_cost_entries" ADD CONSTRAINT "FK_hace_harvest_area" FOREIGN KEY ("harvest_area_id") REFERENCES "harvest_areas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "harvest_area_cost_entries" ADD CONSTRAINT "FK_hace_created_by_user" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_hace_area_incurred" ON "harvest_area_cost_entries" ("harvest_area_id", "incurred_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_hace_area_incurred"`);
    await queryRunner.query(
      `ALTER TABLE "harvest_area_cost_entries" DROP CONSTRAINT "FK_hace_created_by_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "harvest_area_cost_entries" DROP CONSTRAINT "FK_hace_harvest_area"`,
    );
    await queryRunner.query(`DROP TABLE "harvest_area_cost_entries"`);
  }
}
