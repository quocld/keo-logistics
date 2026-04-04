export const EXPO_PUSH_QUEUE_NAME = 'expo_push';
export const EXPO_PUSH_JOB_SEND_NAME = 'expo_push.send';

export type ExpoPushSendJobData = {
  notificationId: string;
  /**
   * Data payload delivered to client (expo-notifications).
   * Keep it small (IDs only) so the job remains efficient.
   */
  pushData: {
    type: string;
    receiptId?: string;
    status?: string;
  };
};
