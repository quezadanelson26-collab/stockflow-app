'use client';

interface LoadingProps {
  message?: string;
  fullPage?: boolean;
}

export function Loading({ message = 'Loading...', fullPage = false }: LoadingProps) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-3 p-8">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        {content}
      </div>
    );
  }

  return content;
}
