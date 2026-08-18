import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { mountYoutubeOverlay } from '../src/features/youtube-overlay/youtube-overlay-ui';

/** YouTube 페이지에 동적으로 주입되는 unlisted Overlay script. */
export default defineUnlistedScript(() => {
  mountYoutubeOverlay();
});
