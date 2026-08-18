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
              reject(new Error('Could not read YouTube permission state.'));
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
              reject(new Error('Could not request YouTube permission.'));
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
                  reject(new Error('Could not activate YouTube thumbnail buttons.'));
                  return;
                }

                if (!response?.ok) {
                  reject(
                    new Error(
                      response?.message ?? 'Could not activate YouTube thumbnail buttons.',
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
  };
}
