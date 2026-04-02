import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserAppAvatar1763100000000 implements MigrationInterface {
  name = 'UserAppAvatar1763100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "is_custom_avatar" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "app_avatar" character varying`,
    );
    await queryRunner.query(
      `UPDATE "user" SET "is_custom_avatar" = true WHERE "photoId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "app_avatar"`);
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "is_custom_avatar"`,
    );
  }
}
