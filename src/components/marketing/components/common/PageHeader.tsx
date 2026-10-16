import React from 'react';
import { Home } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  breadcrumbs?: string[];
  brandColor?: string;
  isDarkTheme?: boolean;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, description, action, breadcrumbs, brandColor = '#2563eb', isDarkTheme = false }) => {
  return (
    <div className="relative mb-6 lg:mb-10 pt-4">
      {/* Ambient Background Glows */}
      <div className={`absolute -top-20 -left-20 w-96 h-96 bg-gradient-to-br from-amber-400/20 to-orange-500/10 rounded-full blur-[100px] -z-10 pointer-events-none mix-blend-multiply ${isDarkTheme ? 'opacity-20' : 'opacity-50'}`}></div>
      <div className={`absolute -top-20 right-0 w-64 h-64 ${isDarkTheme ? 'bg-slate-800/20' : 'bg-slate-200/40'} rounded-full blur-[80px] -z-10 pointer-events-none opacity-50`}></div>

      <div className="flex flex-col gap-4 lg:gap-8">
        {/* Top: Glassy Breadcrumb Pill */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center w-fit">
            <div className={`flex items-center gap-2 px-4 py-2 backdrop-blur-md border shadow-sm rounded-full ${isDarkTheme ? 'bg-slate-900/60 border-slate-800' : 'bg-white/60 border-white/50'}`}>
              <Home className="w-3.5 h-3.5 text-slate-400" />
              <span className={`w-px h-3 mx-1 ${isDarkTheme ? 'bg-slate-800' : 'bg-slate-300'}`}></span>
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <span className="text-slate-300 text-[10px] mx-1">/</span>}
                  <span className={`text-xs font-bold tracking-wide ${index === breadcrumbs.length - 1 ? (isDarkTheme ? 'text-slate-100' : 'text-slate-800') : 'text-slate-500'}`}>
                    {crumb}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </nav>
        )}

        {/* Main: Title & Actions */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 relative">
          <div className="max-w-3xl relative">
            <h1 className={`text-2xl md:text-[32px] font-black tracking-tight leading-tight mb-4 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
              {title}
              <span className="text-3xl md:text-4xl leading-none" style={{ color: brandColor }}>.</span>
            </h1>

            {description && (
              <div className="flex items-start gap-3">
                <div className={`w-6 h-[2px] mt-2.5 shrink-0 rounded-full ${isDarkTheme ? 'bg-slate-500 opacity-40' : 'bg-slate-900 opacity-20'}`}></div>
                <p className={`text-sm font-medium leading-relaxed max-w-xl ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>
                  {description}
                </p>
              </div>
            )}
          </div>

          {action && (
            <div className="flex-shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              {action}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PageHeader;