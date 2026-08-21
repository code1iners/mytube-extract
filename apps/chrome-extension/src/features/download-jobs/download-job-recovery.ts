/** service worker가 깨어날 때 진행 중 job 복구에 사용하는 반복 알람 이름. */
export const JOB_RECOVERY_ALARM_NAME = 'download-job-recovery';
/** 복구 알람 주기(분). Chrome은 배포판 확장에서 1분 미만 주기를 허용하지 않는다. */
export const JOB_RECOVERY_ALARM_PERIOD_MINUTES = 1;

/** job recovery alarm을 확인·생성하는 데 필요한 Chrome API. */
export type JobRecoveryAlarmApi = Pick<typeof chrome.alarms, 'create' | 'get'>;

/** 브라우저 재시작이나 alarm 유실 뒤에도 recovery alarm이 존재하도록 보장한다. */
export async function ensureJobRecoveryAlarm(
  alarms: JobRecoveryAlarmApi,
): Promise<void> {
  const existingAlarm = await alarms.get(JOB_RECOVERY_ALARM_NAME);

  if (existingAlarm) {
    return;
  }

  await alarms.create(JOB_RECOVERY_ALARM_NAME, {
    periodInMinutes: JOB_RECOVERY_ALARM_PERIOD_MINUTES,
  });
}
