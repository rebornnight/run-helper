import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { showMsg, apiPost, apiDelete } from '../utils/api.jsx';
import { usePopupAnimation } from '../utils/animations';

const FIELD_LABELS = {
  uid: '用户ID',
  token: 'Token',
  school_id: '学校ID',
  term_id: '学期ID',
  student_num: '学号',
  class_id: '班级ID',
  card_id: '校园卡ID',
};

const SENSITIVE_FIELDS = ['token'];

function maskValue(key, val) {
  if (!val) return '';
  if (!SENSITIVE_FIELDS.includes(key)) return String(val);
  return val.length > 8
    ? val.substring(0, 4) + '****' + val.substring(val.length - 4)
    : val;
}

function ConfigDisplay({ config, label = '配置信息' }) {
  return (
    <div className="card-apple rounded-super border border-neutral-100/60 shadow-apple-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-100">
        <h3 className="text-sm font-semibold text-neutral-900">{label}</h3>
      </div>
      <div className="divide-y divide-neutral-100">
        {Object.entries(FIELD_LABELS).map(([key, label]) => {
          const val = config[key];
          return (
            <div key={key} className="px-6 py-3 flex items-center justify-between text-sm">
              <span className="text-neutral-500">{label}</span>
              <span className="text-sm text-neutral-900">
                {val ? maskValue(key, val) : <span className="text-neutral-300 italic">空</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ImportCapture({ savedConfig: propSavedConfig = null, onSectionChange, onClearConfig, onSaveConfig }) {
  const navigate = useNavigate();
  const [rawBody, setRawBody] = useState('');
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(null);
  const [savedConfig, setSavedConfig] = useState(propSavedConfig);
  const [error, setError] = useState(null);
  const [showOverwrite, setShowOverwrite] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const captureRef = useRef(null);
  const pendingRef = useRef(null);
  const savedConfigRef = useRef(null);
  const { cardRef: overwriteCardRef, animateOut: overwriteAnimateOut } = usePopupAnimation(showOverwrite && pending && savedConfig);
  const { cardRef: revokeCardRef, animateOut: revokeAnimateOut } = usePopupAnimation(confirmRevoke && savedConfig);

  // 页面入口卡片 stagger（与 RunsPage 完全一致的动画模式）
  useEffect(() => {
    if (!captureRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('.capture-card',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' }
      );
    }, captureRef);
    return () => ctx.revert();
  }, []);

  // 从父组件同步配置数据（Dashboard 已预加载）
  useEffect(() => {
    setSavedConfig(propSavedConfig);
  }, [propSavedConfig]);

  // Pending result entrance（与 RunHistory 一致的动画模式）
  useEffect(() => {
    if (!pendingRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(pendingRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', force3d: true }
      );
    });
    return () => ctx.revert();
  }, [pending]);


  // 已保存配置的入场动画（delay 等页面过渡 + stagger 完成后再执行）
  useEffect(() => {
    if (!savedConfigRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(savedConfigRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.4, delay: 0.5, ease: 'power2.out', force3d: true }
      );
    });
    return () => ctx.revert();
  }, [savedConfig]);

  const handleImport = async () => {
    if (!rawBody.trim()) {
      showMsg('请先粘贴抓包数据', 'error');
      return;
    }
    setImporting(true);
    setError(null);
    setPending(null);
    setShowOverwrite(false);
    try {
      const res = await apiPost('/capture/import', { raw_body: rawBody }, true);
      setPending(res.extracted);
      showMsg('解析成功，请点击保存配置', 'success');
    } catch (e) {
      setError(e.message);
      showMsg('解析失败: ' + e.message, 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleSave = async () => {
    if (savedConfig) {
      // 有已保存配置，弹出覆盖确认
      setShowOverwrite(true);
      return;
    }
    await doSave();
  };

  const doSave = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      const res = await apiPost('/capture/save', pending, true);
      setSavedConfig(pending);
      setPending(null);
      setShowOverwrite(false);
      onSaveConfig?.(pending);
      showMsg('配置已保存', 'success');
    } catch (e) {
      showMsg('保存失败: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleOverwrite = async () => {
    await doSave();
  };

  const handleKeepOld = () => {
    setPending(null);
    setShowOverwrite(false);
    showMsg('已保留原配置', 'info');
  };

  const handleClear = () => {
    setRawBody('');
    setPending(null);
    setError(null);
    setShowOverwrite(false);
  };

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      await apiDelete('/capture/config');
      setSavedConfig(null);
      setConfirmRevoke(false);
      onClearConfig?.();
      showMsg('已取消授权并删除相关数据', 'success');
    } catch (e) {
      showMsg('取消失败: ' + e.message, 'error');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div ref={captureRef}>
      <div className="capture-card opacity-0 mb-8">
        <h2 className="text-heading text-neutral-900">模拟跑步环境</h2>
        <p className="text-sm text-neutral-400 mt-1">
          将请求信息粘贴到下方，系统将自动解析。详细操作步骤请查看侧边栏<a href="#" onClick={(e) => { e.preventDefault(); navigate('/guide'); }} className="text-blue-500 hover:text-blue-400 underline">「使用说明」</a>
        </p>
      </div>

      {/* 已保存的配置 */}
      {savedConfig && !pending && !showOverwrite && !confirmRevoke && (
        <div className="mb-6" ref={savedConfigRef}>
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span className="text-sm font-medium text-green-700">已保存的环境配置</span>
          </div>
          <ConfigDisplay config={savedConfig} label="当前配置" />
          <div className="mt-4 pt-4 border-t border-neutral-100 flex justify-end">
            <button
              onClick={() => setConfirmRevoke(true)}
              className="px-5 py-2 rounded-xl border border-red-200 text-sm text-red-500 font-medium hover:bg-red-50 hover:border-red-300 transition active:scale-[0.97]"
            >
              取消授权并删除相关数据
            </button>
          </div>
        </div>
      )}

      {/* 输入区 */}
      <div className="capture-card opacity-0 card-apple rounded-super p-6 border border-neutral-100/60 shadow-apple-sm hover:shadow-apple hover:border-neutral-200/60 transition-all duration-300 mb-6">
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          请求体内容
        </label>
        <textarea
          value={rawBody}
          onChange={(e) => setRawBody(e.target.value)}
          placeholder={savedConfig
            ? '当前配置会在其它设备登录当前小程序账号时失效，失效后请重新按照使用说明导入配置'
            : '将请求信息粘贴到这里...'}
          rows={5}
          className="w-full px-4 py-3 text-sm font-mono text-neutral-800 bg-neutral-50 border border-neutral-200 rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-400 transition placeholder:text-neutral-300"
        />
        <div className="flex items-center justify-between mt-3">
          <button
            onClick={handleClear}
            className="text-xs text-neutral-400 hover:text-neutral-600 transition"
          >
            清空
          </button>
          <button
            onClick={handleImport}
            disabled={importing || !rawBody.trim()}
            className="px-6 py-2.5 rounded-xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.97] flex items-center gap-2"
          >
            {importing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                解析中...
              </>
            ) : (
              '导入配置'
            )}
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="card-apple rounded-super p-4 mb-6 border border-red-100/60 bg-red-50/30 shadow-apple-sm">
          <div className="flex items-center gap-2 text-sm text-red-600">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* 解析结果（待保存） */}
      {pending && !showOverwrite && (
        <div className="space-y-4" ref={pendingRef}>
          <ConfigDisplay config={pending} label="解析结果（尚未保存）" />
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-500 hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.97] flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  保存中...
                </>
              ) : (
                '保存配置'
              )}
            </button>
          </div>
        </div>
      )}

      {/* 覆盖确认对话框 */}
      {showOverwrite && pending && savedConfig && (
        <div ref={overwriteCardRef} className="card-apple rounded-super border border-amber-100/60 shadow-apple-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-100 bg-amber-50/50">
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              已有保存的配置
            </h3>
          </div>
          <div className="p-6 space-y-6">
            {/* 旧配置 */}
            <div>
              <p className="text-xs text-neutral-400 mb-2 font-medium">当前配置</p>
              <ConfigDisplay config={savedConfig} label="当前配置" />
            </div>
            {/* 新配置 */}
            <div>
              <p className="text-xs text-neutral-400 mb-2 font-medium">新解析的配置</p>
              <ConfigDisplay config={pending} label="新配置" />
            </div>
            {/* 操作按钮 */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-100">
              <button
                onClick={() => overwriteAnimateOut(handleKeepOld)}
                className="px-5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-600 font-medium hover:bg-neutral-50 transition"
              >
                仍然使用原配置
              </button>
              <button
                onClick={() => overwriteAnimateOut(handleOverwrite)}
                className="px-5 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-400 hover:scale-[1.02] transition active:scale-[0.97]"
              >
                覆盖原有配置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 取消授权确认对话框 */}
      {confirmRevoke && savedConfig && (
        <div ref={revokeCardRef} className="card-apple rounded-super border border-red-100/60 shadow-apple-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-red-100 bg-red-50/50">
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              确认取消授权
            </h3>
          </div>
          <div className="p-6">
            <p className="text-sm text-neutral-600 leading-relaxed">
              取消授权后，我们将删除已存储的身份认证信息及任务相关数据。此操作不可撤销，确定要继续吗？
            </p>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-neutral-100">
              <button
                onClick={() => revokeAnimateOut(() => setConfirmRevoke(false))}
                disabled={revoking}
                className="px-5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-600 font-medium hover:bg-neutral-50 transition"
              >
                取消
              </button>
              <button
                onClick={() => revokeAnimateOut(handleRevoke)}
                disabled={revoking}
                className="px-5 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.97] flex items-center gap-2"
              >
                {revoking ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    处理中...
                  </>
                ) : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
