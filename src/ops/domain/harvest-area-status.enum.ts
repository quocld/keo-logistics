/** Trạng thái vận hành bãi khai thác (trên đất / hợp đồng cây). */
export enum HarvestAreaStatusEnum {
  /** Chưa khai thác / chưa vận hành */
  inactive = 'inactive',
  /** Đang hoạt động */
  active = 'active',
  /** Tạm dừng */
  paused = 'paused',
  /** Đã hoàn thành chu kỳ / không còn khai thác */
  completed = 'completed',
}
