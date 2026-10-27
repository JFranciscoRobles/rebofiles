// 参考：各个包、React 包导出的一切、客户端、路由，以及已验证的内容。
// 实测数据（测试、限制、路线图）保留英文，与 ROADMAP.md 一致。

import { PUBLISHED, VERSION } from '@/lib/home';
import { REPO, docHref } from '@/lib/site';
import { InstallCommand } from '../../frame/InstallCommand';
import { referenceIn } from '../../referenceI18n';
import { CHECKED, LIMITS, MEASURED, NOT_CHECKED, TESTS } from '../../status/data';
import { C, Callout, Code, type DocPage, List, P, RefTable, Table, withCode } from '../../ui';
import { hookId, propId } from '../app';
import { CLIENT_CODE, GROUPS, Milestones, RouteTable, Rows, clientId, packageId } from '../reference';

const to = (slug: string) => docHref('zh', slug);
const { CLIENT, HOOKS, PACKAGE_DOCS, PROPS } = referenceIn('zh');
const SOURCE = 'apps/site/components/docs/pages/zh/reference.tsx';
const GROUP_NAMES: Record<(typeof GROUPS)[number], string> = {
  Reading: '读取',
  Changing: '修改',
  Uploads: '上传',
  Sharing: '共享',
  Files: '文件',
  Settings: '设置',
  Live: '实时',
  Comments: '评论',
  Keeping: '保留',
  Told: '通知',
  'Looking after': '管理',
  Requests: '文件收集',
};
const ROUTE_WORDS: [string, string, string, string] = ['路由', '链接的路由', '路由', '作用'];
const IN_ENGLISH = <Callout title="英文内容：">实测数据和路线图只用英文编写一次，与 ROADMAP.md 相同。</Callout>;

export const packages: DocPage = {
  title: '包',
  description: '六个包，各司其职，版本统一：该安装哪个、各自运行在哪里、各自提供什么，以及仓库中的应用。',
  source: SOURCE,
  lead: <>所有包都处于同一版本 {VERSION}，并一起更新。除了 core 以及注明的可选对等依赖 Rebodocs 之外，它们没有其他依赖。</>,
  sections: [
    {
      id: 'which-one',
      title: '我该安装哪个？',
      badge: '从这里开始',
      color: 'blue',
      body: (
        <List
          items={[
            <>
              React 应用：页面使用 <C>@rebofiles/react</C>，路由使用 <C>@rebofiles/server</C>。
            </>,
            <>
              不使用 React 的页面：<C>@rebofiles/drive</C>，再加上服务器。
            </>,
            <>
              在自己的后台任务中修改网盘：<C>@rebofiles/core</C>。
            </>,
            <>
              AI 助手：<C>@rebofiles/mcp</C>，放在服务器旁边。
            </>,
          ]}
        />
      ),
    },
    ...PACKAGE_DOCS.map((pkg) => ({
      id: packageId(pkg.name),
      title: pkg.name,
      badge: pkg.comes ? `将于 ${pkg.comes} 推出` : pkg.runs,
      color: pkg.comes ? ('orange' as const) : ('purple' as const),
      lead: pkg.what,
      body: pkg.comes ? null : (
        <>
          {PUBLISHED && (
            <div className="mt-5">
              <InstallCommand command={pkg.install} />
            </div>
          )}
          <P>
            {pkg.gives.map((name, i) => (
              <span key={name}>
                {i > 0 && ', '}
                <C>{name}</C>
              </span>
            ))}
            {' · '}
            <a href={`${REPO}/tree/main/packages/${pkg.name.replace('@rebofiles/', '')}#readme`}>它的 README</a>
          </P>
        </>
      ),
    })),
    {
      id: 'the-applications',
      title: '应用',
      badge: 'Apps',
      color: 'green',
      body: (
        <P>
          <a href={to('demos')}>可运行的演示</a>：playground、演示、真实存储桶、桌面端和本网站，每个都是 <C>apps/</C> 下的一个文件夹。
        </P>
      ),
    },
  ],
};

