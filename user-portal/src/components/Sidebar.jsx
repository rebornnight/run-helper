import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const menuItems = [
  {
    path: '/runs',
    label: '跑步记录',
    icon: (
      <svg aria-hidden="true" className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 21V3l16 7-16 7" />
      </svg>
    ),
  },
  {
    path: '/capture',
    label: '模拟环境',
    icon: (
      <svg aria-hidden="true" className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
  {
    path: '/guide',
    label: '使用说明',
    icon: (
      <svg aria-hidden="true" className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
];

export default function Sidebar({ onOpenTerms }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleNav = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 w-9 h-9 rounded-lg bg-neutral-900 shadow-lg flex items-center justify-center text-white hover:bg-neutral-700 transition"
      >
        <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          {mobileOpen ? (
            <path d="M18 6L6 18M6 6l12 12" />
          ) : (
            <>
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </>
          )}
        </svg>
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 w-64 bg-neutral-900
        flex flex-col transition-transform duration-300
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="px-5 py-6 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center">
              <img src="/logo.jpg" alt="" className="w-full h-full object-cover scale-150" />
            </span>
            <div>
              <h1 className="text-base font-semibold text-white tracking-tight">跑步助手</h1>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => handleNav(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-200
                ${isActive(item.path)
                  ? 'bg-white text-neutral-900 font-medium'
                  : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-4 border-t border-white/5">
          <p className="text-[11px] text-white/30 leading-relaxed">
            仅供学习研究<br />请勿用于违反校规或作弊
          </p>
          <button
            onClick={onOpenTerms}
            className="mt-1.5 text-[11px] text-white/40 hover:text-white/80 underline underline-offset-2 transition"
          >
            详情请查看使用协议
          </button>
        </div>
      </aside>
    </>
  );
}
