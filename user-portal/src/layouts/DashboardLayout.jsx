import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { showMsg, apiGet, apiPost } from '../utils/api.jsx';
import Sidebar from '../components/Sidebar';
import TermsGate from '../components/TermsGate';
import { usePopupAnimation } from '../utils/animations';

export default function DashboardLayout() {
  const [loading, setLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [lptiyuConfig, setLptiyuConfig] = useState(null);
  const [runs, setRuns] = useState([]);

  // 提交状态：idle → submitting → idle（结果通过 lastResult 展示）
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const [showRoutePicker, setShowRoutePicker] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState('first_field');

  const contentRef = useRef(null);
  const location = useLocation();
  const { backdropRef, cardRef, animateOut } = usePopupAnimation(showRoutePicker);

  // ── 基础数据 ──
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, routesRes, captureRes, runsRes] = await Promise.all([
        apiGet('/config').catch(() => null),
        apiGet('/routes').catch(() => []),
        apiGet('/capture/config').catch(() => ({ has_config: false, config: null })),
        apiGet('/runs?limit=20').catch(() => ({ runs: [] })),
      ]);
      setBootstrap(cfgRes);
      setRoutes(Array.isArray(routesRes) ? routesRes : []);
      setLptiyuConfig(captureRes.has_config ? captureRes.config : null);
      setRuns(runsRes.runs || []);
    } catch (e) {
      showMsg('加载失败：' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── 页面切换动画 ──
  useEffect(() => {
    if (!contentRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(contentRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', clearProps: 'transform' });
    }, contentRef);
    return () => ctx.revert();
  }, [location.pathname]);

  // ── 提交（直接提交，无倒计时） ──
  const submitRoute = useCallback(async (routeName) => {
    setSubmitting(true);
    try {
      const res = await apiPost('/submit', { route: routeName });
      if (res.status === 1) {
        setLastResult(res);
        showMsg(`提交成功：${res.distance} km`);
      } else {
        showMsg(res.error || res.reason || '提交失败', 'error');
      }
    } catch (e) {
      showMsg(e.message, 'error');
    } finally {
      setSubmitting(false);
      fetchAll();
    }
  }, [fetchAll]);

  const handleRunClick = () => {
    if (!lptiyuConfig) {
      showMsg('请先在「模拟环境」中导入抓包数据', 'error');
      return;
    }
    setShowRoutePicker(true);
  };

  const handleRunWithRoute = async () => {
    setShowRoutePicker(false);
    if (!lptiyuConfig) {
      showMsg('请先在「模拟环境」中导入抓包数据', 'error');
      return;
    }
    await submitRoute(selectedRoute);
  };

  const resetRunStatus = () => setLastResult(null);

  const contextValue = {
    bootstrap,
    routes,
    lptiyuConfig,
    setLptiyuConfig,
    runs,
    fetchAll,
    loading,
    submitting,
    lastResult,
    setLastResult,
    handleRunClick,
    handleRunWithRoute,
    resetRunStatus,
    selectedRoute,
    setSelectedRoute,
    // 兼容 RunsPage 使用的字段
    user: { studentNum: lptiyuConfig?.student_num },
    config: { deductions: { run: null } },
    buyCount: 0,
    localSubmitting: submitting,
    localResult: lastResult,
    runStatus: submitting ? 'submitting' : 'idle',
    runTime: 0,
    countdown: -1,
    runDetail: lastResult,
    setRunDetail: setLastResult,
  };

  return (
    <div className="min-h-screen lg:h-screen bg-[#f5f5f7] flex">
      <Sidebar onOpenTerms={() => setShowTerms(true)} />
      <main className="flex-1 p-6 lg:p-10 pt-16 lg:pt-10 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div key={location.pathname} ref={contentRef}>
            {loading && !bootstrap ? (
              <div className="flex items-center justify-center h-96">
                <div className="w-6 h-6 border-[2.5px] border-neutral-900 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <Outlet context={contextValue} />
            )}
          </div>
        </div>
      </main>

      {/* 场地选择弹窗 */}
      {showRoutePicker && (
        <div
          ref={backdropRef}
          onClick={() => animateOut(() => setShowRoutePicker(false))}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        >
          <div
            ref={cardRef}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-neutral-100">
              <h3 className="text-base font-semibold text-neutral-900">选择跑步场地</h3>
              <p className="text-xs text-neutral-400 mt-1">选择后立即提交，无需等待</p>
            </div>
            <div className="p-4 space-y-2">
              {routes.length === 0 ? (
                <p className="text-sm text-neutral-400 text-center py-4">暂无可用路线</p>
              ) : (
                routes.map((r) => (
                  <button
                    key={r.id}
                    disabled={!r.ready}
                    onClick={() => setSelectedRoute(r.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition ${
                      !r.ready
                        ? 'border-neutral-100 bg-neutral-50/50 opacity-50 cursor-not-allowed'
                        : selectedRoute === r.id
                          ? 'border-neutral-900 bg-neutral-50'
                          : 'border-neutral-100 hover:border-neutral-200'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      !r.ready ? 'border-neutral-200'
                        : selectedRoute === r.id ? 'border-neutral-900' : 'border-neutral-300'
                    }`}>
                      {selectedRoute === r.id && (
                        <div className="w-2.5 h-2.5 rounded-full bg-neutral-900" />
                      )}
                    </div>
                    <span className={`text-sm font-medium ${
                      !r.ready ? 'text-neutral-300'
                        : selectedRoute === r.id ? 'text-neutral-900' : 'text-neutral-500'
                    }`}>{r.label}</span>
                    {!r.ready && (
                      <span className="ml-auto text-xs text-neutral-300">暂无数据</span>
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-100 bg-neutral-50/50">
              <button
                onClick={() => animateOut(() => setShowRoutePicker(false))}
                className="px-5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-600 font-medium hover:bg-white transition"
              >
                取消
              </button>
              <button
                onClick={handleRunWithRoute}
                disabled={routes.length === 0 || !routes.find((r) => r.id === selectedRoute)?.ready}
                className="px-6 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.97]"
              >
                立即提交
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 使用协议（阅读模式） */}
      {showTerms && (
        <TermsGate mode="view" onClose={() => setShowTerms(false)} />
      )}
    </div>
  );
}
