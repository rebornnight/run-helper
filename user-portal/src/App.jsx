import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import RunsPage from './pages/RunsPage';
import CapturePage from './pages/CapturePage';
import GuidePage from './pages/GuidePage';
import TermsGate, { TERMS_STORAGE_KEY } from './components/TermsGate';

function DeclinedScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7] p-6">
      <div className="card-apple rounded-super border border-neutral-100/60 shadow-premium p-10 max-w-md text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1 className="text-heading text-neutral-900">已退出</h1>
        <p className="text-sm text-neutral-400 mt-2">您选择不同意使用协议，请直接关闭此页面。</p>
      </div>
    </div>
  );
}

export default function App() {
  const [agreed, setAgreed] = useState(() => {
    try {
      return localStorage.getItem(TERMS_STORAGE_KEY) === '1';
    } catch (e) {
      return false;
    }
  });
  const [declined, setDeclined] = useState(false);

  if (declined) return <DeclinedScreen />;

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route index element={<Navigate to="/runs" replace />} />
            <Route path="runs" element={<RunsPage />} />
            <Route path="capture" element={<CapturePage />} />
            <Route path="guide" element={<GuidePage />} />
            <Route path="*" element={<Navigate to="/runs" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>

      {!agreed && (
        <TermsGate
          onAccept={() => {
            try { localStorage.setItem(TERMS_STORAGE_KEY, '1'); } catch (e) { /* ignore */ }
            setAgreed(true);
          }}
          onDecline={() => setDeclined(true)}
        />
      )}
    </>
  );
}
