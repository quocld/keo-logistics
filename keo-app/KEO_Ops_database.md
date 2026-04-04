# KeoTram Ops - Database Schema

**Database:** PostgreSQL  
**Phiên bản:** 1.1 (đồng bộ schema + migration trong repo)  
**Ngày cập nhật:** 27/03/2026

## 1. Core Tables

### 1.1. Reuse existing auth tables (from boilerplate)

> Khong tao lai cac bang nay trong Ops schema de tranh conflict migration.
> Su dung truc tiep cac bang da co san: `user`, `role`, `status`, `file`, `session`.

#### `role` (existing)

```sql
id          INTEGER PRIMARY KEY
name        VARCHAR NOT NULL
```

#### `status` (existing)

```sql
id          INTEGER PRIMARY KEY
name        VARCHAR NOT NULL
```

#### `file` (existing)

```sql
id          UUID PRIMARY KEY DEFAULT uuid_generate_v4()
path        VARCHAR NOT NULL
```

#### `user` (existing)

```sql
id          SERIAL PRIMARY KEY
email       VARCHAR UNIQUE
password    VARCHAR
provider    VARCHAR NOT NULL DEFAULT 'email'
socialId    VARCHAR
firstName   VARCHAR
lastName    VARCHAR
photoId     UUID UNIQUE REFERENCES file(id)
roleId      INTEGER REFERENCES role(id)
statusId    INTEGER REFERENCES status(id)
createdAt   TIMESTAMP DEFAULT NOW()
updatedAt   TIMESTAMP DEFAULT NOW()
deletedAt   TIMESTAMP
```

#### `session` (existing)

```sql
id          SERIAL PRIMARY KEY
hash        VARCHAR NOT NULL
userId      INTEGER REFERENCES user(id)
createdAt   TIMESTAMP DEFAULT NOW()
updatedAt   TIMESTAMP DEFAULT NOW()
deletedAt   TIMESTAMP
```

### 1.2. `driver_profiles`

```sql
user_id               INTEGER PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE
vehicle_plate         VARCHAR(20)
license_number        VARCHAR(30)
rating                NUMERIC(3,2) DEFAULT 5.00
total_trips           INTEGER DEFAULT 0
avg_tons_per_trip     NUMERIC(8,2) DEFAULT 0
updated_at            TIMESTAMPTZ DEFAULT NOW()
```

### 1.3. `harvest_areas` (Khu khai thác)

`owner_id` = user **chủ thầu** trong hệ thống. Các cột `site_*` = **liên hệ phía chủ đất / chủ bãi** (hợp đồng mua cây), khác với `owner_id`.

```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
name                  VARCHAR(150) NOT NULL
owner_id              INTEGER REFERENCES "user"(id)

-- Google Maps
google_place_id       VARCHAR(100) UNIQUE
latitude              NUMERIC(10, 8)
longitude             NUMERIC(11, 8)
formatted_address     TEXT
address_components    JSONB
plus_code             VARCHAR(50)

area_hectares         NUMERIC(12,4)   -- diện tích (ha)
target_tons           NUMERIC(12,2)   -- số tấn dự kiến khai thác
current_tons          NUMERIC(12,2) DEFAULT 0

-- Trạng thái vận hành bãi (khai thác / hợp đồng cây)
status                VARCHAR(20) NOT NULL DEFAULT 'active'
                      CHECK (status IN ('inactive','preparing','active','paused','awaiting_renewal','completed'))

-- Liên hệ chủ bãi / chủ đất (mua cây); ngày mua & ghi chú chu kỳ (vd mua lại sau vài năm)
site_contact_name     VARCHAR(150)
site_contact_phone    VARCHAR(30)
site_contact_email    VARCHAR(255)
site_purchase_date    DATE
site_notes            TEXT

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
driver_id             INTEGER NOT NULL REFERENCES "user"(id)
harvest_area_id       UUID NOT NULL REFERENCES harvest_areas(id)
weighing_station_id   UUID NOT NULL REFERENCES weighing_stations(id)

start_time            TIMESTAMPTZ
end_time              TIMESTAMPTZ
estimated_distance    NUMERIC(8,2)

total_tons            NUMERIC(12,2) DEFAULT 0   -- cộng dồn weight receipt approved có trip_id
total_receipts        INTEGER DEFAULT 0        -- đếm receipt approved có trip_id
status                VARCHAR(20) NOT NULL DEFAULT 'planned'
                      CHECK (status IN ('planned','in_progress','completed','cancelled'))

created_at            TIMESTAMPTZ DEFAULT NOW()
updated_at            TIMESTAMPTZ DEFAULT NOW()
deleted_at            TIMESTAMPTZ
```

- `planned`: đã tạo chuyến, chưa start (hoặc chờ `start_time`).
- Mỗi tài xế tối đa **một** bản ghi `in_progress` tại một thời điểm (enforce ở application).

### 1.6. `receipts` (Core Table)

```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
trip_id               UUID REFERENCES trips(id)
driver_id             INTEGER NOT NULL REFERENCES "user"(id)
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
approved_by           INTEGER REFERENCES "user"(id)
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
user_id       INTEGER REFERENCES "user"(id)
created_at    TIMESTAMPTZ DEFAULT NOW()
```

### 1.10. `notifications`

```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id       INTEGER NOT NULL REFERENCES "user"(id)
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
    driver_id         INTEGER NOT NULL REFERENCES "user"(id),
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

- Finance chỉ tính khi `receipts.status = 'approved'`; bản ghi trong `finance_records`, `revenue = weight × weighing_stations.unit_price` (trạm active).
- Một `trip` đi từ một `harvest_area` đến một `weighing_station`.
- `receipt.trip_id` nullable. Khi có `trip_id`: backend kiểm tra cùng `driver_id`, cùng `harvest_area_id` với trip, trip đang `in_progress`; trạm cân trên phiếu lấy theo trip (auto-fill).
- Khi approve receipt có `trip_id`: cộng `weight` vào `trips.total_tons`, tăng `trips.total_receipts` (chỉ phiếu approved).
- Ảnh bill: ít nhất một URL hoặc file id trên mỗi lần submit (`receipt_images`).