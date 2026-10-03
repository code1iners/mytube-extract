/** 확인된 업로드·처리 진행률을 표시한다. 완료 화면에서는 사용하지 않는다. */
export function RequestProgress(props: {
  /** 실제 전송량 또는 서버가 제공한 진행률. null이면 수치를 만들지 않는다. */
  value: number | null;
}) {
  if (props.value === null) return null;

  return (
    <div className="request-progress">
      <progress aria-label="진행률" max={100} value={props.value} />
      <p role="status" aria-atomic="true">{props.value}%</p>
    </div>
  );
}
