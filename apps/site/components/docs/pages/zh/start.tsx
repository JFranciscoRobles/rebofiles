// 开始：ReboFiles 是什么、运行第一个网盘，以及仓库中的演示。

import { LiveDemo } from '@/components/home/LiveDemo';
import { PUBLISHED, VERSION } from '@/lib/home';
import { docHref } from '@/lib/site';
import { InstallCommand } from '../../frame/InstallCommand';
import { C, Callout, Cards, Code, DemoBox, type DocPage, List, P, Table } from '../../ui';
import { MEMORY, PAGE, REPOSITORY, ROUTE } from '../start';

const to = (slug: string) => docHref('zh', slug);
const SOURCE = 'apps/site/components/docs/pages/zh/start.tsx';

export const index: DocPage = {
  title: '什么是 ReboFiles',
  description: '一个嵌入你应用、使用你自己存储的浏览器文件网盘：它能做什么、由哪些包组成，以及它不是什么。',
  source: SOURCE,
  lead: (
    <>
      ReboFiles 是一个运行在你应用内部的浏览器文件管理器：文件夹、上传、预览、版本、回收站和共享，文件内容存放在你自己的存储桶中，条目信息存放在你自己的数据库里。它是 Rebo 套件中的网盘，与{' '}
      <a href="https://www.rebodocs.com">Rebodocs</a> 并列，以独立的包按需引入。
    </>
  ),
  tip: '提示：下面的网盘正在运行，随便点点看',
  sections: [
    {
      id: 'try',
      title: '运行中的网盘',
      badge: '在线',
      color: 'green',
      lead: '首页上的演示：网盘保存在这个页面中，Acme 的文件也是在这里生成的。所有内容都不离开浏览器。',
      body: (
        <DemoBox title="试一试">
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: 它可以横向滚动，键盘需要能访问被遮住的部分（WCAG 2.1.1） */}
          <section className="overflow-x-auto" aria-label="演示" tabIndex={0}>
            <LiveDemo locale="zh" />
          </section>
        </DemoBox>
      ),
    },
    {
      id: 'what-you-get',
      title: '你能得到什么',
      badge: '功能',
      color: 'blue',
      body: (
        <List
          items={[
            <>
              <strong>看得见的上传。</strong>分片直传到存储桶，同时三个，每个都显示剩余时间；整个文件夹保持原有结构；中断后从断点继续。
            </>,
            <>
              <strong>识别同一个文件。</strong>上传前先在网盘中查找相同内容或相同名称的文件：作为新版本替换、两者都保留，或跳过。
            </>,
            <>
              <strong>文件夹与搜索。</strong>多层文件夹、九种颜色、任意排序，可按名称搜索，也可按文件中的文字搜索。
            </>,
            <>
              <strong>预览与查看器。</strong>借助 Rebodocs 逐页查看 Word 文档，还有 PDF、四种尺寸且加载时先模糊显示的图片、视频、音频和文本。
            </>,
            <>
              <strong>版本、回收站与空间。</strong>每次保存都保留之前的文件；回收站在你设定的天数后自动清空；每个人都有配额。
            </>,
            <>
              <strong>共享。</strong>查看者、评论者和编辑者，权限沿目录树向下继承；可设置有效期、密码或仅限一次下载的链接；“与我共享”中会提示新内容。
            </>,
            <>
              <strong>动态记录。</strong>谁对每个文件和文件夹做了什么，由你的数据库保存。
            </>,
            <>
              <strong>打包下载 .zip</strong>，可打包选中的文件、一个文件夹或共享链接中的文件夹，在页面中生成。
            </>,
            <>
              <strong>AI 助手。</strong>通过 MCP 为 Claude 提供工具，权限与用户本人一致；借助 Rebodocs 编辑 Word 文档，每次修改都是一个版本。
            </>,
            <>
              <strong>实时。</strong>他人的更改立即显示；带回复和 @ 提及的评论；上千个文件的文件夹；按需读取网盘。
            </>,
            <>
              <strong>安全可靠。</strong>按字节和 ClamAV 检查文件，限制请求过于频繁的人，最少保留天数，法律保留，导出某人的全部数据。
            </>,
            <>
              <strong>键盘与屏幕阅读器</strong>、浅色与深色、英文、西班牙文和中文、设置界面，以及可同步文件夹的桌面应用。
            </>,
          ]}
        />
      ),
    },
    {
      id: 'the-packages',
      title: '包',
      badge: '选择',
      color: 'purple',
      body: (
        <>
          <Table
            label="包"
            columns={['包', '适用场景']}
            rows={[
              ['@rebofiles/react', '你有一个 React 或 Next.js 应用，想在其中某个页面放入网盘，可以整体使用，也可以基于 hooks 构建。'],
              ['@rebofiles/drive', '你的页面不使用框架，或使用的不是 React：同一个网盘，挂载到一个元素上。'],
              ['@rebofiles/server', '你的后端负责保存条目并签名地址：一条路由，输入 Request，输出 Response。'],
              ['@rebofiles/core', '你要在代码中修改网盘，比如在任务或自己的存储中：以纯函数形式提供的模型。'],
              ['@rebofiles/mcp', '需要让 AI 助手以用户本人的权限查找、阅读和归档文档。'],
            ]}
          />
          <P>
            <a href={to('packages')}>包</a>一页介绍了每个包包含什么，以及它们之间的依赖关系。
          </P>
        </>
      ),
    },
    {
      id: 'how-it-is-built',
      title: '设计原则',
      badge: '已定',
      color: 'yellow',
      body: (
        <List
          items={[
            <>
              <strong>文件内容从不经过你的服务器。</strong>浏览器把它们发送到服务器按确切长度签名的地址，读取时也同样如此。
            </>,
            <>
              <strong>条目信息存放在旁边的存储中。</strong>存储桶没有文件夹、所有者或回收站的概念；文件的键是它的 id，而不是路径，所以移动和重命名从不触及文件内容。
            </>,
            <>
              <strong>谁可以做什么由你的应用决定。</strong>每条路由都会调用 <C>identify</C> 和 <C>authorize</C>；ReboFiles 本身没有用户体系。
            </>,
            <>
              <strong>没有运行时依赖。</strong>S3 签名使用 <C>node:crypto</C>，SQLite 使用 <C>node:sqlite</C>，.zip 在页面中生成。
            </>,
          ]}
        />
      ),
    },
    {
      id: 'what-it-is-not',
      title: '它不是什么',
      badge: '坦白说',
      color: 'pink',
      body: (
        <List
          items={[
            <>
              <strong>不是托管服务。</strong>无需注册任何东西：它是你自己运行的代码，使用你自己的存储。
            </>,
            <>
              <strong>尚未完成。</strong>
              {PUBLISHED ? `已以 ${VERSION} 发布到 npm` : '已经过测试，但尚未发布到 npm'}，也并非无所不能：<a href={to('status')}>状态与路线图</a>列出了已验证的和尚缺的内容。
            </>,
          ]}
        />
      ),
    },
  ],
};

