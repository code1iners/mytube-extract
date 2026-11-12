import {
  type YoutubeOverlayEnableResponse,
  YOUTUBE_OVERLAY_ENABLE_MESSAGE_TYPE,
} from '../../features/youtube-overlay/youtube-overlay-message';

/** YouTube 선택 Host Permission. */
export const YOUTUBE_HOST_PERMISSION = 'https://www.youtube.com/*';

/** YouTube 썸네일 Overlay 권한 adapter. */
export type YoutubeOverlayAdapter = {
  /** 선택 Host Permission 상태를 읽는다. */
  isEnabled(): Promise<boolean>;
  /** 사용자 gesture에서 권한을 요청하고 현재 탭에 Overlay를 활성화한다. */
  requestAndEnable(): Promise<boolean>;
  /** 선택 Host Permission을 해제한다. Chrome이 실제로 해제했으면 true다. 해제 뒤에는 Background가 새로 주입하지 않는다. */
  disable(): Promise<boolean>;
};

/** Chrome YouTube Overlay 권한 adapter를 만든다. */
export function createYoutubeOverlayAdapter(
  chromeApi: typeof chrome = chrome,
): YoutubeOverlayAdapter {
  return {
    isEnabled() {
      return new Promise((resolve, reject) => {
        chromeApi.permissions.contains(
          { origins: [YOUTUBE_HOST_PERMISSION] },
          (granted) => {
            if (chromeApi.runtime.lastError) {
              reject(new Error('YouTube 권한 상태를 확인하지 못했어요.'));
              return;
            }

            resolve(granted);
          },
        );
      });
    },
    requestAndEnable() {
      return new Promise((resolve, reject) => {
        chromeApi.permissions.request(
          { origins: [YOUTUBE_HOST_PERMISSION] },
          (granted) => {
            if (chromeApi.runtime.lastError) {
              reject(new Error('YouTube 권한을 요청하지 못했어요.'));
              return;
            }

            if (!granted) {
              resolve(false);
              return;
            }

            chromeApi.runtime.sendMessage(
              { type: YOUTUBE_OVERLAY_ENABLE_MESSAGE_TYPE },
              (response: YoutubeOverlayEnableResponse | undefined) => {
                if (chromeApi.runtime.lastError) {
                  reject(new Error('썸네일 버튼을 켜지 못했어요.'));
                  return;
                }

                if (!response?.ok) {
                  reject(
                    new Error(
                      response?.message ?? '썸네일 버튼을 켜지 못했어요.',
                    ),
                  );
                  return;
                }

                resolve(true);
              },
            );
          },
        );
      });
    },
    disable() {
      return new Promise((resolve, reject) => {
        chromeApi.permissions.remove(
          { origins: [YOUTUBE_HOST_PERMISSION] },
          (removed) => {
            if (chromeApi.runtime.lastError) {
              reject(new Error('썸네일 버튼을 끄지 못했어요.'));
              return;
            }

            resolve(removed);
          },
        );
      });
    },
  };
}
