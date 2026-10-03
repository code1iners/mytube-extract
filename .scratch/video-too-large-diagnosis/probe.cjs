/** 실제 worker 판단 함수로 한 번에 변수 하나씩 비교한다. */
const { createVideoPreflightDecision: decide } = require('../../apps/worker/dist/worker.logic.js');
/** 현재 영상의 실제 메타데이터. */
const metadata = require('./metadata.json');
/** 선택 포맷 조합별 판단 결과. */
for (const ids of [['399','251'],['399','250'],['398','251']]) {
  console.log(JSON.stringify({ids,...decide({requested_formats:ids.map(id=>metadata.formats.find(f=>f.format_id===id))})}));
}
/** 제한값만 변경한 비교. */
for (const limit of [1073741824,1342177280,1610612736]) {
  console.log(JSON.stringify({limit,...decide(metadata,limit)}));
}
console.log(JSON.stringify({approxOnly:decide({requested_formats:metadata.requested_formats.map(({filesize,...format})=>format)})}));