const COMMANDS: [string, string][] = [
  ['npm run dev', 'Playground：完整网盘，服务器与页面在同一进程，文件内容存放在一个文件夹中，条目存放在 SQLite 中。`?as=bea` 表示以另一个人的身份访问。'],
  ['npm run demo', '首页演示：网盘保存在页面中，包含 Claude 对 MCP 工具的调用。'],
  ['npm run storage', '连接真实存储桶（R2、S3、MinIO）的网盘，配置来自 `apps/storage/.env`。'],
  ['npm run storage:check', '在 Node 中针对该存储桶走一遍文件的完整流程，最后全部删除。'],
  ['npm run desktop', '基于 Tauri 的桌面应用，连接 playground。'],
  ['npm run site', '本网站。'],
  ['npm test', '在 Node 中运行所有包的测试。'],
  ['npm run test:browser', '用 Playwright 在 Chrome 中测试网盘，每个状态都用 axe 检查。'],
  ['npm run typecheck', '对各个包和应用进行严格的 TypeScript 检查。'],
  ['npm run lint', 'Biome。'],
];

export const gettingStarted: DocPage = {
  title: '快速开始',
  description: '在 Next.js 应用中放入网盘：页面、路由以及接下来的方向；完全不需要服务器的网盘；以及仓库中的命令。',
  source: SOURCE,
  lead: (
    <>
      三个部分：页面中的 <C>&lt;FileDrive&gt;</C>；服务器上的一条路由，负责保存条目并询问你的应用谁可以做什么；以及保存文件内容的存储桶。本页把前两部分放进一个 Next.js 应用；
      <a href={to('storage')}>存储</a>一页介绍第三部分。
    </>
  ),
  sections: [
    {
      id: 'install',
      title: '安装',
      badge: 'npm',
      color: 'blue',
      lead: '页面使用 @rebofiles/react，路由使用 @rebofiles/server。需要 React 18 及以上、Node 22.12 及以上。',
      body: PUBLISHED ? (
        <div className="mt-5">
          <InstallCommand command="npm install @rebofiles/react @rebofiles/server" />
        </div>
      ) : (
        <>
          <Callout title="尚未发布到 npm。">0.1.0 会在剩余工作完成后发布。在此之前，这里的一切都可以从仓库运行：见最后一节。</Callout>
          <div className="mt-5">
            <InstallCommand command="npm install @rebofiles/react @rebofiles/server" />
          </div>
        </>
      ),
    },
    {
      id: 'the-page',
      title: '页面',
      badge: 'React',
      color: 'purple',
      lead: '完整的网盘，占满给它的高度。',
      body: (
        <>
          <Code lang="tsx" code={PAGE} file="app/files/page.tsx" />
          <P>
            这就包含了搜索、我的文件、与我共享、最近和回收站，列表和网格，预览和查看器，版本，动态记录，通过按钮或拖放文件和文件夹上传，以及设置界面。
            <a href={to('react')}>React 组件</a>一页列出了所有属性。
          </P>
        </>
      ),
    },
    {
      id: 'the-route',
      title: '路由',
      badge: '服务器',
      color: 'pink',
      lead: 'createDriveHandler 接收 Request 并返回 Response，因此它本身就是一个 Next.js 路由处理器。',
      body: (
        <>
          <Code code={ROUTE} file="app/api/files/[...path]/route.ts" />
          <P>
            <C>identify</C> 根据你的会话判断谁在请求；<C>byRoles</C> 根据网盘本身判断谁可以做什么。<a href={to('server')}>路由</a>和<a href={to('authorize')}>谁可以做什么</a>
            两页分别详细介绍。
          </P>
        </>
      ),
    },
    {
      id: 'no-server',
      title: '不使用服务器',
      badge: '纯页面内',
      color: 'green',
      lead: '用于演示、故事书或测试：网盘保存在页面中，文件内容以 Blob 形式存在。',
      body: <Code lang="tsx" code={MEMORY} />,
    },
    {
      id: 'where-to-go-next',
      title: '下一步',
      badge: '下一步',
      color: 'yellow',
      body: (
        <Cards
          items={[
            { title: '存储：S3 与磁盘', href: to('storage'), text: '存储桶、它的键和跨域规则。' },
            { title: 'Headless：你自己的界面', href: to('hooks'), text: '构建网盘所用的 hooks，以及完全由它们搭建的网盘。' },
            { title: '共享与链接', href: to('sharing'), text: '沿目录树继承的角色、带密码的链接、通知相关人员。' },
            { title: 'AI 助手（MCP）', href: to('assistants'), text: 'Claude 以用户的权限查找、阅读和归档文档。' },
          ]}
        />
      ),
    },
    {
      id: 'run-the-repository',
      title: '运行仓库',
      badge: '仓库',
      color: 'orange',
      lead: '从源码运行每个包和每个应用。',
      body: (
        <>
          <Code lang="bash" code={REPOSITORY} />
          <Table label="命令" columns={['命令', '作用']} rows={COMMANDS.map(([command, does]) => [command, does])} />
        </>
      ),
    },
  ],
};

