// 集成到你的应用：组件、hooks、不使用框架的网盘、外观、键盘与文字。

import { REPO, docHref } from '@/lib/site';
import type { PropGroup } from '../../reference';
import { referenceIn } from '../../referenceI18n';
import { C, Callout, Code, type DocPage, List, P, RefTable, Table, withCode } from '../../ui';
import { ACTIONS, ENTRIES, FILEDRIVE, GROUPS, PROVIDER, QUEUE, SHARED, SPANISH, THEMED, TOGETHER, UPLOADS, VANILLA, WHOLE, hookId, propId } from '../app';

const to = (slug: string) => docHref('zh', slug);
const SOURCE = 'apps/site/components/docs/pages/zh/app.tsx';
const { PROPS, HOOKS } = referenceIn('zh');
const GROUP_NAMES: Record<PropGroup, string> = { Server: '服务器', Look: '外观', Files: '文件', 'Word documents': 'Word 文档', Events: '事件' };

export const react: DocPage = {
  title: 'React 组件',
  description: '<FileDrive>：如何放进页面、按用途分类的全部属性、链接页面，以及属性变化时会发生什么。',
  source: SOURCE,
  lead: (
    <>
      <C>&lt;FileDrive&gt;</C> 就是完整的网盘：搜索、各个分区、列表和网格、详情、查看器、上传、共享和设置。它占满给它的高度，对你的 CSS 没有任何要求。
    </>
  ),
  sections: [
    {
      id: 'put-it-in-a-page',
      title: '放进页面',
      badge: '开始',
      color: 'purple',
      lead: '一个客户端组件，放在有高度的元素中。安装 Rebodocs 后，Word 文档会由它的引擎读取。',
      body: <Code lang="tsx" code={FILEDRIVE} file="app/files/page.tsx" />,
    },
    ...GROUPS.map((group) => ({
      id: `props-${group.toLowerCase().replace(/\s+/g, '-')}`,
      title: `属性：${GROUP_NAMES[group]}`,
      badge: '属性',
      color: 'yellow' as const,
      body: (
        <RefTable
          label={`属性：${GROUP_NAMES[group]}`}
          name="属性"
          rows={PROPS.filter((prop) => prop.group === group).map((prop) => ({ id: propId(prop.name), name: prop.name, type: prop.type, does: withCode(prop.does) }))}
        />
      ),
    })),
    {
      id: 'the-link-page',
      title: '链接页面',
      badge: '共享',
      color: 'pink',
      lead: '收到链接的人无需登录即可看到的内容：可阅读的文件、其中的文件夹、打包下载的 .zip；如果设置了密码，会先要求输入。',
      body: (
        <>
          <Code lang="tsx" code={SHARED} file="app/shared/page.tsx" />
          <P>
            用 <C>linkAddress</C> 让网盘的链接指向这个页面。
          </P>
        </>
      ),
    },
    {
      id: 'when-a-prop-changes',
      title: '属性变化时',
      badge: '须知',
      color: 'green',
      body: (
        <List
          items={[
            <>
              <C>language</C>、<C>theme</C>、<C>title</C> 和各个回调在变化时立即生效，无需重新启动。
            </>,
            <>
              <C>base</C>、<C>client</C> 或 <C>headers</C> 变化时会重新创建网盘的客户端；正在上传的内容继续使用旧的客户端。
            </>,
            <>
              放在你自己的 <C>&lt;DriveProvider&gt;</C> 中时，它会使用该 provider 的客户端和文字：它做的操作，你的 hooks 都能看到。
            </>,
          ]}
        />
      ),
    },
  ],
};

