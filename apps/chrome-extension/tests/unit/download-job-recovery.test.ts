import { describe, expect, it, vi } from 'vitest';
import {
  ensureJobRecoveryAlarm,
  JOB_RECOVERY_ALARM_NAME,
  JOB_RECOVERY_ALARM_PERIOD_MINUTES,
} from '../../src/features/download-jobs/download-job-recovery';

describe('download job recovery alarm', () => {
  it('does not replace an alarm that already exists', async () => {
    /** 이미 등록된 recovery alarm. */
    const existingAlarm = { name: JOB_RECOVERY_ALARM_NAME, scheduledTime: 123 };
    /** 테스트용 alarms API. */
    const alarms = {
      create: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(existingAlarm),
    };

    await ensureJobRecoveryAlarm(alarms);

    expect(alarms.get).toHaveBeenCalledWith(JOB_RECOVERY_ALARM_NAME);
    expect(alarms.create).not.toHaveBeenCalled();
  });

  it('creates the recovery alarm when the browser does not keep it', async () => {
    /** 테스트용 alarms API. */
    const alarms = {
      create: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(undefined),
    };

    await ensureJobRecoveryAlarm(alarms);

    expect(alarms.create).toHaveBeenCalledWith(JOB_RECOVERY_ALARM_NAME, {
      periodInMinutes: JOB_RECOVERY_ALARM_PERIOD_MINUTES,
    });
  });
});
