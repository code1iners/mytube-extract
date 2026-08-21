import {
  type CreateDownloadJobInput,
  type DownloadJob,
} from '../../domain/download-job/download-job';

/** 실패 알림에서 새 job을 만들 때 재사용할 입력. */
export type DownloadJobRetryInput = Pick<
  CreateDownloadJobInput,
  'apiBaseUrl' | 'quality' | 'sourceUrl' | 'type'
> & {
  /** 완료 시 로컬 저장에 사용할 파일명. */
  localFilename?: string;
};

/** 실패 알림 재시도 입력을 보관하는 chrome.storage.local key. */
export const RETRYABLE_DOWNLOAD_NOTIFICATIONS_STORAGE_KEY =
  'retryableDownloadNotifications';

/** 다운로드 완료·실패를 데스크톱 알림으로 전달하는 adapter. */
export type DownloadNotificationsAdapter = {
  /** 완료된 job 알림을 표시한다. */
  showCompleted(job: DownloadJob): Promise<void>;
  /** 실패 사유와 재시도 동작이 있는 알림을 표시한다. */
  showFailed(job: DownloadJob, retryInput: DownloadJobRetryInput): Promise<void>;
  /** 알림 버튼에서 전달된 재시도 입력을 구독한다. */
  subscribeRetry(
    listener: (retryInput: DownloadJobRetryInput) => void | Promise<unknown>,
  ): () => void;
};

/** 개발용 미리보기에서 사용할 알림 미표시 adapter. */
export function createNoopDownloadNotificationsAdapter(): DownloadNotificationsAdapter {
  return {
    showCompleted: async () => {},
    showFailed: async () => {},
    subscribeRetry: () => () => {},
  };
}