const EXPORTS: [string, string][] = [
  ['FileDrive', '完整的网盘。'],
  ['SharedLink', '收到链接的人无需登录即可看到的内容。'],
  ['createMemoryClient', '保存在页面中的网盘，提供与服务器路由相同的客户端。'],
  ['createDriveClient, createLinkClient', '来自 @rebofiles/drive 的客户端。'],
  ['RequestError', '服务器拒绝的请求：状态码、代码和消息。'],
  ['TEXTS, formatSize, formatDate, formatDuration, kindOf', '文字，以及描述文件的辅助函数。'],
  ['@rebofiles/react/rebodocs', 'previewDocx、viewDocx、thumbDocx、pictureOfDocx、textOfDocx：由 Rebodocs 引擎处理的 Word 文档。'],
];

export const components: DocPage = {
  title: '组件与 hooks',
  description: '@rebofiles/react 导出的一切：两个组件、七个 hooks、<FileDrive> 的每个属性，以及相关函数。',
  source: SOURCE,
  lead: <>React 应用所需的一切都在这一个包中；它与不使用框架的网盘共享的部分也从这里导出。</>,
  sections: [
    { id: 'exports', title: '导出', badge: '全部', color: 'blue', body: <Table label="导出" columns={['名称', '说明']} rows={EXPORTS.map(([name, what]) => [name, what])} /> },
    {
      id: 'hooks',
      title: 'Hooks',
      badge: 'Hooks',
      color: 'green',
      body: <RefTable label="Hooks" name="Hook" rows={HOOKS.map((hook) => ({ id: `ref-${hookId(hook.name)}`, name: hook.name, does: withCode(`${hook.short} ${hook.gives}`) }))} />,
    },
    {
      id: 'props',
      title: '<FileDrive> 的全部属性',
      badge: '属性',
      color: 'yellow',
      body: (
        <>
          <RefTable label="FileDrive 的属性" name="属性" rows={PROPS.map((prop) => ({ id: `ref-${propId(prop.name)}`, name: prop.name, type: prop.type, does: withCode(prop.does) }))} />
          <P>
            按用途分类并附示例：<a href={to('react')}>React 组件</a>。
          </P>
        </>
      ),
    },
  ],
};

export const client: DocPage = {
  title: '客户端 API',
  description: 'createDriveClient：服务器的每条路由对应一个函数，按用途分组，以及它抛出的拒绝错误。',
  source: SOURCE,
  lead: (
    <>
      网盘和 hooks 所基于的客户端；<C>createMemoryClient</C> 在页面中以相同方式应答。服务器的拒绝会以 <C>RequestError</C> 抛出，带有 <C>status</C> 和 <C>code</C>：<C>name-taken</C>、<C>in-trash</C>、
      <C>over-quota</C>、<C>forbidden</C>……
    </>
  ),
  sections: [
    { id: 'make-one', title: '创建客户端', badge: '开始', color: 'purple', body: <Code code={CLIENT_CODE} /> },
    ...GROUPS.map((group) => ({
      id: `client-${group.toLowerCase()}`,
      title: GROUP_NAMES[group],
      badge: '方法',
      color: 'blue' as const,
      body: (
        <RefTable
          label={`客户端：${GROUP_NAMES[group]}`}
          name="方法"
          rows={CLIENT.filter((method) => method.group === group).map((method) => ({ id: clientId(method.name), name: method.signature, does: withCode(method.does) }))}
        />
      ),
    })),
  ],
};

