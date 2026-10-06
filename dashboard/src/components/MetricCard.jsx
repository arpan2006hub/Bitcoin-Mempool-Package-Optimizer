import React from 'react';

export default function MetricCard({
  title,
  value,
  unit,
  subtext,
  icon: Icon,
  accentColor = 'text-[#f7931a]',
  bgColor = 'bg-orange-50',
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition-all">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        {Icon && (
          <div className={`p-2 rounded-lg ${bgColor} ${accentColor}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-slate-900 tracking-tight">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-medium text-slate-500">
            {unit}
          </span>
        )}
      </div>

      {subtext && (
        <p className="mt-1 text-[11px] text-slate-400 font-medium">
          {subtext}
        </p>
      )}
    </div>
  );
}