export const hooks: DocPage = {
  title: 'Headless：你自己的界面',
  description: '逐个介绍 @rebofiles/react 的 hooks、网盘与你自己的组件如何搭配，以及完全由 hooks 搭建的网盘。',
  source: SOURCE,
  lead: <>组件完全由这些 hooks 构建而成：用它们搭建使用你自己标记和外观的网盘，或者在完整网盘旁边放上其中一部分。</>,
  sections: [
    {
      id: 'the-hooks',
      title: 'Hooks 一览',
      badge: '参考',
      color: 'green',
      body: <RefTable label="Hooks" name="Hook" rows={HOOKS.map((hook) => ({ id: hookId(hook.name), name: hook.name, does: withCode(`${hook.short} ${hook.gives}`) }))} />,
    },
    { id: 'driveprovider', title: 'DriveProvider', badge: 'Provider', color: 'purple', lead: '客户端与文字，供其下的每个 hook 使用。', body: <Code lang="tsx" code={PROVIDER} /> },
    {
      id: 'useentries',
      title: 'useEntries',
      badge: '读取',
      color: 'blue',
      lead: '网盘的一个视图，每次通过 provider 做出改动后都会重新获取。',
      body: <Code lang="tsx" code={ENTRIES} />,
    },
    { id: 'useactions', title: 'useActions', badge: '修改', color: 'yellow', lead: '修改网盘的操作；每个操作完成后都会通知所有 hooks。', body: <Code lang="tsx" code={ACTIONS} /> },
    {
      id: 'useuploads',
      title: 'useUploads',
      badge: '上传',
      color: 'orange',
      lead: '文件三个一组发送，每个分片上传，显示速度和剩余时间，也提供全部文件的汇总。',
      body: <Code lang="tsx" code={UPLOADS} />,
    },
    {
      id: 'with-filedrive',
      title: '搭配 <FileDrive>',
      badge: '组合',
      color: 'pink',
      lead: '放在你的 provider 中的网盘会使用它：网盘中的操作，你的 hooks 能看到；你的 hooks 做的操作，网盘也会显示。',
      body: <Code lang="tsx" code={TOGETHER} />,
    },
    {
      id: 'a-whole-drive',
      title: '完整的网盘',
      badge: '示例',
      color: 'green',
      lead: '分区、路径、文件夹、带进度的上传、详情、重命名、版本、回收站和搜索：只用 hooks，别无其他。',
      body: (
        <>
          <P>
            它就是原样的 <a href={`${REPO}/blob/main/apps/playground/src/HooksDrive.tsx`}>apps/playground/src/HooksDrive.tsx</a>，位于 playground 的 <C>/headless.html</C>，并有一个 Chrome
            测试完整走一遍。<a href="/zh/demo/#headless">演示页</a>中还有另一个创意套件风格的例子。
          </P>
          <Code lang="tsx" code={WHOLE} file="HooksDrive.tsx" />
        </>
      ),
    },
  ],
};

export const vanilla: DocPage = {
  title: '不使用框架',
  description: '@rebofiles/drive 的 mountDrive 和 mountSharedLink，适用于不使用框架或使用非 React 框架的页面；以及它们底层可单独使用的各个部分。',
  source: SOURCE,
  lead: (
    <>
      <C>&lt;FileDrive&gt;</C> 挂载的其实是 <C>@rebofiles/drive</C>，它不需要任何框架：Vue、Svelte、Angular 或纯 HTML
      页面都可以。它接受相同的选项，重新渲染时只更新变化的部分，因此焦点和滚动位置都保持不变。
    </>
  ),
  sections: [
    { id: 'mount-it', title: '挂载', badge: '开始', color: 'purple', body: <Code code={VANILLA} /> },
    {
      id: 'the-pieces',
      title: '底层的各个部分',
      badge: '组成',
      color: 'blue',
      lead: '每个部分都已导出，可用来构建不依赖 React 的自定义界面。',
      body: (
        <>
          <Table
            label="组成部分"
            columns={['名称', '作用']}
            rows={[
              ['createDriveClient', '服务器的每条路由对应一个函数；支持续传的分片上传。'],
              ['createUploads', '上传队列：同时三个、速度、剩余时间，以及对已存在文件的询问。'],
              ['lookInDrive', '上传前在网盘中查找文件。'],
              ['readDropped, readChosen', '拖放或选择的文件夹中的文件及其路径。'],
              ['downloadZip, writeZip', '在页面中边下载边生成 .zip。'],
              ['renditionsOf, placeholderOf', '图片的缩小版本及其占位图。'],
              ['textOf, hashOf', '文件中的文字及其 SHA-256。'],
              ['CSS, TEXTS, translator', '限定在 .rf-drive 范围内的样式，以及文字。'],
            ]}
          />
          <Code code={QUEUE} />
        </>
      ),
    },
  ],
};

