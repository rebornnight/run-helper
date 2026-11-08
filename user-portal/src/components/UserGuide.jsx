import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';

const STEPS = [
  {
    title: '下载安装 Reqable',
    subtitle: '跨平台调试工具',
    images: ['/guide/step1-01.png', '/guide/step1-02.png', '/guide/step1-03.png', '/guide/step1-04.png', '/guide/step1-05.jpg', '/guide/step1-06.jpg', '/guide/step1-07.jpg'],
    captions: [
      '点击下载后会跳转到下面的页面，根据自己的电脑系统选择对应的版本下载，由于我的电脑系统为Win11，以下演示以Win系统演示，其它系统的操作方式基本一样',
      '下载完成之后会弹出如图所示的弹窗，点击文件图标打开文件路径',
      <>打开文件路径后双击此文件（如果下载的是压缩包需要先解压，不知道怎么解压的可以下载免费的解压软件<a href="https://7-zip.org" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400 underline">7zip</a>或<a href="https://www.bandisoft.com/bandizip/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400 underline">Bandzip</a>进行解压）</>,
      '双击后会弹出以下安装窗口，第一步先勾选以创建桌面快捷方式，然后点击next',
      '进入下一页面，可以点击Browse浏览，选择你要下载到的文件路径，建议不要下载到C盘，选择好后点击next',
      '下一个页面会显示之前选择的文件下载路径和是否创建快捷方式，确认无误后即可点击安装（如果想要改变可以点击back来回退页面以更改选项），安装完成后点击finish',
    ],
    description: (
      <>
        打开 <a href="https://reqable.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400 underline">Reqable 官方网站</a>，根据自己的操作系统下载 Reqable（免费版即可）。下载后按提示完成安装。
      </>
    ),
  },
  {
    title: '安装安全证书',
    subtitle: '安装根证书到系统',
    images: ['/guide/step2-01.png', '/guide/step2-02.png', '/guide/step2-03.png', '/guide/step2-04.png', '/guide/step2-05.png'],
    captions: [
      '之后点击页面左上角的证书',
      '点击安装根证书到本机',
      '安装根证书分为自动安装和手动安装两种，这里演示自动安装，点击「现在安装」即可',
      '点击会弹出系统提示，点击"是"即可',
      '安装完成后弹出下面这个界面就说明成功了',
    ],
    note: '如果自动安装失败，请手动安装，请自行查看手动安装说明。',
    description:
      '安装完成后会自动打开并运行，按照图片中的步骤先点击删除然后暂停即可',
  },
  {
    title: '获取模拟环境',
    subtitle: '获取模拟所需数据',
    images: ['/guide/step3-01.png', '/guide/step3-02.png', '/guide/step3-03.png', '/guide/step3-04.png', '/guide/step3-05.png', '/guide/step3-06.png', '/guide/step3-07.png'],
    captions: [null, '打开调试后最小化窗口，然后打开微信并登录校园跑绑定的微信账号，点击侧边栏的小程序', '进入小程序的页面后点击校园跑的小程序', '接下来按照以下图片的流程操作即可', null, '登入进来后点击校园乐跑', '进入乐跑页面后点击乐跑记录，进入页面后即可退出'],
    description: '安装好证书后即可打开Reqable，如果调试记录不是空的就先点击删除再点击调试，如果本来就是空的就直接点击调试',
    imageMaxHeights: [null, null, null, 500, 500, 500, 500],
  },
  {
    title: '导出请求数据',
    subtitle: '获取并导出请求信息',
    images: ['/guide/step4-01.png', '/guide/step4-02.png', '/guide/step4-03.png'],
    captions: ['完成了上一步的步骤后关闭微信，回到Raqable可以看到多了许多的调试记录，在左边的侧边栏勾选域名api.lptiyu.com(其它的不要勾选），勾选完之后会自动筛选与该域名相关的调试记录', '筛选之后全选右边的调试记录', '右键任意一条，点击复制cURL，复制完成后粘贴到本项目的模拟环境页面里的输入框，然后点击导入配置即可'],
  },
  {
    title: '卸载软件与证书',
    subtitle: '提供卸载说明供用户参考',
    images: ['/guide/step5-01.png', '/guide/step5-02.png', '/guide/step5-03.jpg', '/guide/step5-04.jpg', '/guide/step5-05.jpg'],
    captions: ['卸载软件按照当时选择的下载的路径找到Raqable,先单击选中，然后同时按住Shift+Delete即可彻底删除（注意，请在卸载之前确保退出软件运行，直接在托盘找到对应图标右键点击退出即可）', '接下里演示如何卸载证书，先Win+R打开运行面板，输入certmgr.msc,回车或点击确定', '单机选择受信任的根证书颁发机构', '双击右边的证书', '然后找到Raqable开头的证书，先单击选中然后右键点击卸载即可'],
  },
];

