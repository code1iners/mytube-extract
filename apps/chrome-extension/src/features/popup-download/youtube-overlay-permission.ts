import { type YoutubeOverlayAdapter } from '../../adapters/chrome/youtube-overlay';

/** 썸네일 버튼 권한 상태. */
export type YoutubeOverlayStatus = 'checking' | 'disabled' | 'enabled' | 'requesting' | 'denied' | 'error';

/** 헤더 격자 아이콘의 점. `off`는 빨간 점(아직 켜지 않음·확인 중), `on`은 초록 점, `problem`은 crimson 점(거부·오류)이다. */
export type YoutubeOverlayIndicator = 'off' | 'on' | 'problem';

/** YouTube 썸네일 Overlay 권한 상태. */
export type YoutubeOverlaySnapshot = {
  /** 선택 Host Permission 활성화 여부. */
  enabled: boolean;
  /** Overlay 권한 상태. */
  status: YoutubeOverlayStatus;
  /** 헤더 격자 아이콘에 보일 점. status에서 도출한다. */
  indicator: YoutubeOverlayIndicator;
  /** 권한 상태 문장. 거부·오류면 설정 화면의 이유 한 줄로 보인다. */
  message: string;
  /** 스위치를 끄지 못한 이유. 권한이 남아 있어 켜짐 상태 그대로 이 한 줄만 알린다. 다음 권한 변경 때 비운다. */
  turnOffError: string | null;
};

/** 권한 상태별 기본 문장. */
const YOUTUBE_OVERLAY_MESSAGES: Record<YoutubeOverlayStatus, string> = {
  checking: '썸네일 버튼 권한을 확인하고 있어요.',
  denied: '권한이 거부되어 표시하지 않아요',
  disabled: '켜면 YouTube 썸네일에서 바로 추출할 수 있어요.',
  enabled: '썸네일 버튼이 켜져 있어요.',
  error: '썸네일 버튼 권한을 확인하지 못했어요.',
  requesting: '썸네일 버튼 권한을 요청하고 있어요.',
};

/** 켜기 요청이 실패했을 때의 이유. */
const YOUTUBE_OVERLAY_ENABLE_FAILED_MESSAGE = '썸네일 버튼을 켜지 못했어요. 다시 요청해 보세요.';
/** 끄기(권한 해제)가 실패했을 때의 이유. */
const YOUTUBE_OVERLAY_DISABLE_FAILED_MESSAGE = '썸네일 버튼을 끄지 못했어요. 다시 시도해 보세요.';

/** 권한 상태로 snapshot 값을 만든다. 헤더 점은 상태에서만 도출해 설정 행과 어긋나지 않게 한다. */
export function createYoutubeOverlaySnapshot(
  status: YoutubeOverlayStatus,
  message = YOUTUBE_OVERLAY_MESSAGES[status],
): YoutubeOverlaySnapshot {
  return {
    enabled: status === 'enabled',
    indicator: status === 'enabled' ? 'on' : status === 'denied' || status === 'error' ? 'problem' : 'off',
    message,
    status,
    turnOffError: null,
  };
}

/** 썸네일 버튼 권한을 읽고 켜고 끄는 창구. 바뀐 상태는 `onChange`로 알린다. */
export type YoutubeOverlayPermission = {
  /** Popup을 열 때의 권한 상태를 읽는다. 읽지 못하면 오류 상태다. */
  readInitial(): Promise<YoutubeOverlaySnapshot>;
  /** 권한을 요청해 켠다. 거부·오류 뒤의 다시 요청도 같은 동작이다. */
  activate(): Promise<void>;
  /** 권한을 해제해 이후 자동 주입을 멈춘다. */
  deactivate(): Promise<void>;
};

/** 썸네일 버튼 권한 창구를 만든다. */
export function createYoutubeOverlayPermission(
  adapter: YoutubeOverlayAdapter,
  onChange: (snapshot: YoutubeOverlaySnapshot) => void,
): YoutubeOverlayPermission {
  /** 켜기·끄기를 처리 중인지 여부. Chrome 권한 창이 겹쳐 뜨지 않게 한 번에 하나만 처리한다. */
  let isChanging = false;

  return {
    async readInitial() {
      try {
        return createYoutubeOverlaySnapshot((await adapter.isEnabled()) ? 'enabled' : 'disabled');
      } catch {
        return createYoutubeOverlaySnapshot('error');
      }
    },
    async activate() {
      if (isChanging) {
        return;
      }

      isChanging = true;
      onChange(createYoutubeOverlaySnapshot('requesting'));

      try {
        /** 권한 요청과 현재 탭 Overlay 활성화 결과. */
        const enabled = await adapter.requestAndEnable();

        onChange(createYoutubeOverlaySnapshot(enabled ? 'enabled' : 'denied'));
      } catch {
        onChange(createYoutubeOverlaySnapshot('error', YOUTUBE_OVERLAY_ENABLE_FAILED_MESSAGE));
      } finally {
        isChanging = false;
      }
    },
    async deactivate() {
      if (isChanging) {
        return;
      }

      isChanging = true;

      try {
        /** Chrome이 권한을 실제로 해제했는지 여부. */
        let removed = false;

        try {
          removed = await adapter.disable();
        } catch {
          removed = false;
        }

        if (removed) {
          onChange(createYoutubeOverlaySnapshot('disabled'));
          return;
        }

        // 해제 실패를 '오류'로 보이면 권한이 남아 자동 주입이 계속되는데도 켜기 요청만 남는다.
        // 실제 권한 상태를 다시 읽어 그대로 보여 주고, 남아 있으면 끄지 못한 이유만 알린다.
        /** 해제 실패 뒤의 실제 권한 상태. */
        const stillEnabled = await adapter.isEnabled();

        onChange(
          stillEnabled
            ? { ...createYoutubeOverlaySnapshot('enabled'), turnOffError: YOUTUBE_OVERLAY_DISABLE_FAILED_MESSAGE }
            : createYoutubeOverlaySnapshot('disabled'),
        );
      } catch {
        onChange(createYoutubeOverlaySnapshot('error'));
      } finally {
        isChanging = false;
      }
    },
  };
}
