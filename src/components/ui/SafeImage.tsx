import React, { useState } from 'react';
import { Package } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: React.ReactNode;
  containerClassName?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({ 
  src, 
  alt, 
  className, 
  fallback, 
  containerClassName,
  ...props 
}) => {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className={cn("flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg", containerClassName || className)}>
        {fallback || <Package className="text-slate-400" size={24} />}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
      referrerPolicy="no-referrer"
      {...props}
    />
  );
};