export const routesPage: DocPage = {
  title: 'HTTP 路由',
  description: '@rebofiles/server 的全部路由，与代码中的定义一致：已登录用户的路由，以及链接的路由。',
  source: 'packages/server/src/api.ts',
  lead: (
    <>
      位于处理器的 <C>base</C> 之下，本文档中为 <C>/api/files</C>。构建本网站时从 <C>packages/server/src/api.ts</C> 开头的注释中读取，因此包含代码中的全部路由；每条路由的作用在此译出。请求和响应体均为
      JSON；拒绝时返回 <C>&#123; error, message &#125;</C> 及相应状态码：<C>message</C> 为英文，云盘会根据 <C>error</C> 用每个人的语言显示。
    </>
  ),
  sections: [
    {
      id: 'signed-in',
      title: '已登录用户',
      badge: '会话',
      color: 'blue',
      lead: '每条路由都会询问 identify 是谁在请求，并询问 authorize 是否允许。',
      body: <RouteTable through="session" words={ROUTE_WORDS} locale="zh" />,
    },
    {
      id: 'through-a-link',
      title: '通过链接',
      badge: '链接',
      color: 'pink',
      lead: '两者都不询问：链接本身就是权限。带密码的链接会在每次请求时要求提供密码。',
      body: <RouteTable through="link" words={ROUTE_WORDS} locale="zh" />,
    },
  ],
};

export const status: DocPage = {
  title: '状态与路线图',
  description: '已验证的内容及各包的测试；尚未验证的内容；已知限制；以及路线图。',
  source: SOURCE,
  lead: (
    <>
      版本 {VERSION}，{PUBLISHED ? '已发布到 npm' : '尚未发布到 npm'}。这些数字来自 {MEASURED} 实际运行命令的结果，而不是凭记忆填写；<a href={`${REPO}/blob/main/ROADMAP.md`}>ROADMAP.md</a>{' '}
      中的内容与此相同。
    </>
  ),
  sections: [
    {
      id: 'what-is-checked',
      title: '已验证的内容',
      badge: '测试',
      color: 'green',
      lead: `共 ${TESTS.reduce((sum, row) => sum + row.count, 0)} 个测试，全部通过，由 npm test 以及在 Chrome 中运行的 npm run test:browser 执行。`,
      body: (
        <>
          {IN_ENGLISH}
          <div className="mt-5 max-w-[920px] overflow-hidden rounded-[14px] border border-border">
            {TESTS.map((row) => (
              <div key={row.where} className="grid grid-cols-[1fr_auto] gap-x-5 gap-y-1 border-t border-border px-4.5 py-3.5 first:border-t-0">
                <p className="m-0 font-code text-[14px] font-medium text-ink">{row.where}</p>
                <p className="row-span-2 m-0 self-center font-display text-[28px] font-extrabold tracking-[-0.03em] text-brand">{row.count}</p>
                <p className="m-0 text-[15px] text-ink-soft" lang="en">
                  {row.what}
                </p>
              </div>
            ))}
          </div>
        </>
      ),
    },
    {
      id: 'checked-by-hand',
      title: '人工验证',
      badge: '人工',
      color: 'blue',
      body: (
        <div lang="en">
          <Rows rows={CHECKED} />
        </div>
      ),
    },
    {
      id: 'what-is-not',
      title: '尚未验证',
      badge: '尚未',
      color: 'pink',
      body: (
        <div lang="en">
          <Rows rows={NOT_CHECKED} />
        </div>
      ),
    },
    {
      id: 'known-limits',
      title: '已知限制',
      badge: '限制',
      color: 'yellow',
      body: (
        <div className="mt-5 grid max-w-[920px] gap-3 sm:grid-cols-2" lang="en">
          {LIMITS.map((group) => (
            <div key={group.area} className="rounded-[14px] border border-border p-4.5">
              <p className="m-0 font-semibold text-ink">{group.area}</p>
              <ul className="m-0 mt-2 list-disc space-y-1.5 pl-5 text-[15px] text-ink-soft">
                {group.items.map((item) => (
                  <li key={item}>{withCode(item)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'roadmap',
      title: '路线图',
      badge: '下一步',
      color: 'purple',
      lead: '按开发顺序排列。每个版本在最后一项完成后才发布到 npm，不会提前。',
      body: (
        <div lang="en">
          <Milestones of={(done, all) => `${done}/${all}`} notYet="(not yet)" />
        </div>
      ),
    },
    { id: 'license', title: '许可证', badge: 'MIT', color: 'orange', body: <P>MIT。任何人都可以将其用于任何用途，包括商业用途，不提供任何担保。</P> },
  ],
};
