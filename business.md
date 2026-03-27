# KeoTram Ops – Business Requirements Document (BRD / Product Spec)

| Thuộc tính   | Giá trị                                      |
| ------------ | -------------------------------------------- |
| Phiên bản    | 1.0 (MVP hoàn chỉnh)                         |
| Ngày         | 27/03/2026                                   |
| Tác giả      | Grok (dựa trên toàn bộ yêu cầu đã trao đổi) |

**Lưu ý:** Đây là mô tả phạm vi sản phẩm / tầm nhìn MVP. Đối chiếu với mã nguồn backend hiện tại xem [mục 12](#12-đối-chiếu-triển-khai-backend-repo-keo-be).

---

## 1. Giới thiệu & mục tiêu kinh doanh

**Tên sản phẩm:** KeoTram Ops  
**Ngành:** Vận chuyển & khai thác gỗ keo tràm

**Mục tiêu chính:**  
Xây dựng nền tảng quản lý vận hành + tài chính thời gian thực, thay thế hoàn toàn quy trình thủ công (giấy + Excel), giúp chủ thầu biết chính xác lời/lỗ, kiểm soát tài xế, giảm thất thoát và ra quyết định nhanh.

**Giá trị cốt lõi:**

- Biết lời/lỗ theo ngày/giờ/khu/trạm cân/tài xế
- Kiểm soát chặt chẽ từng chuyến hàng qua approval
- Theo dõi realtime vị trí tài xế (xe đang bận hay rảnh)
- Giảm tối đa gian lận nhờ ảnh bill + audit trail + tracking

---

## 2. Bài toán hiện tại

- Quản lý hoàn toàn thủ công (giấy tờ + Excel)
- Dữ liệu phân tán, không đồng bộ
- Không biết chính xác lời/lỗ thực tế
- Khó đánh giá hiệu quả tài xế
- Dễ xảy ra gian lận (bill giả, chỉnh sửa sau, fake trip, cân sai…)

---

## 3. Giải pháp tổng thể

Hệ thống gồm 3 thành phần:

| Thành phần                         | Mô tả ngắn                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------- |
| **Driver App (Mobile)**            | Tài xế nhập liệu + tracking vị trí                                         |
| **Owner App (Mobile + Web)**       | Chủ thầu quản lý, phê duyệt, xem dashboard realtime                        |
| **Backend + Admin Dashboard (Web)** | Xử lý logic, tính toán tài chính, lưu trữ, chống gian lận                  |

Không có OCR ở MVP (sẽ làm sau). Hiện tại dùng manual entry + chụp ảnh bill.

---

## 4. User roles & quyền hạn

| Role    | Mô tả                    | App truy cập              | Quyền chính                                                                 |
| ------- | ------------------------ | ------------------------- | ---------------------------------------------------------------------------- |
| Driver  | Tài xế vận chuyển        | Driver App (Mobile)       | Nhập receipt, bắt đầu Trip, tracking vị trí (bắt buộc)                      |
| Owner   | Chủ thầu / chủ bãi       | Owner App (Mobile + Web)  | Phê duyệt receipt, xem dashboard & map, quản lý khu & trạm cân              |
| Admin   | Quản trị hệ thống        | Admin Dashboard (Web)     | Quản lý user, override, audit log                                           |

---

## 5. Core business flow (trục xương sống)

**Driver**

1. Bắt đầu Trip (khu khai thác → trạm cân)
2. Nhập manual receipt + chụp ảnh bill
3. Submit → trạng thái Pending

**Owner**

1. Xem danh sách Pending
2. Xem ảnh + dữ liệu → Approve / Reject (bắt buộc lý do nếu reject)

**Backend**

1. Receipt Approved → tính `revenue = weight × unit_price` (theo trạm cân)
2. Tính profit → cập nhật dashboard realtime
3. Tracking vị trí driver đang chạy nền

**Driver (kết thúc)**

- Khi Trip hoàn thành → kết thúc Trip → xe chuyển sang trạng thái rảnh

---

## 6. Feature list – Driver App

### 6.1 Authentication

- Login bằng số điện thoại + OTP
- Logout

### 6.2 Trip management

- Tạo Trip mới: chọn Harvest Area → Weighing Station
- Bắt đầu / kết thúc Trip
- Xem danh sách Trip của mình

### 6.3 Receipt (core)

- Nhập manual: weight (tấn), amount (VND), receipt_date, bill_code, notes
- Bắt buộc chọn Harvest Area & Weighing Station
- Chụp ảnh bill (hỗ trợ nhiều ảnh)
- Submit → Pending
- Offline mode: lưu tạm → sync khi có mạng

### 6.4 Live tracking (bắt buộc)

- Khi Trip `in_progress` → app tự động chạy nền (background service)
- Gửi vị trí GPS định kỳ (10–15 giây khi di chuyển, 30–60 giây khi dừng)
- Không có nút tắt tracking
- Driver xem được vị trí của chính mình

### 6.5 History

- Xem danh sách receipt & trip
- Chi tiết receipt (dữ liệu + ảnh + trạng thái)

### 6.6 Profile

- Thông tin cá nhân, rating, tổng tấn đã vận chuyển

---

## 7. Feature list – Owner App

### 7.1 Dashboard realtime (core)

- Doanh thu / chi phí / lợi nhuận hôm nay & tháng
- Tổng tấn vận chuyển
- Số receipt Pending
- Số xe đang bận / đang rảnh
- Top driver hiệu quả

### 7.2 Live Driver Map (chức năng key)

- Bản đồ Google Maps hiển thị tất cả tài xế
- Marker: tên driver, trạng thái (đang bận / rảnh), khu xuất phát, trạm đích
- Lọc: xe đang bận / xe đang rảnh / tất cả
- Click marker xem chi tiết Trip
- Cập nhật realtime (mỗi 10–20 giây)

### 7.3 Receipt approval

- Danh sách Pending (filter theo ngày, khu, trạm, driver)
- Xem ảnh bill full size
- Approve hoặc Reject (bắt buộc nhập lý do khi reject)
- Sau approve → dữ liệu vào finance engine ngay lập tức

### 7.4 Harvest area management

- List khu + Google Maps (latitude, longitude, address)
- Tiến độ target tấn, current tons, lời/lỗ từng khu

### 7.5 Weighing station management

- List trạm cân + Google Maps + `unit_price` (/tấn)
- Giá vận chuyển được lấy theo trạm cân

### 7.6 Driver management

- List driver + performance
- Xem xe đang bận/rảnh

### 7.7 Report & alert

- Báo cáo theo ngày/tuần/tháng/khu/trạm/driver
- Alert: receipt pending quá lâu, xe dừng bất thường, xe đi sai hướng, driver có nhiều reject

---

## 8. Feature list – Admin Dashboard

- User management (CRUD + role)
- Receipt control & override approve/reject
- Audit log đầy đủ
- Master data: Harvest Areas, Weighing Stations
- System monitoring

---

## 9. Finance engine

- Chỉ tính khi receipt **Approved**
- `Revenue = weight × unit_price` (lấy từ Weighing Station)
- `Profit = Revenue − Cost` (driver cost + harvesting cost + other)
- Aggregation theo: khu, trạm cân, driver, thời gian

---

## 10. Anti-fraud & security

- Ảnh bill bắt buộc
- Approval workflow 2 lớp (Driver submit → Owner approve)
- Audit log: ai làm gì, lúc nào, sửa gì
- Detect duplicate `bill_code`
- Tracking realtime → phát hiện fake trip, đi sai lộ trình, dừng lâu bất thường
- Alert tự động cho Owner

---

## 11. Data model (tóm tắt các bảng chính)

- `users` + `driver_profiles`
- `harvest_areas` (có Google Maps)
- `weighing_stations` (có `unit_price` + Google Maps)
- `trips`
- `receipts` (status: pending / approved / rejected)
- `receipt_images`
- `finance_records`
- `vehicle_locations` (tracking realtime; trong một số tài liệu gọi là driver locations)
- `audit_logs`
- `notifications`

*(Chi tiết schema: xem `KEO_Ops_database.md` và migration trong repo.)*

---

## 12. Đối chiếu triển khai backend (repo keo-be)

**Kết luận:** Tài liệu BRD **không** khớp 100% với backend hiện tại. BRD mô tả **toàn bộ MVP**; repo mới triển khai **một phần** nền (API + DB), phần lớn màn hình/dashboard/map nằm ở client hoặc chưa làm.

| Hạng mục trong BRD                         | Trạng thái trong keo-be (backend) |
| ------------------------------------------ | --------------------------------- |
| Đăng ký / auth                             | Email + password + JWT (boilerplate); **không** có login OTP số điện thoại |
| Harvest Area                               | `POST` tạo khu (admin/owner); **chưa** có API list/detail/update đầy đủ như mục 7.4 |
| Weighing Station                           | `POST` tạo trạm (admin); **chưa** có API list như mục 7.5 |
| Receipt submit / approve / reject          | **Có** (`/receipts`, role driver / owner / admin); owner chỉ duyệt khu thuộc mình |
| Ảnh bill bắt buộc, nhiều ảnh               | Bảng `receipt_images` có trong DB; **chưa** ghi ảnh từ API submit (DTO có field URL nhưng chưa persist) |
| Finance engine (`revenue`, `profit`, …)    | Bảng `finance_records` có trong DB; **chưa** tạo bản ghi khi approve; **chưa** tính `weight × unit_price` tự động |
| Trip (bắt đầu/kết thúc, list)              | Bảng `trips` có trong DB; **chưa** có API |
| Live tracking / map                        | Bảng `vehicle_locations` có trong DB; **chưa** có API ghi/đọc vị trí |
| Dashboard, báo cáo, alert                  | **Chưa** có trong backend như mô tả mục 7.1, 7.7 |
| Audit log, notifications                   | Bảng có trong DB; **chưa** có service/API theo BRD |
| Duplicate `bill_code`, anti-fraud nâng cao | **Chưa** thấy rule kiểm tra trùng |
| Admin user CRUD                            | **Có** (module Users, role admin) — một phần mục 8 |

*Nếu cần bám sát BRD 100%, cần bổ sung lần lượt: API Trip & tracking, finance khi approve, lưu ảnh receipt, endpoint đọc/ghi phục vụ Owner dashboard/map, và các rule chống gian lận/alert.*
