import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface QualityBadgeProps {
  classification: 'STABLE_CONVERGENCE' | 'HIGH_SENSITIVITY' | 'POOR_FIT' | 'INVALID_FIT';
  bimodalityDetected?: boolean;
}

export const QualityBadge: React.FC<QualityBadgeProps> = ({ classification, bimodalityDetected }) => {
  const config = {
    STABLE_CONVERGENCE: {
      label: 'Stable Convergence',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      dot: 'bg-emerald-500'
    },
    HIGH_SENSITIVITY: {
      label: 'High Sensitivity',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      dot: 'bg-amber-500'
    },
    POOR_FIT: {
      label: 'Poor Fit Quality',
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
      dot: 'bg-rose-500'
    },
    INVALID_FIT: {
      label: 'Invalid Fit',
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-300',
      dot: 'bg-slate-400'
    }
  };

  const style = config[classification] || config.INVALID_FIT;

  return (
    <div className="flex flex-col gap-2">
      <div className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold tracking-tight transition-all duration-300 shadow-sm",
        style.bg,
        style.text,
        style.border
      )}>
        <span className={cn("w-2 h-2 rounded-full", style.dot, classification === 'STABLE_CONVERGENCE' ? 'animate-pulse' : '')} />
        {style.label}
      </div>
      
      {bimodalityDetected && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-rose-600 text-white border-rose-700 text-[10px] font-bold uppercase tracking-widest animate-pulse shadow-md">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Bimodality Warning
        </div>
      )}
    </div>
  );
};