const VARS: [string, string][] = [
  ['--rf-brand', '选中项和主要按钮的颜色；取自设置中的品牌色。'],
  ['--rf-brand-hover, --rf-brand-light', '它的深色和浅色变体。'],
  ['--rf-ink, --rf-ink-soft, --rf-muted', '文字颜色，由深到浅。'],
  ['--rf-bg, --rf-surface, --rf-hover', '背景。'],
  ['--rf-border, --rf-border-strong', '线条。'],
  ['--rf-danger', '删除类操作。'],
  ['--rf-k-<kind>, --rf-k-<kind>-fg', '每种文件类型的图标块：folder、docx、pdf、sheet、image、text、video、audio。'],
  ['--rf-fc-<colour>, --rf-fc-<colour>-fg', '文件夹可用的九种颜色。'],
  ['--rf-font, --rf-mono', '字体。'],
  ['--rf-radius', '圆角。'],
];

export const styling: DocPage = {
  title: '样式与主题',
  description: '以自定义属性定义的网盘外观：浅色与深色、设置中的品牌色、你自己的类名，以及文件夹颜色。',
  source: SOURCE,
  lead: (
    <>
      只有一份样式表，限定在 <C>.rf-drive</C> 范围内，每种颜色、圆角和字体都是自定义属性。每组颜色的对比度都在 4.5:1 以上，浅色和深色主题皆是如此。
    </>
  ),
  sections: [
    {
      id: 'light-and-dark',
      title: '浅色与深色',
      badge: '主题',
      color: 'purple',
      body: (
        <P>
          <C>theme="dark"</C>、<C>"light"</C>，或跟随系统的 <C>"auto"</C>。网盘的设置提供默认主题，每个人可以在此之上选择自己的；这个属性介于两者之间。
        </P>
      ),
    },
    {
      id: 'the-brand-colour',
      title: '品牌色',
      badge: '设置',
      color: 'green',
      body: <P>有权配置网盘的人可以在设置中指定品牌色；网盘会生成它的深色和浅色变体，以及在其上清晰可读的文字颜色，适用于两种主题。</P>,
    },
    {
      id: 'custom-properties',
      title: '自定义属性',
      badge: 'CSS',
      color: 'blue',
      body: (
        <>
          <Table label="自定义属性" columns={['属性', '作用范围']} rows={VARS.map(([name, what]) => [name, what])} />
          <Code lang="tsx" code={THEMED} />
        </>
      ),
    },
    {
      id: 'your-own-look',
      title: '你自己的外观',
      badge: 'Headless',
      color: 'yellow',
      body: (
        <P>
          如果要完全使用你自己的标记和外观（Tailwind 或其他任何方案），请用 <a href={to('hooks')}>hooks</a> 构建。
        </P>
      ),
    },
  ],
};

const KEYS: [string, string][] = [
  ['↑ ↓、Home、End', '在列表或网格中移动。'],
  ['Enter', '打开：进入文件夹，或在查看器中打开文件。'],
  ['空格、Shift + ↑ ↓、⌘/Ctrl + A', '多选。'],
  ['F2', '重命名。'],
  ['Delete、Backspace', '移到回收站。'],
  ['⌘/Ctrl + Z', '撤销上一次移到回收站、移动、重命名或更改颜色。'],
  ['Shift + F10、菜单键', '打开所选内容的菜单。'],
  ['← →', '在查看器中切换到上一个和下一个文件。'],
  ['Escape', '关闭菜单、对话框或查看器。'],
];

