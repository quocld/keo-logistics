# KeoTram Ops - Database Schema

**Database:** PostgreSQL  
**Phiên bản:** 1.0 (MVP - Manual Entry + Approval Flow)  
**Ngày:** 27/03/2026

## 1. Core Tables

### 1.1. `users`

```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
phone           VARCHAR(15) UNIQUE NOT NULL
email           VARCHAR(255) UNIQUE
password_hash   TEXT NOT NULL
full_name       VARCHAR(100) NOT NULL
role            VARCHAR(20) NOT NULL CHECK (role IN ('driver', 'owner', 'admin'))
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
deleted_at      TIMESTAMPTZ
created_by      UUID REFERENCES users(id)
updated_by      UUID REFERENCES users(id)
```

### 1.2. `driver_profiles`

```sql
user_id               UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE
vehicle_plate         VARCHAR(20)
license_number        VARCHAR(30)
rating                NUMERIC(3,2) DEFAULT 5.00
total_trips           INTEGER DEFAULT 0
avg_tons_per_trip     NUMERIC(8,2) DEFAULT 0
updated_at            TIMESTAMPTZ DEFAULT NOW()
```

### 1.3. `harvest_areas` (Khu khai thac)

```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
name                  VARCHAR(150) NOT NULL
owner_id              UUID REFERENCES users(id)

-- Google Maps
google_place_id       VARCHAR(100) UNIQUE
latitude              NUMERIC(10, 8)
longitude             NUMERIC(11, 8)
formatted_address     TEXT
address_components    JSONB
plus_code             VARCHAR(50)

target_tons           NUMERIC(12,2)
current_tons          NUMERIC(12,2) DEFAULT 0
status                VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','completed','paused'))

created_at            TIMESTAMPTZ DEFAULT NOW()
updated_at            TIMESTAMPTZ DEFAULT NOW()
deleted_at            TIMESTAMPTZ
```

### 1.4. `weighing_stations` (Tram can)

```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
name                  VARCHAR(150) NOT NULL
code                  VARCHAR(50) UNIQUE

-- Google Maps
google_place_id       VARCHAR(100)
latitude              NUMERIC(10, 8) NOT NULL
longitude             NUMERIC(11, 8) NOT NULL
formatted_address     TEXT NOT NULL

unit_price            NUMERIC(12,2) NOT NULL -- Gia van chuyen / tan theo tram
status                VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive','maintenance'))

notes                 TEXT
created_at            TIMESTAMPTZ DEFAULT NOW()
updated_at            TIMESTAMPTZ DEFAULT NOW()
deleted_at            TIMESTAMPTZ
```

### 1.5. `trips`

```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
driver_id             UUID NOT NULL REFERENCES users(id)
harvest_area_id       UUID NOT NULL REFERENCES harvest_areas(id)
weighing_station_id   UUID NOT NULL REFERENCES weighing_stations(id)

start_time            TIMESTAMPTZ
end_time              TIMESTAMPTZ
estimated_distance    NUMERIC(8,2)

total_tons            NUMERIC(12,2) DEFAULT 0
total_receipts        INTEGER DEFAULT 0
status                VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','cancelled'))

created_at            TIMESTAMPTZ DEFAULT NOW()
updated_at            TIMESTAMPTZ DEFAULT NOW()
deleted_at            TIMESTAMPTZ
```

### 1.6. `receipts` (Core Table)

```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
trip_id               UUID REFERENCES trips(id)
driver_id             UUID NOT NULL REFERENCES users(id)
harvest_area_id       UUID NOT NULL REFERENCES harvest_areas(id)
weighing_station_id   UUID REFERENCES weighing_stations(id)

weight                NUMERIC(10,3) NOT NULL CHECK (weight > 0)
amount                NUMERIC(15,2) NOT NULL
receipt_date          TIMESTAMPTZ NOT NULL
bill_code             VARCHAR(50)
notes                 TEXT

status                VARCHAR(20) DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'rejected'))

submitted_at          TIMESTAMPTZ DEFAULT NOW()
approved_by           UUID REFERENCES users(id)
approved_at           TIMESTAMPTZ
rejected_reason       TEXT

created_at            TIMESTAMPTZ DEFAULT NOW()
updated_at            TIMESTAMPTZ DEFAULT NOW()
deleted_at            TIMESTAMPTZ
```

