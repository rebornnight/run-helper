import { useState, useEffect, useRef } from 'react';
import { usePopupAnimation } from '../utils/animations';

export const TERMS_STORAGE_KEY = 'run_sim_terms_accepted_v1';

// 免责声明 / 使用协议内容
const SECTIONS = [
  {
    title: '一、项目性质',
    content:
      '本项目是一个在本地运行的技术学习与研究工具，用于演示 HTTP 抓包、AES 加密协议解析与轨迹数据生成等技术。本项目不是学校官方系统，与学校、乐跑官方及任何第三方平台均无任何关联、合作或授权关系。',
  },
  {
    title: '二、使用风险',
    content:
      '使用本项目可能违反您所在学校的校规校纪，或违反乐跑平台的服务条款，可能导致账号被限制功能、成绩被取消、账号被封禁等后果。以上风险由使用者自行承担，本项目作者不承担任何责任。',
  },
  {
    title: '三、数据与隐私',
    content:
      '本项目完全在您的本机运行，导入的配置（含登录凭证）仅保存在本机数据库，凭证经加密存储，不会上传到任何服务器。请妥善保管您的设备与数据，避免向他人泄露；因您主动泄露或设备被他人使用导致的损失由您自行承担。',
  },
  {
    title: '四、第三方工具',
    content:
      '本项目使用 Reqable（https://reqable.com）等第三方抓包工具获取协议数据，该工具与本项目无任何关联关系。使用第三方工具产生的任何问题（包括但不限于兼容性、安全性）由您与该工具开发方自行解决。',
  },
  {
    title: '五、免责声明',
    content:
      '本项目按「现状」提供，不提供任何明示或暗示的担保。对于因使用或无法使用本项目而导致的任何直接或间接损失（包括但不限于账号处罚、成绩失效、数据丢失、设备故障），本项目作者不承担任何责任。',
  },
  {
    title: '六、禁止商用',
    content:
      '本项目及其源代码仅供个人学习与研究使用，禁止用于任何商业用途，包括但不限于：出售、出租、收费代跑、以本项目为基础提供付费服务、打包转售或并入商业产品。未经作者书面许可，不得将本项目用于任何营利性活动；违反者应自行承担相应法律责任。',
  },
  {
    title: '七、合法使用',
    content:
      '请勿将本项目用于获取、篡改他人信息，或用于任何违反法律法规的活动。请在充分理解并接受以上全部内容后继续使用。',
  },
];

/**
 * mode = 'gate' 首次使用门禁：只提供「我已知晓 / 我不同意并退出」
 * mode = 'view' 阅读模式：可关闭（点遮罩 / X / 关闭按钮 / Esc）
 */
export default function TermsGate({ mode = 'gate', onAccept, onDecline, onClose }) {
  const isGate = mode === 'gate';
  const { backdropRef, cardRef, animateOut } = usePopupAnimation(true);
  const bodyRef = useRef(null);
  const [atBottom, setAtBottom] = useState(false);

  // 弹窗期间禁止背景滚动
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // 阅读模式下 Esc 关闭
  useEffect(() => {
    if (isGate) return;
    const onKey = (e) => { if (e.key === 'Escape') animateOut(onClose); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isGate, onClose, animateOut]);

  // 滚动到底部提示（不强制，仅作提示）
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const check = () => {
      setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8);
    };
    check();
    el.addEventListener('scroll', check);
    return () => el.removeEventListener('scroll', check);
  }, []);

  const handleBackdrop = () => {
    if (!isGate) animateOut(onClose);
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-neutral-100 bg-white flex items-start gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-neutral-900">使用协议与免责声明</h2>
            <p className="text-xs text-neutral-400 mt-1">
              {isGate ? '首次使用前请阅读并确认以下内容' : '详情请查看以下使用协议'}
            </p>
          </div>
          {!isGate && (
            <button
              onClick={() => animateOut(onClose)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition shrink-0"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div ref={bodyRef} className="overflow-y-auto px-6 py-5 space-y-5">
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm text-amber-700 leading-relaxed">
            ⚠️ 本项目仅供学习与研究，请勿用于违反校规或作弊。使用风险自负。
          </div>
          {SECTIONS.map((section, i) => (
            <div key={i}>
              <h3 className="text-sm font-semibold text-neutral-800 mb-1.5">{section.title}</h3>
              <p className="text-sm text-neutral-600 leading-relaxed">{section.content}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 px-6 py-4 border-t border-neutral-100 bg-neutral-50/60">
          <span className="text-xs text-neutral-400 flex-1">
            {atBottom ? '已阅读至底部' : '请向下滚动阅读完整内容'}
          </span>
          {isGate ? (
            <>
              <button
                onClick={() => animateOut(onDecline)}
                className="px-5 py-2.5 rounded-xl border border-neutral-200 text-sm text-neutral-600 font-medium hover:bg-white transition active:scale-[0.97]"
              >
                我不同意并退出
              </button>
              <button
                onClick={() => animateOut(onAccept)}
                className="px-6 py-2.5 rounded-xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 transition active:scale-[0.97]"
              >
                我已知晓
              </button>
            </>
          ) : (
            <button
              onClick={() => animateOut(onClose)}
              className="px-6 py-2.5 rounded-xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 transition active:scale-[0.97]"
            >
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