export const demos: DocPage = {
  title: '可运行的演示',
  description: '仓库中的各个应用，每个展示什么、需要什么：playground、演示、真实存储桶、桌面端和网站。',
  source: SOURCE,
  lead: (
    <>
      每个都是 <C>apps/</C> 下的一个文件夹，从仓库根目录启动。除了真实存储桶的账号，其他都不需要任何账号。
    </>
  ),
  sections: [
    {
      id: 'the-playground',
      title: 'Playground',
      badge: 'npm run dev',
      color: 'green',
      lead: '在这台电脑上运行的网盘：文件内容在 storage/files 中，条目在 SQLite 中，服务器与页面在同一进程。',
      body: (
        <List
          items={[
            <>
              <C>http://localhost:5180</C> 是 React 版网盘；<C>/vanilla.html</C> 不使用框架；<C>/headless.html</C> 完全由 hooks 构建。
            </>,
            <>
              <C>?as=bea</C> 表示另一个人，便于测试共享；<C>?lang=es</C>、<C>?lang=zh</C> 和 <C>?theme=dark</C> 顾名思义。
            </>,
            <>
              助手工具位于 <C>/api/mcp</C>：<C>claude mcp add --transport http rebofiles http://localhost:5180/api/mcp</C>。
            </>,
            <>Word 文档会在 Rebodocs 编辑器中打开，⌘S 会把它保存为下一个版本。</>,
          ]}
        />
      ),
    },
    {
      id: 'the-demo',
      title: '演示',
      badge: 'npm run demo',
      color: 'blue',
      lead: '首页上的网盘，保存在页面中：Acme 的文件在这里生成，Claude 通过 MCP 工具重命名其中一个文件，工具调用也在页面中应答。',
      body: (
        <P>
          它基于 <C>createMemoryClient</C> 构建，因此不需要服务器，浏览器测试也是通过它进行的。
        </P>
      ),
    },
    {
      id: 'a-real-bucket',
      title: '真实存储桶',
      badge: 'npm run storage',
      color: 'yellow',
      lead: '连接 Cloudflare R2、AWS S3、MinIO 或 Backblaze 的网盘，条目存放在这台电脑的 SQLite 中。',
      body: (
        <P>
          把 <C>apps/storage/.env.example</C> 复制为 <C>.env</C> 并填写，为存储桶设置 <C>apps/storage/cors.json</C> 中的跨域规则，然后运行 <C>npm run storage:check</C>，在页面尝试之前先从 Node
          走一遍文件的完整流程。<a href={to('storage')}>存储</a>一页介绍具体做法。这里启用了全部功能：用 <C>?as=bea</C> 与 Bea 共享（她与 Carl 同在 <C>group:team</C>
          ）、带密码的链接、评论、由服务器生成的 PDF 第一页、文件检查，以及 <C>/api/mcp</C> 上的助手。
        </P>
      ),
    },
    {
      id: 'the-documents',
      title: '文档',
      badge: 'npm run documents',
      color: 'orange',
      lead: '用 Rebodocs 完整处理 Word 文档：新建文档、多人同时编辑的编辑器、查看器和 PDF。地址为 http://localhost:5184。',
      body: (
        <P>
          以 <C>?as=ana</C> 打开一个文档，共享给 bea 后再以 <C>?as=bea</C>{' '}
          打开：双方都能看到对方的光标和输入的内容，两人都离开后会保存一个版本。此外，网盘的其他功能也都已开启：历史中的比较、副本、文件收集（
          <C>?link=</C>）、服务器为每个文件生成的内容（用 ffmpeg 处理视频、OCR），以及演示在 <C>/api/hooks</C> 接收的 webhook。房间的实现在 <C>apps/documents</C> 的 <C>server/collab.ts</C> 中。
        </P>
      ),
    },
    {
      id: 'the-desktop',
      title: '桌面端',
      badge: 'npm run desktop',
      color: 'purple',
      lead: '基于 Tauri 的独立窗口网盘，可连接 playground 或任意服务器。',
      body: (
        <P>
          需要在 Mac 上安装 Rust 和 Xcode 命令行工具。<C>npm run build:desktop</C> 会生成 ReboFiles.app；<strong>Server → Sync a Folder…</strong> 让电脑上的文件夹与网盘保持一致（
          <a href={to('sync')}>同步文件夹</a>）。<a href={to('desktop')}>桌面端与其他来源</a>一页介绍服务器需要什么。
        </P>
      ),
    },
    {
      id: 'the-site',
      title: '本网站',
      badge: 'npm run site',
      color: 'pink',
      body: (
        <P>
          首页（内含演示）以及这些页面：基于 Next.js 和 Tailwind，构建为静态文件，提供英文、西班牙文和中文。<a href="/zh/demo/">/demo/</a> 以三种形式展示网盘，每种一个标签页：开箱即用的{' '}
          <C>&lt;FileDrive&gt;</C>、它的紧凑布局，以及完全由 headless hooks 构建的创意套件风格界面。
        </P>
      ),
    },
  ],
};
