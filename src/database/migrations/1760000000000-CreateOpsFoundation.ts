import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOpsFoundation1760000000000 implements MigrationInterface {
  name = 'CreateOpsFoundation1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "driver_profiles" ("user_id" integer NOT NULL, "vehicle_plate" character varying(20), "license_number" character varying(30), "rating" numeric(3,2) NOT NULL DEFAULT '5', "total_trips" integer NOT NULL DEFAULT '0', "avg_tons_per_trip" numeric(8,2) NOT NULL DEFAULT '0', "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), CONSTRAINT "PK_driver_profiles_user_id" PRIMARY KEY ("user_id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "driver_profiles" ADD CONSTRAINT "FK_driver_profiles_user_id_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "harvest_areas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(150) NOT NULL, "owner_id" integer, "google_place_id" character varying(100), "latitude" numeric(10,8), "longitude" numeric(11,8), "formatted_address" text, "address_components" jsonb, "plus_code" character varying(50), "target_tons" numeric(12,2), "current_tons" numeric(12,2) NOT NULL DEFAULT '0', "status" character varying(20) NOT NULL DEFAULT 'active', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_harvest_areas_google_place_id" UNIQUE ("google_place_id"), CONSTRAINT "CHK_harvest_areas_status" CHECK ("status" IN ('active','completed','paused')), CONSTRAINT "PK_harvest_areas_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "harvest_areas" ADD CONSTRAINT "FK_harvest_areas_owner_id_user" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "weighing_stations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(150) NOT NULL, "code" character varying(50), "google_place_id" character varying(100), "latitude" numeric(10,8) NOT NULL, "longitude" numeric(11,8) NOT NULL, "formatted_address" text NOT NULL, "unit_price" numeric(12,2) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'active', "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_weighing_stations_code" UNIQUE ("code"), CONSTRAINT "CHK_weighing_stations_status" CHECK ("status" IN ('active','inactive','maintenance')), CONSTRAINT "PK_weighing_stations_id" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE TABLE "trips" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "driver_id" integer NOT NULL, "harvest_area_id" uuid NOT NULL, "weighing_station_id" uuid NOT NULL, "start_time" TIMESTAMP WITH TIME ZONE, "end_time" TIMESTAMP WITH TIME ZONE, "estimated_distance" numeric(8,2), "total_tons" numeric(12,2) NOT NULL DEFAULT '0', "total_receipts" integer NOT NULL DEFAULT '0', "status" character varying(20) NOT NULL DEFAULT 'in_progress', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_trips_status" CHECK ("status" IN ('in_progress','completed','cancelled')), CONSTRAINT "PK_trips_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" ADD CONSTRAINT "FK_trips_driver_id_user" FOREIGN KEY ("driver_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" ADD CONSTRAINT "FK_trips_harvest_area_id" FOREIGN KEY ("harvest_area_id") REFERENCES "harvest_areas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" ADD CONSTRAINT "FK_trips_weighing_station_id" FOREIGN KEY ("weighing_station_id") REFERENCES "weighing_stations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "receipts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" uuid, "driver_id" integer NOT NULL, "harvest_area_id" uuid NOT NULL, "weighing_station_id" uuid, "weight" numeric(10,3) NOT NULL, "amount" numeric(15,2) NOT NULL, "receipt_date" TIMESTAMP WITH TIME ZONE NOT NULL, "bill_code" character varying(50), "notes" text, "status" character varying(20) NOT NULL DEFAULT 'pending', "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), "approved_by" integer, "approved_at" TIMESTAMP WITH TIME ZONE, "rejected_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_receipts_status" CHECK ("status" IN ('pending','approved','rejected')), CONSTRAINT "CHK_receipts_weight" CHECK ("weight" > 0), CONSTRAINT "PK_receipts_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" ADD CONSTRAINT "FK_receipts_trip_id" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" ADD CONSTRAINT "FK_receipts_driver_id_user" FOREIGN KEY ("driver_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" ADD CONSTRAINT "FK_receipts_harvest_area_id" FOREIGN KEY ("harvest_area_id") REFERENCES "harvest_areas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" ADD CONSTRAINT "FK_receipts_weighing_station_id" FOREIGN KEY ("weighing_station_id") REFERENCES "weighing_stations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" ADD CONSTRAINT "FK_receipts_approved_by_user" FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "receipt_images" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "receipt_id" uuid NOT NULL, "image_url" text NOT NULL, "is_primary" boolean NOT NULL DEFAULT false, "uploaded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_receipt_images_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipt_images" ADD CONSTRAINT "FK_receipt_images_receipt_id" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "finance_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "receipt_id" uuid NOT NULL, "revenue" numeric(15,2) NOT NULL, "cost_driver" numeric(15,2) NOT NULL DEFAULT '0', "cost_harvest" numeric(15,2) NOT NULL DEFAULT '0', "other_cost" numeric(15,2) NOT NULL DEFAULT '0', "profit" numeric(15,2) GENERATED ALWAYS AS ((revenue - cost_driver - cost_harvest - other_cost)) STORED, "calculated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_finance_records_receipt_id" UNIQUE ("receipt_id"), CONSTRAINT "PK_finance_records_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "finance_records" ADD CONSTRAINT "FK_finance_records_receipt_id" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "table_name" character varying(50) NOT NULL, "record_id" uuid NOT NULL, "action" character varying(20) NOT NULL, "old_data" jsonb, "new_data" jsonb, "user_id" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_audit_logs_user_id" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" integer NOT NULL, "title" text NOT NULL, "message" text NOT NULL, "type" character varying(30), "is_read" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_notifications_user_id" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "vehicle_locations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "driver_id" integer NOT NULL, "trip_id" uuid NOT NULL, "latitude" numeric(10,8) NOT NULL, "longitude" numeric(11,8) NOT NULL, "speed" numeric(5,2), "accuracy" numeric(6,2), "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_vehicle_locations_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicle_locations" ADD CONSTRAINT "FK_vehicle_locations_driver_id" FOREIGN KEY ("driver_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicle_locations" ADD CONSTRAINT "FK_vehicle_locations_trip_id" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_receipts_status" ON "receipts" ("status") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_receipts_driver_status" ON "receipts" ("driver_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_receipts_area_status" ON "receipts" ("harvest_area_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_receipts_weighing_status" ON "receipts" ("weighing_station_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_receipts_approved" ON "receipts" ("approved_at") WHERE "status" = 'approved'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_harvest_areas_location" ON "harvest_areas" ("latitude", "longitude")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_weighing_stations_location" ON "weighing_stations" ("latitude", "longitude")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_vehicle_locations_trip_time" ON "vehicle_locations" ("trip_id", "timestamp" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_vehicle_locations_driver_time" ON "vehicle_locations" ("driver_id", "timestamp" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_vehicle_locations_timestamp" ON "vehicle_locations" ("timestamp" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_vehicle_locations_timestamp"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_vehicle_locations_driver_time"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_vehicle_locations_trip_time"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_weighing_stations_location"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_harvest_areas_location"`);
    await queryRunner.query(`DROP INDEX "public"."idx_receipts_approved"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_receipts_weighing_status"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_receipts_area_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_receipts_driver_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_receipts_status"`);

    await queryRunner.query(
      `ALTER TABLE "vehicle_locations" DROP CONSTRAINT "FK_vehicle_locations_trip_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicle_locations" DROP CONSTRAINT "FK_vehicle_locations_driver_id"`,
    );
    await queryRunner.query(`DROP TABLE "vehicle_locations"`);

    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_notifications_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "notifications"`);

    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_audit_logs_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "audit_logs"`);

    await queryRunner.query(
      `ALTER TABLE "finance_records" DROP CONSTRAINT "FK_finance_records_receipt_id"`,
    );
    await queryRunner.query(`DROP TABLE "finance_records"`);

    await queryRunner.query(
      `ALTER TABLE "receipt_images" DROP CONSTRAINT "FK_receipt_images_receipt_id"`,
    );
    await queryRunner.query(`DROP TABLE "receipt_images"`);

    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT "FK_receipts_approved_by_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT "FK_receipts_weighing_station_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT "FK_receipts_harvest_area_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT "FK_receipts_driver_id_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT "FK_receipts_trip_id"`,
    );
    await queryRunner.query(`DROP TABLE "receipts"`);

    await queryRunner.query(
      `ALTER TABLE "trips" DROP CONSTRAINT "FK_trips_weighing_station_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" DROP CONSTRAINT "FK_trips_harvest_area_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" DROP CONSTRAINT "FK_trips_driver_id_user"`,
    );
    await queryRunner.query(`DROP TABLE "trips"`);

    await queryRunner.query(`DROP TABLE "weighing_stations"`);

    await queryRunner.query(
      `ALTER TABLE "harvest_areas" DROP CONSTRAINT "FK_harvest_areas_owner_id_user"`,
    );
    await queryRunner.query(`DROP TABLE "harvest_areas"`);

    await queryRunner.query(
      `ALTER TABLE "driver_profiles" DROP CONSTRAINT "FK_driver_profiles_user_id_user"`,
    );
    await queryRunner.query(`DROP TABLE "driver_profiles"`);
  }
}
