'use client';
type Props = {
  isFetching: boolean;
  refetch: () => void | Promise<unknown>;
};
export default function FeedError({ isFetching, refetch }: Props): React.ReactNode {
  return (
    <div className="p-4 text-sm text-red-600 flex items-center gap-2">
      <span>피드를 불러오지 못했습니다.</span>
      <button
        className="underline hover:no-underline disabled:opacity-50"
        onClick={() => refetch()}
        disabled={!!isFetching}
      >
        {isFetching ? '재시도 중...' : '다시 시도'}
      </button>
    </div>
  );
}
