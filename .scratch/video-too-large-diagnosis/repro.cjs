/** 원본 메타데이터로 실제 worker 사전 검사를 반복한다. */
const { runVideoPreflight } = require('../../apps/worker/dist/video-preflight.js');
/** 서명 URL을 제거한 실제 응답. */
const metadata = require('./metadata.json');
runVideoPreflight({
  sourceUrl: 'https://www.youtube.com/watch?v=nGKd4yTP3M8',
  format: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
  run: async () => metadata,
}).then(() => console.log('PASS: 1080p preflight accepted')).catch(error => {
  console.log(`FAIL: ${error.code ?? error.errorCode} ${error.message}`);
  process.exitCode = error.code === 'VIDEO_TOO_LARGE' || error.errorCode === 'VIDEO_TOO_LARGE' ? 1 : 2;
});
