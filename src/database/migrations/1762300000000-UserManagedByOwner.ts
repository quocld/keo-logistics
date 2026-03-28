import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserManagedByOwner1762300000000 implements MigrationInterface {
  name = 'UserManagedByOwner1762300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "managed_by_owner_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_user_managed_by_owner_id_user" FOREIGN KEY ("managed_by_owner_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_managed_by_owner_id" ON "user" ("managed_by_owner_id") WHERE "deletedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_user_managed_by_owner_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "FK_user_managed_by_owner_id_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "managed_by_owner_id"`,
    );
  }
}
