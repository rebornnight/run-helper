import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { showMsg, apiPost } from '../utils/api.jsx';
import { usePopupAnimation } from '../utils/animations';
import RunHistory from '../components/RunHistory';

const maskStudentNum = (s) => s && s.length > 4 ? s.substring(0, 4) + '****' : s;

const STATUS_LABEL = {
  0: '待审核', 1: '成功', 2: '失败', 5: '失败',
};

export default function RunsPage() {
  const {
    runs, config, lptiyuConfig, user,
    handleRunClick, setRunDetail,
    selectedRoute, routes,
    resetRunStatus,
    fetchAll,
    localSubmitting, localResult,
  } = useOutletContext();

  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [terms, setTerms] = useState([]);            // 可选学期列表
  const [selectedTerm, setSelectedTerm] = useState(''); // 当前选中学期 term_id
  const [showRecordPicker, setShowRecordPicker] = useState(false);
  const [recordSubmitting, setRecordSubmitting] = useState(false);
  const [recordError, setRecordError] = useState('');
  const [confirmRecord, setConfirmRecord] = useState(null); // 待确认提交的历史记录
  const { backdropRef: confirmBackdropRef, cardRef: confirmCardRef, animateOut: confirmAnimateOut } = usePopupAnimation(!!confirmRecord);
  const { backdropRef: recordBackdropRef, cardRef: recordCardRef, animateOut: recordAnimateOut } = usePopupAnimation(showRecordPicker);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  const runsTodayStart = new Date().setHours(0, 0, 0, 0) / 1000;
  const hasTodaySuccess = runs.some(r => r.status === 1 && r.created_at > runsTodayStart);
  const hasTodayLimit = runs.some(r => r.reason && r.reason.includes('上限') && r.created_at > runsTodayStart);
  const limitReached = hasTodaySuccess || hasTodayLimit;

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('.runs-card',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' }
      );
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const handleFetchRecords = async () => {
    if (!lptiyuConfig) {
      showMsg('请先在「模拟环境」中导入抓包数据', 'error');
      return;
    }
    setLoadingRecords(true);
    setRecordError('');
    try {
      // 1) 先取学期列表（首次），并确定要查询的学期
      let termList = terms;
      if (!termList.length) {
        const t = await apiPost('/capture/terms', { student_num: user.studentNum });
        if (t.error) { showMsg(t.error, 'error'); return; }
        termList = (t.terms || []).slice(0, 3);   // 只保留最新的三个学期
        setTerms(termList);
      }
      const currentTerm = termList.find((t) => t.current) || termList[0];
      const termId = selectedTerm || (currentTerm && currentTerm.term_id) || '';
      if (!selectedTerm && termId) setSelectedTerm(termId);
      // 2) 拉该学期记录
      const res = await apiPost('/capture/records', { student_num: user.studentNum, term_id: termId });
      if (res.error) {
        showMsg(res.error, 'error');
      } else {
        const list = res.records || [];
        setRecords(list);
        // 即使该学期没有可用记录也打开弹窗，方便用户切换学期
        setShowRecordPicker(true);
        if (!list.some((r) => r.status === '1')) {
          showMsg('该学期暂无可用的历史记录', 'error');
        }
      }
    } catch (e) {
      showMsg('登录信息已失效，请重新模拟', 'error');
    } finally {
      setLoadingRecords(false);
    }
  };

  // 弹窗内切换学期 → 重新拉取该学期记录
  const handleSwitchTerm = async (termId) => {
    if (termId === selectedTerm) return;
    setSelectedTerm(termId);
    setLoadingRecords(true);
    setRecordError('');
    try {
      const res = await apiPost('/capture/records', { student_num: user.studentNum, term_id: termId });
      if (res.error) { setRecordError(res.error); setRecords([]); }
      else setRecords(res.records || []);
    } catch (e) {
      setRecordError('登录信息已失效，请重新模拟');
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleSubmitRecord = async (recordId) => {
    setRecordSubmitting(true);
    setRecordError('');
    try {
      const res = await apiPost('/submit/with-record', {
        student_num: user.studentNum,
        record_id: recordId,
        route: selectedRoute,
      });
      if (res.status === 1) {
        showMsg('使用历史记录提交成功！', 'success');
        setShowRecordPicker(false);
        setRunDetail(res);
      } else {
        const errMsg = res.error || res.reason || '提交失败，请重试';
        setRecordError(errMsg);
        showMsg(errMsg, 'error');
      }
    } catch (e) {
      setRecordError('登录信息已失效，请重新模拟');
      showMsg('登录信息已失效，请重新模拟', 'error');
    } finally {
      fetchAll();
      setRecordSubmitting(false);
    }
  };

  // 点击记录 → 先弹窗确认，再真正提交
  const handleConfirmSubmit = () => {
    const id = confirmRecord && confirmRecord.id;
    confirmAnimateOut(() => {
      setConfirmRecord(null);
      if (id) handleSubmitRecord(id);
    });
  };

  return (
    <div ref={containerRef}>
      <div className="mb-6 flex flex-col items-center">
        <span className="text-[11px] font-medium text-neutral-400 tracking-wider uppercase">当前状态</span>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className={`text-[40px] font-semibold leading-none tracking-tight ${limitReached ? 'text-amber-500' : 'text-neutral-900'}`}>
            {limitReached ? '今日已提交' : '可提交'}
          </span>
        </div>
      </div>
      <p className="text-sm text-neutral-400 text-center -mt-4 mb-6">提交规则以乐跑为准</p>

      {/* 开始跑步 */}
      <div className="mb-6 runs-card opacity-0">
        <h2 className="text-heading text-neutral-900">开始跑步</h2>
        <p className="text-sm text-neutral-400 mt-1">配置模拟环境并手动提交跑步</p>
      </div>

      {/* 环境状态栏 */}
      <div className="card-apple rounded-super border border-neutral-100/60 shadow-apple-sm mb-6 overflow-hidden runs-card opacity-0">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {!lptiyuConfig ? (
                <>
                  <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center shrink-0 overflow-hidden">
                    <svg className="w-5 h-5 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-yellow-700">未检测到已保存的模拟环境配置</p>
                  </div>
                </>
              ) : limitReached ? (
                <>
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-700">今日关联成绩已达上限</p>
                    <p className="text-xs text-neutral-400 mt-0.5">请第二天再次尝试</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-green-700">模拟环境已就绪</p>
                    <p className="text-xs text-neutral-400 mt-0.5">学号: {maskStudentNum(lptiyuConfig?.student_num)}</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!lptiyuConfig ? (
                <button
                  onClick={() => navigate('/capture')}
                  className="px-5 py-2.5 rounded-xl bg-yellow-500 text-white text-sm font-semibold hover:bg-yellow-400 transition active:scale-[0.97] shrink-0"
                >
                  前往配置
                </button>
              ) : localSubmitting ? (
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-green-50 border border-green-200">
                  <div className="w-4 h-4 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
                  <span className="text-sm font-medium text-green-700">提交中...</span>
                </div>
              ) : localResult ? (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-green-700">
                    {localResult?.distance ? `提交成功 ${localResult.distance}km` : '提交成功'}
                  </span>
                  <button onClick={() => { resetRunStatus(); fetchAll(); }} className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 transition">返回</button>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleFetchRecords}
                    disabled={loadingRecords || limitReached}
                    className="px-5 py-2.5 rounded-xl border border-neutral-200 text-neutral-600 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.97] shrink-0 flex items-center gap-2"
                  >
                    {loadingRecords ? (
                      <div className="w-4 h-4 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
                    ) : '使用历史记录'}
                  </button>
                  <button
                    onClick={handleRunClick}
                    disabled={limitReached}
                    className="px-6 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.97] shrink-0 flex items-center gap-2"
                  >
                    开始跑步
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 历史记录选择弹出层 */}
      {showRecordPicker && createPortal(
        <div ref={recordBackdropRef} onClick={() => recordAnimateOut(() => setShowRecordPicker(false))} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div ref={recordCardRef} onClick={(e) => e.stopPropagation()} className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-neutral-100 shrink-0">
              <h3 className="text-base font-semibold text-neutral-900">选择一条历史记录</h3>
              <p className="text-xs text-neutral-400 mt-1">
                当前场地: {routes.find(r => r.id === selectedRoute)?.label || '未知'}
              </p>
            </div>

            {/* 学期选择 */}
            {terms.length > 0 && (
              <div className="px-6 py-3 border-b border-neutral-100 bg-neutral-50/60 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-neutral-500">选择学期</span>
                  {loadingRecords && <span className="text-xs text-neutral-400">加载中…</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {terms.map((t) => (
                    <button
                      key={t.term_id}
                      onClick={() => handleSwitchTerm(t.term_id)}
                      disabled={loadingRecords}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition active:scale-[0.97] disabled:opacity-50 ${
                        t.term_id === selectedTerm
                          ? 'bg-neutral-900 text-white'
                          : 'bg-white border border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'
                      }`}
                    >
                      {t.term_name || t.term_id}
                      {t.current && <span className="ml-1 opacity-70">· 当前</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 space-y-2 overflow-y-auto flex-1">
              {loadingRecords ? (
                <p className="text-sm text-neutral-400 text-center py-4">正在读取该学期记录…</p>
              ) : records.length === 0 ? (
                <p className="text-sm text-neutral-400 text-center py-4">该学期暂无可用记录</p>
              ) : (
                records.filter((r) => r.status === '1').map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setConfirmRecord(r)}
                    disabled={recordSubmitting}
                    className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-neutral-100 text-left transition hover:border-neutral-200 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-900">
                          {r.distance}km
                        </span>
                        {r.game_id === '1875' && (
                          <span className="text-[11px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium">
                            四运
                          </span>
                        )}
                        {r.game_id === '1873' && (
                          <span className="text-[11px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded font-medium">
                            二运
                          </span>
                        )}
                        {r.game_id === '1876' && (
                          <span className="text-[11px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded font-medium">
                            荣昌
                          </span>
                        )}
                        <span className="text-[11px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-medium">
                          {STATUS_LABEL[r.status] || '未知'}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-1 truncate">{r.title || '无标题'}</p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-xs text-neutral-400">
                        {r.start_time ? new Date(r.start_time * 1000).toLocaleDateString('zh-CN') : ''}
                      </p>
                      <p className="text-xs text-neutral-300">{r.used_time ? `${r.used_time}s` : ''}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
            {recordError && (
              <div className="px-6 py-3 border-t border-red-100 bg-red-50/50 shrink-0">
                <p className="text-sm text-red-600">{recordError}</p>
              </div>
            )}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-100 bg-neutral-50/50 shrink-0">
              <button
                onClick={() => recordAnimateOut(() => setShowRecordPicker(false))}
                disabled={recordSubmitting}
                className="px-5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-600 font-medium hover:bg-white transition"
              >
                {recordSubmitting ? '提交中...' : '取消'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 确认提交弹窗 */}
      {confirmRecord && createPortal(
        <div
          ref={confirmBackdropRef}
          onClick={() => confirmAnimateOut(() => setConfirmRecord(null))}
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        >
          <div
            ref={confirmCardRef}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-neutral-100">
              <h3 className="text-base font-semibold text-neutral-900">确认提交这条记录？</h3>
              <p className="text-xs text-neutral-400 mt-1">将使用该历史记录的轨迹生成一次新的跑步</p>
            </div>
            <div className="px-6 py-5 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">距离</span>
                <span className="font-medium text-neutral-900 tabular-nums">{confirmRecord.distance} km</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">日期</span>
                <span className="text-neutral-700 tabular-nums">
                  {confirmRecord.start_time ? new Date(confirmRecord.start_time * 1000).toLocaleDateString('zh-CN') : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">用时</span>
                <span className="text-neutral-700 tabular-nums">{confirmRecord.used_time ? `${confirmRecord.used_time}s` : '—'}</span>
              </div>
              <p className="text-xs text-neutral-400 pt-2">提交后会生成一次新的跑步记录，确定继续吗？</p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-100 bg-neutral-50/50">
              <button
                onClick={() => confirmAnimateOut(() => setConfirmRecord(null))}
                className="px-5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-600 font-medium hover:bg-white transition"
              >
                取消
              </button>
              <button
                onClick={handleConfirmSubmit}
                disabled={recordSubmitting}
                className="px-6 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.97]"
              >
                确认提交
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 跑步记录 */}
      <div className="mb-6 runs-card opacity-0">
        <h2 className="text-heading text-neutral-900">跑步记录</h2>
        <p className="text-sm text-neutral-400 mt-1">最近 {runs.length} 条记录</p>
      </div>
      <div className="runs-card opacity-0">
        <RunHistory runs={runs} />
      </div>
    </div>
  );
}
