import gsap from 'gsap';

export const API = '/api';

// 不携带任何认证头，请求直接打到本地后端。
// 第三个参数保留仅为兼容旧调用（会被忽略）。

export async function apiPost(path, body) {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) {
    const err = new Error(data.error || '请求失败');
    err.status = r.status;
    err.retry_after = data.retry_after;
    throw err;
  }
  return data;
}

export async function apiGet(path) {
  const r = await fetch(API + path);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || '请求失败');
  return data;
}

export async function apiDelete(path) {
  const r = await fetch(API + path, { method: 'DELETE' });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || '请求失败');
  return data;
}

// ── Toast ──
export function showMsg(text, type = 'success') {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', top: '24px', left: '50%', translate: '-50% 0',
    padding: '12px 24px', borderRadius: '10px', fontSize: '14px',
    fontWeight: 600, zIndex: 9999, fontFamily: 'inherit',
    background: type === 'error' ? '#fef2f2' : '#f0fdf4',
    color: type === 'error' ? '#dc2626' : '#16a34a',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
  });
  el.textContent = text;
  document.body.appendChild(el);

  const ctx = gsap.context(() => {
    gsap.fromTo(el, { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
  });

  setTimeout(() => {
    gsap.to(el, { opacity: 0, y: -12, duration: 0.25, ease: 'power2.in', onComplete: () => { ctx.revert(); el.remove(); } });
  }, 4000);
}

// ── 提交状态归一 ──
// 乐跑对「当天关联成绩已达上限」返回 record_status = 0（待审核），
// 业务上应视为失败；这里统一归一，历史旧记录也能正确展示。
export const STATUS_LABEL = { 0: '待审核', 1: '成功', 2: '失败', 5: '失败' };

export function runStatusOf(run) {
  if (!run) return 0;
  const st = Number(run.status);
  if (st === 0 && run.reason && String(run.reason).includes('上限')) return 2;
  return st;
}

export function statusLabel(run) {
  return STATUS_LABEL[runStatusOf(run)] || '未知';
}