### 1.7. `receipt_images`

```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
receipt_id    UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE
image_url     TEXT NOT NULL
is_primary    BOOLEAN DEFAULT false
uploaded_at   TIMESTAMPTZ DEFAULT NOW()
```

### 1.8. `finance_records`

```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
receipt_id        UUID UNIQUE NOT NULL REFERENCES receipts(id) ON DELETE CASCADE
revenue           NUMERIC(15,2) NOT NULL
cost_driver       NUMERIC(15,2) DEFAULT 0
cost_harvest      NUMERIC(15,2) DEFAULT 0
other_cost        NUMERIC(15,2) DEFAULT 0
profit            NUMERIC(15,2) GENERATED ALWAYS AS
                  (revenue - cost_driver - cost_harvest - other_cost) STORED
calculated_at     TIMESTAMPTZ DEFAULT NOW()
```

### 1.9. `audit_logs`

```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
table_name    VARCHAR(50) NOT NULL
record_id     UUID NOT NULL
action        VARCHAR(20) NOT NULL
old_data      JSONB
new_data      JSONB
user_id       UUID REFERENCES users(id)
created_at    TIMESTAMPTZ DEFAULT NOW()
```

### 1.10. `notifications`

```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id       UUID NOT NULL REFERENCES users(id)
title         TEXT NOT NULL
message       TEXT NOT NULL
type          VARCHAR(30)
is_read       BOOLEAN DEFAULT false
created_at    TIMESTAMPTZ DEFAULT NOW()
```

## 2. Important Indexes

```sql
-- Receipts
CREATE INDEX idx_receipts_status ON receipts(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_receipts_driver_status ON receipts(driver_id, status);
CREATE INDEX idx_receipts_area_status ON receipts(harvest_area_id, status);
CREATE INDEX idx_receipts_weighing_status ON receipts(weighing_station_id, status);
CREATE INDEX idx_receipts_approved ON receipts(approved_at) WHERE status = 'approved';

-- Locations
CREATE INDEX idx_harvest_areas_location ON harvest_areas(latitude, longitude);
CREATE INDEX idx_weighing_stations_location ON weighing_stations(latitude, longitude);
```

## 3. Cap nhat Database (Them bang)

```sql
CREATE TABLE vehicle_locations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id         UUID NOT NULL REFERENCES users(id),
    trip_id           UUID NOT NULL REFERENCES trips(id),        -- Bat buoc lien ket voi trip
    latitude          NUMERIC(10, 8) NOT NULL,
    longitude         NUMERIC(11, 8) NOT NULL,
    speed             NUMERIC(5,2),                               -- km/h
    accuracy          NUMERIC(6,2),                               -- met
    timestamp         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes toi uu cho query realtime & lich su
CREATE INDEX idx_vehicle_locations_trip_time ON vehicle_locations(trip_id, timestamp DESC);
CREATE INDEX idx_vehicle_locations_driver_time ON vehicle_locations(driver_id, timestamp DESC);
CREATE INDEX idx_vehicle_locations_timestamp ON vehicle_locations(timestamp DESC);
```

## 4. Logic hoat dong chinh

- Driver bat dau `trip` -> Backend ghi nhan va bat dau nhan vi tri.
- Driver gui vi tri lien tuc -> Luu vao `vehicle_locations`.
- Owner mo Live Map -> Backend tra ve vi tri moi nhat cua tung `trip` dang `in_progress`.
- Khi `trip` ket thuc -> Dung nhan vi tri (hoac van luu nhung khong hien thi realtime).

## 5. Business Rules

- Finance chi tinh khi `receipts.status = 'approved'`.
- `revenue = weight * weighing_stations.unit_price` (lay tu tram can).
- Mot `trip` di tu 1 `harvest_area` den 1 `weighing_station`.
- `receipt` thuoc `trip` hoac co the doc lap (`trip_id` nullable).