import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { runStatusOf } from '../utils/api.jsx';

export default function RunHistory({ runs, heightClass = 'h-[26rem]' }) {
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(wrapperRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', force3d: true }
      );
    });
    return () => ctx.revert();
  }, [runs]);

  if (!runs || runs.length === 0) {
    return (
      <div ref={wrapperRef} className="card-apple rounded-super border border-neutral-200/80 shadow-premium overflow-hidden">
        <div className={`flex items-center justify-center ${heightClass}`}>
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-neutral-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-5 h-5 text-neutral-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M13 2L2 13h10l-1 9 11-11H12l1-9z"/></svg>
            </div>
            <p className="text-neutral-500 font-medium">暂无跑步记录</p>
            <p className="text-sm text-neutral-400 mt-1">使用提交工具开始跑步</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="card-apple rounded-super border border-neutral-200/80 shadow-premium overflow-hidden transition-shadow duration-300">
      <div className={`p-4 space-y-3 ${heightClass} overflow-y-auto overscroll-contain`}>
        {runs.map((run) => (
          <div key={run.id}
            className="group relative bg-white rounded-2xl border border-neutral-200/80 hover:border-neutral-300 hover:shadow-premium hover:-translate-y-0.5 transition-all duration-300"
          >
            <div className="flex items-center gap-6 px-6 py-5">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3">
                  <span className="text-base font-semibold text-neutral-900 tabular-nums">
                    {run.distance != null ? `${Number(run.distance).toFixed(2)}km` : '-'}
                  </span>
                  <span className={`flex items-center gap-1 text-sm ${runStatusOf(run) === 1 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {runStatusOf(run) === 1 ? (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    )}
                    {runStatusOf(run) === 1 ? '成功' : '失败'}
                  </span>
                </div>
                {run.reason && (
                  <p className="text-sm text-neutral-500 mt-1 truncate">{run.reason}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm text-neutral-400 tabular-nums whitespace-nowrap">
                  {new Date(run.created_at * 1000).toLocaleString('zh-CN')}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
