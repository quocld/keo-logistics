/** Trạng thái vận hành bãi khai thác (trên đất / hợp đồng cây). */
export enum HarvestAreaStatusEnum {
  /** Chưa khai thác / chưa vận hành */
  inactive = 'inactive',
  /** Đang chuẩn bị: khảo sát, thủ tục trước khi vào khai thác */
  preparing = 'preparing',
  /** Đang hoạt động / đang khai thác */
  active = 'active',
  /** Tạm dừng */
  paused = 'paused',
  /** Chờ chu kỳ mua cây tiếp (vd sau 2–3 năm) */
  awaitingRenewal = 'awaiting_renewal',
  /** Đã hoàn thành chu kỳ / không còn khai thác */
  completed = 'completed',
}