export const accessibility: DocPage = {
  title: '键盘与无障碍',
  description: '每个操作都能用键盘完成、屏幕阅读器会听到什么，以及如何检查：在每个状态下用 axe 检查，浅色与深色主题皆然。',
  source: SOURCE,
  lead: <>鼠标能做的，键盘都能做，屏幕阅读器也能获知当前位置。浏览器测试到达的每个状态都会用 axe 按 WCAG 2.2 AA 标准检查，两种主题都会检查。</>,
  sections: [
    { id: 'the-keys', title: '按键', badge: '键盘', color: 'purple', body: <Table label="按键" columns={['按键', '作用']} rows={KEYS.map(([key, does]) => [key, does])} /> },
    {
      id: 'what-a-screen-reader-hears',
      title: '屏幕阅读器会听到什么',
      badge: '屏幕阅读器',
      color: 'blue',
      body: (
        <List
          items={[
            '列表是一个 listbox：每个条目都会读出所有者、日期和大小，以及已选择的数量。',
            '提示消息是会被朗读的 status，其中的“撤销”按钮可以用 Tab 访问。',
            '对话框会把焦点保持在内部，关闭时把焦点还给原来的位置。',
            '上传面板是一个 region；每个文件都有以其名称命名的进度条，失败时会发出 alert。',
            '文件夹颜色是一组单选按钮，每个都有名称。',
          ]}
        />
      ),
    },
    {
      id: 'how-it-is-checked',
      title: '如何检查',
      badge: '测试',
      color: 'green',
      body: (
        <P>
          <C>npm run test:browser</C> 只用键盘走遍整个网盘，并在每个状态下运行
          axe：空网盘和有文件时、列表和网格、每个对话框、回收站、搜索、手机宽度下的西班牙语界面、未登录访问链接，以及深色主题（手动选择和跟随系统）下的相同场景。
        </P>
      ),
    },
  ],
};

export const languages: DocPage = {
  title: '语言',
  description: '英文、西班牙文或中文的网盘、你自己的文字，以及由谁来选择：网盘设置、应用和每个人。',
  source: SOURCE,
  lead: <>网盘中的每个字都来自同一张文字表，提供英文、西班牙文和中文，日期和大小也按各语言的习惯显示。</>,
  sections: [
    { id: 'choose-one', title: '选择一种', badge: '开始', color: 'purple', body: <Code lang="tsx" code={SPANISH} /> },
    {
      id: 'who-chooses',
      title: '由谁选择',
      badge: '设置',
      color: 'blue',
      body: (
        <P>
          首先是每个人在网盘设置中的选择；其次是你的应用提供的 <C>language</C>；最后是网盘本身的设置，由有权配置的人设定。
        </P>
      ),
    },
    {
      id: 'a-language-of-your-own',
      title: '你自己的语言',
      badge: '文字',
      color: 'yellow',
      body: (
        <>
          <P>
            <C>texts</C> 接受一个与 <C>TEXTS.en</C> 键相同的对象；TypeScript 会提示缺少哪些键。值中可以包含 <C>{'{n}'}</C>、<C>{'{name}'}</C> 等占位符，填充方式与英文相同。
          </P>
          <Callout title="服务器返回的错误">
            以英文返回，并带有具体的名称和数字。在西班牙文和中文中，网盘按其代码（<C>RequestError.code</C>）用自己的文字显示；自定义界面可使用 <C>refusalText(error, language)</C>
            。你的应用自己的代码（来自自定义的 <C>Refused</C>）按服务器原文显示。
          </Callout>
          <Callout title="Rebodocs 支持英文和西班牙文。">在中文界面下，网盘是中文的，但其中 Rebodocs 的缩放栏和编辑器仍为英文，直到 Rebodocs 提供中文。</Callout>
        </>
      ),
    },
  ],
};
