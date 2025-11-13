import { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export default function ChartCard({ title, description, children, className = '' }: ChartCardProps) {
  return (
    <div className={`group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-lg hover:border-indigo-300/50 dark:hover:border-indigo-500/50 transition-all duration-300 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
        )}
      </div>
      <div className="relative">
        {children}
      </div>
    </div>
  );
}