function StepSection({ step, index, isActive, onToggle }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.4, delay: index * 0.06, ease: 'power2.out' }
      );
    }, ref);
    return () => ctx.revert();
  }, [index]);

  return (
    <div ref={ref} className="card-apple rounded-super border border-neutral-100/60 shadow-apple-sm overflow-hidden mb-5">
      <button
        onClick={() => onToggle(index)}
        className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-neutral-50/50 transition"
      >
        <span className="w-8 h-8 rounded-full bg-neutral-900 text-white text-sm font-semibold flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-neutral-900">{step.title}</h3>
          <p className="text-base font-medium text-neutral-500 mt-0.5">{step.subtitle}</p>
        </div>
        <svg
          className={`w-5 h-5 text-neutral-300 transition-transform duration-300 ${isActive ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div
        className={`overflow-hidden transition-all duration-500 ease-out ${isActive ? 'max-h-[20000px]' : 'max-h-0'}`}
      >
        <div className="px-6 pb-6 pt-2 border-t border-neutral-100">
          {step.description && (
            <p className="text-base font-medium text-neutral-700 leading-relaxed mb-5">{step.description}</p>
          )}
          {step.images.length > 0 && (
            <div className="grid gap-4">
              {step.images.map((src, i) => (
                <div key={i}>
                  {step.captions?.[i] && (
                    <p className="mb-2 text-base font-medium text-neutral-600 leading-relaxed px-1">
                      {step.captions[i]}
                    </p>
                  )}
                  <div className="rounded-xl overflow-hidden border border-neutral-100 bg-neutral-50" style={step.imageMaxHeights?.[i] != null ? { maxHeight: step.imageMaxHeights[i], height: step.imageMaxHeights[i] } : undefined}>
                    <img
                      src={src}
                      alt={`${step.title} - 图 ${i + 1}`}
                      className={`w-full ${step.imageMaxHeights?.[i] != null ? 'h-full object-contain' : 'h-auto'}`}
                      loading="lazy"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          {step.note && (
            <p className="mt-4 text-base font-medium text-neutral-600 leading-relaxed px-1">{step.note}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UserGuide() {
  const [openStep, setOpenStep] = useState(null);
  const headerRef = useRef(null);

  useEffect(() => {
    if (!headerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        headerRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
      );
    }, headerRef);
    return () => ctx.revert();
  }, []);

  const toggleStep = (i) => {
    setOpenStep((prev) => (prev === i ? null : i));
  };

  return (
    <div>
      <div ref={headerRef}>
        <h2 className="text-heading text-neutral-900">使用说明</h2>
        <p className="text-base font-medium text-neutral-500 mt-1">
          从零开始配置模拟跑步环境，共 5 个步骤
        </p>
      </div>

      <div className="mt-8">
        {STEPS.map((step, i) => (
          <StepSection
            key={i}
            step={step}
            index={i}
            isActive={openStep === i}
            onToggle={toggleStep}
          />
        ))}
      </div>

      {/* Bottom tip */}
      <div className="card-apple rounded-super p-5 border border-amber-100/60 bg-amber-50/30 shadow-apple-sm mt-6">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div className="text-base font-medium text-neutral-700 leading-relaxed">
            <p className="font-semibold text-neutral-900 mb-1">注意事项</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Reqable 为第三方调试工具，与本项目无关联；请勿用它获取、篡改他人信息，否则自行承担法律责任</li>
              <li>本项目只在本机运行：导入的配置仅保存在本地 data.db，token 加密存储，不会上传到任何服务器</li>
              <li>若不再使用，可在「模拟环境」页面点击「取消授权并删除相关数据」，彻底清除本地配置</li>
              <li>本项目仅供学习研究（Flask / 逆向 / 加密协议），请勿用于违反校规或作弊，使用风险自负</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
