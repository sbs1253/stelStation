'use client';

export default function FeedSkeleton({ count = 24 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-video rounded-md bg-gray-200 animate-pulse" />
      ))}
    </div>
  );
}
