/** 활성 탭에서 읽은 정보. */
export type CurrentTab = {
  /** 활성 탭 URL. */
  url: string;
  /** 활성 탭 제목. Chrome이 알려주지 않으면 null이다. */
  title: string | null;
};

/** Chrome tabs adapter. */
export type TabsAdapter = {
  /** 현재 활성 탭의 URL과 제목을 읽는다. */
  getCurrentTab(): Promise<CurrentTab>;
};

/** Chrome tabs adapter를 만든다. */
// Popup을 연 아이콘 클릭이 activeTab을 부여하므로 추가 권한 없이 활성 탭 URL·제목을 읽을 수 있다.
export function createTabsAdapter(chromeApi: typeof chrome = chrome): TabsAdapter {
  return {
    getCurrentTab() {
      return new Promise((resolve, reject) => {
        chromeApi.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
          if (chromeApi.runtime.lastError) {
            reject(new Error('현재 탭 정보를 읽지 못했습니다.'));
            return;
          }

          /** 현재 활성 탭. */
          const currentTab = tabs[0];

          if (!currentTab?.url) {
            reject(new Error('현재 탭 주소를 알 수 없습니다.'));
            return;
          }

          resolve({ title: currentTab.title || null, url: currentTab.url });
        });
      });
    },
  };
}