/** Chrome notifications API를 사용하는 다운로드 알림 adapter를 만든다. */
export function createDownloadNotificationsAdapter(
  chromeApi: typeof chrome = chrome,
): DownloadNotificationsAdapter {
  /** 실패 알림 ID별 재시도 입력의 메모리 cache. 영속 저장소 fallback도 함께 사용한다. */
  const retryInputs = new Map<string, DownloadJobRetryInput>();
  /** 재시도 입력 listener 목록. service worker가 시작될 때 manager가 등록한다. */
  const retryListeners = new Set<
    (retryInput: DownloadJobRetryInput) => void | Promise<unknown>
  >();
  /** 여러 실패 알림이 동시에 저장될 때 read-modify-write가 겹치지 않게 직렬화한다. */
  let storageMutation = Promise.resolve();

  chromeApi.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    if (buttonIndex !== 0) {
      return;
    }

    /** 현재 service worker 메모리에 남아 있는 재시도 입력. */
    const retryInput = retryInputs.get(notificationId);

    if (retryInput) {
      retryInputs.delete(notificationId);
      dispatchRetry(notificationId, retryInput);
      return;
    }

    void takeRetryInput(notificationId)
      .then((storedRetryInput) => {
        if (storedRetryInput) {
          dispatchRetry(notificationId, storedRetryInput);
        }
      })
      .catch(() => {
        // 재시도 입력을 읽지 못하면 알림 버튼을 조용히 무시하고 다음 알림을 기다린다.
      });
  });

  chromeApi.notifications.onClosed.addListener((notificationId) => {
    if (!isFailureNotificationId(notificationId)) {
      return;
    }

    retryInputs.delete(notificationId);
    void removeRetryInput(notificationId).catch(() => {
      // 알림 정리 실패는 다음 재시도 입력 저장을 막지 않도록 무시한다.
    });
  });

  return {
    showCompleted(job) {
      return createNotification(chromeApi, getNotificationId('completed', job.jobId), {
        iconUrl: chromeApi.runtime.getURL('icon-128.png'),
        message: '추출한 파일을 다운로드했습니다.',
        title: '다운로드 완료',
        type: 'basic',
      });
    },
    async showFailed(job, retryInput) {
      /** 실패 알림 ID. */
      const notificationId = getNotificationId('failed', job.jobId);

      retryInputs.set(notificationId, retryInput);

      try {
        await saveRetryInput(notificationId, retryInput);
        await createNotification(chromeApi, notificationId, {
          buttons: [{ title: '다시 시도' }],
          iconUrl: chromeApi.runtime.getURL('icon-128.png'),
          message: job.message || '다운로드에 실패했습니다.',
          title: '다운로드 실패',
          type: 'basic',
        });
      } catch (error) {
        retryInputs.delete(notificationId);
        await removeRetryInput(notificationId).catch(() => {});
        throw error;
      }
    },
    subscribeRetry(listener) {
      retryListeners.add(listener);

      return function unsubscribeDownloadNotificationRetry() {
        retryListeners.delete(listener);
      };
    },
  };

  /** storage에 저장된 재시도 입력을 읽고 사용 처리한다. */
  function takeRetryInput(notificationId: string): Promise<DownloadJobRetryInput | undefined> {
    /** 사용 처리 후 반환할 재시도 입력. */
    let retryInput: DownloadJobRetryInput | undefined;

    return enqueueStorageMutation(async () => {
      const retryInputsByNotificationId = await loadRetryInputs();

      retryInput = retryInputsByNotificationId[notificationId];
      delete retryInputsByNotificationId[notificationId];
      await saveRetryInputs(retryInputsByNotificationId);
    }).then(() => retryInput);
  }

  /** 재시도 입력을 listener들에게 전달하고 저장된 입력도 제거한다. */
  function dispatchRetry(notificationId: string, retryInput: DownloadJobRetryInput): void {
    void removeRetryInput(notificationId).catch(() => {
      // 메모리 cache가 이미 소비한 입력이므로 정리 실패를 재시도 동작과 분리한다.
    });
    retryListeners.forEach((listener) => {
      void Promise.resolve(listener(retryInput)).catch(() => {
        // 재시도 job 생성 오류는 manager가 새 job 상태로 처리한다.
      });
    });
  }

  /** 재시도 입력을 저장한다. */
  function saveRetryInput(
    notificationId: string,
    retryInput: DownloadJobRetryInput,
  ): Promise<void> {
    return enqueueStorageMutation(async () => {
      const retryInputsByNotificationId = await loadRetryInputs();

      retryInputsByNotificationId[notificationId] = retryInput;
      await saveRetryInputs(retryInputsByNotificationId);
    });
  }

  /** 재시도 입력 하나를 저장소에서 삭제한다. */
  function removeRetryInput(notificationId: string): Promise<void> {
    return enqueueStorageMutation(async () => {
      const retryInputsByNotificationId = await loadRetryInputs();

      delete retryInputsByNotificationId[notificationId];
      await saveRetryInputs(retryInputsByNotificationId);
    });
  }

  /** 재시도 입력 storage read-modify-write 작업을 직렬화한다. */
  function enqueueStorageMutation<T>(mutation: () => Promise<T>): Promise<T> {
    const nextMutation = storageMutation.then(mutation);

    storageMutation = nextMutation.then(
      () => undefined,
      () => undefined,
    );

    return nextMutation;
  }

  /** 저장된 재시도 입력 전체를 읽는다. */
  function loadRetryInputs(): Promise<Record<string, DownloadJobRetryInput>> {
    return new Promise((resolve, reject) => {
      chromeApi.storage.local.get(
        [RETRYABLE_DOWNLOAD_NOTIFICATIONS_STORAGE_KEY],
        (items) => {
          if (chromeApi.runtime.lastError) {
            reject(new Error('Could not load the download notification retry inputs.'));
            return;
          }

          const storedRetryInputs = items[RETRYABLE_DOWNLOAD_NOTIFICATIONS_STORAGE_KEY];

          resolve(
            storedRetryInputs && typeof storedRetryInputs === 'object'
              ? (storedRetryInputs as Record<string, DownloadJobRetryInput>)
              : {},
          );
        },
      );
    });
  }

  /** 저장된 재시도 입력 전체를 쓴다. */
  function saveRetryInputs(
    retryInputsByNotificationId: Record<string, DownloadJobRetryInput>,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      chromeApi.storage.local.set(
        { [RETRYABLE_DOWNLOAD_NOTIFICATIONS_STORAGE_KEY]: retryInputsByNotificationId },
        () => {
          if (chromeApi.runtime.lastError) {
            reject(new Error('Could not save the download notification retry inputs.'));
            return;
          }

          resolve();
        },
      );
    });
  }
}

/** 완료·실패 상태를 구분하는 안정적인 Chrome notification ID를 만든다. */
function getNotificationId(status: 'completed' | 'failed', jobId: string): string {
  return `download-job-${status}-${jobId}`;
}

/** 재시도 입력을 보관하는 실패 알림 ID인지 확인한다. */
function isFailureNotificationId(notificationId: string): boolean {
  return notificationId.startsWith('download-job-failed-');
}

/** Chrome notifications.create callback API를 Promise 경계로 감싼다. */
function createNotification(
  chromeApi: typeof chrome,
  notificationId: string,
  options: chrome.notifications.NotificationCreateOptions,
): Promise<void> {
  return new Promise((resolve, reject) => {
    chromeApi.notifications.create(notificationId, options, () => {
      if (chromeApi.runtime.lastError) {
        reject(new Error('Could not show the download notification.'));
        return;
      }

      resolve();
    });
  });
}
