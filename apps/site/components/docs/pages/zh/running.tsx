// 应用与生产环境中的服务器（中文）：各个框架与登录、保存前检查上传、
// 实时更改、同步文件夹，以及上线前要设置的内容。代码与英文页面相同，读取自 examples/。

import { docHref } from '@/lib/site';
import { C, Callout, Code, type DocPage, List, P, Table, Trouble } from '../../ui';
import { AUTHJS, BEFORE_UPLOAD, CLAMD, CLERK, DRIVE, EXPRESS, FASTIFY, HONO, INSPECT, JWT, LIFECYCLE, NEXT_ROUTE, NGINX, OWN_INSPECT, SYNC_CLI, SYNC_CODE, WATCH } from '../running';

const hrefOf = (slug: string) => docHref('zh', slug);

export const frameworks: DocPage = {
  title: '框架与登录',
  description: '在 Next.js、Express、Hono 和 Fastify 中使用网盘，并通过 Auth.js、Clerk 或自己的令牌识别用户：每段代码都由测试运行。',
  source: 'examples/',
  lead: (
    <>
      <C>createDriveHandler</C> 接收 Request 并返回 Response，因此每个框架只需几行代码：在任何东西读取请求体之前，把请求原样交给它。这里的每个示例都是 <C>examples/</C>{' '}
      中的文件，测试会在一个端口上启动它并通过 HTTP 访问：创建文件夹、上传并读回一个分两部分的文件，以及实时收到一次更改。
    </>
  ),
  sections: [
    {
      id: 'one-drive',
      title: '所有示例共用的网盘',
      badge: '基础',
      color: 'purple',
      lead: '设置了 S3_BUCKET 时字节存入存储桶，否则存在磁盘上；条目存在 SQLite 中。',
      body: <Code code={DRIVE()} file="examples/drive.ts" />,
    },
    {
      id: 'nextjs',
      title: 'Next.js',
      badge: 'App Router',
      color: 'blue',
      lead: '一个路由处理器处理全部路由，运行在 Node 中：签名使用 node:crypto。',
      body: <Code code={NEXT_ROUTE()} file="app/api/files/[...path]/route.ts" />,
    },
    { id: 'express', title: 'Express', badge: 'Node', color: 'green', lead: '挂载在 express.json() 之前：网盘自己读取请求体。', body: <Code code={EXPRESS()} file="examples/express/server.ts" /> },
    { id: 'hono', title: 'Hono', badge: 'Node · Bun · Deno', color: 'yellow', lead: 'Hono 的请求就是网盘接收的请求。', body: <Code code={HONO()} file="examples/hono/server.ts" /> },
    {
      id: 'fastify',
      title: 'Fastify',
      badge: 'Node',
      color: 'orange',
      lead: '放在独立的插件中，Fastify 的解析器不会读取请求体，响应直接写入原始响应。',
      body: <Code code={FASTIFY()} file="examples/fastify/server.ts" />,
    },
    {
      id: 'auth-js',
      title: '用 Auth.js 识别用户',
      badge: '登录',
      color: 'pink',
      body: (
        <>
          <Code code={AUTHJS()} file="examples/auth/authjs.ts" />
          <P>
            将它作为 <C>identify</C> 传入。页面向自己的源发出的每个请求都会带上会话 cookie，浏览器端无需其他设置。
          </P>
        </>
      ),
    },
    { id: 'clerk', title: '用 Clerk 识别用户', badge: '登录', color: 'pink', body: <Code code={CLERK()} file="examples/auth/clerk.ts" /> },
    {
      id: 'your-own-token',
      title: '自己的令牌',
      badge: 'JWT',
      color: 'pink',
      lead: '适用于有自己登录系统的应用，以及发送 `Authorization: Bearer` 的桌面应用。',
      body: (
        <>
          <Code code={JWT()} file="examples/auth/jwt.ts" />
          <Callout title="已测试与未测试：">自己的令牌由测试检查，伪造的令牌会被拒绝。Auth.js 和 Clerk 按其文档编写，未在此运行，因为它们需要各自的账号。</Callout>
        </>
      ),
    },
    {
      id: 'when-something-fails',
      title: '出错时',
      badge: '错误',
      color: 'pink',
      body: (
        <>
          <Trouble says="The body is not JSON.">框架的解析器先读取了请求体：像示例那样，把网盘挂载在它之前或它管不到的地方。</Trouble>
          <Trouble says="No GET /api/files/…">
            框架给出的路径不完整。有 <C>originalUrl</C> 时（Express）<C>nodeHandler</C> 会使用它；否则请挂载在 <C>base</C> 所指的位置。
          </Trouble>
          <Trouble says="Sign in first.">
            <C>identify</C> 没有找到用户：cookie 没有送达（其他源需要 <C>cors</C> 和令牌），或会话中没有 id。
          </Trouble>
        </>
      ),
    },
  ],
};

export const checkingUploads: DocPage = {
  title: '检查上传',
  description: '在文件上传前按名称、类型和大小拒绝；在字节到达后，按其真实类型或 ClamAV 的扫描结果拒绝。',
  source: 'packages/server/src/inspect.ts',
  lead: (
    <>
      字节从浏览器直接传到存储桶，不经过服务器；服务器只在字节到达后才列出文件。因此有两个时机可以拒绝：分配地址之前（<C>beforeUpload</C>），以及字节到达后、任何人看到之前（
      <C>inspect</C>）。在第二个时机被拒绝的内容会从存储桶中删除。
    </>
  ),
  sections: [
    {
      id: 'before',
      title: '上传之前',
      badge: 'beforeUpload',
      color: 'blue',
      lead: '依据页面提供的信息：名称、类型、大小和目标位置。此时还未发送任何内容。',
      body: (
        <>
          <Code code={BEFORE_UPLOAD} />
          <P>
            <C>Refused</C> 会以其状态码、代码和消息返回；<C>false</C> 返回 403。每个新文件和新版本都会调用，页面生成的缩略图不会。类型和大小是页面声称的值：要检查真实内容，请用 <C>inspect</C>。
          </P>
        </>
      ),
    },
    {
      id: 'after',
      title: '字节到达之后',
      badge: 'inspect',
      color: 'yellow',
      lead: '在保存文件或版本之前调用，可读取存储中的字节。服务器的两种存储都支持读取。',
      body: (
        <>
          <Code code={INSPECT} />
          <List
            items={[
              <>
                <C>checkType()</C> 读取前 4 KB。默认拒绝程序（.exe、Linux 或 Mac 的二进制文件），除非设置 <C>programs: true</C>；也拒绝字节与扩展名不符的文件，例如不是 PNG 的 PNG、不是 zip 的 .docx。
                <C>only</C> 可限定允许的类型。
              </>,
              <>
                <C>clamav()</C> 通过 INSTREAM 命令把字节发送给 clamd，每次一兆字节。超过 clamd 可接收大小（默认 25 MB）的文件会被拒绝，而不是未经扫描就放行。
              </>,
              <>
                <C>inspectAll(…)</C> 按顺序调用多个检查：第一个拒绝即拒绝。
              </>,
            ]}
          />
          <Callout title="未经检查的文件不会被放行。">
            当 <C>inspect</C> 抛出的不是 <C>Refused</C>（clamd 停止、超时）时，上传以 503 被拒绝，字节被删除。页面会提示，用户可以重新上传。
          </Callout>
        </>
      ),
    },
    { id: 'clamav', title: '服务器上的 ClamAV', badge: '病毒', color: 'pink', body: <Code lang="bash" code={CLAMD} /> },
    { id: 'your-own', title: '自定义 inspect', badge: '自定义', color: 'purple', lead: '任意函数：服务商的扫描器，或你自己关于可保存内容的规则。', body: <Code code={OWN_INSPECT} /> },
    {
      id: 'what-people-read',
      title: '用户看到的内容',
      badge: '错误',
      color: 'green',
      body: (
        <>
          <Table
            label="上传被拒绝的原因"
            columns={['代码', '状态', '何时']}
            rows={[
              ['upload-refused', '403', 'beforeUpload 返回 false'],
              ['program-refused', '422', 'checkType：是程序'],
              ['type-mismatch', '422', 'checkType：字节与扩展名不符'],
              ['type-refused', '422', 'checkType：类型不在 only 中'],
              ['virus-found', '422', 'clamav：发现病毒，消息中给出名称'],
              ['refused-content', '422', 'inspect 返回 false'],
              ['not-scanned · not-inspected', '503', 'clamav 或 inspect 无法检查'],
            ]}
          />
          <P>网盘会根据代码，用每个人的语言显示。</P>
        </>
      ),
    },
  ],
};

export const live: DocPage = {
  title: '实时更改与大文件夹',
  description: '通过 server-sent events 实时显示他人的更改，无需刷新；对于上千个文件的文件夹，页面中只放入可见的部分。',
  source: 'packages/server/src/api.ts',
  lead: <>两个人打开同一个文件夹，片刻之内就能看到对方的更改：新建的文件夹，重命名、移动或移入回收站的文件。上千个文件的文件夹，滚动起来与十个文件一样流畅。</>,
  sections: [
    {
      id: 'as-it-happens',
      title: '实时',
      badge: '事件',
      color: 'blue',
      body: (
        <>
          <P>
            页面监听 <C>GET /events</C>，这是一个 server-sent events 流，用 <C>fetch</C> 读取，因此会带上你的 <C>headers</C>
            。每次更改只按每个人可见的范围告知：发生更改且其可列出的文件夹，以及其可读取的条目。不会发送名称；页面照常请求要显示的内容。
          </P>
          <P>
            <C>&lt;FileDrive&gt;</C>、<C>mountDrive</C> 以及 <C>DriveProvider</C> 下的每个 hook 会在更改后四分之一秒重新请求，同时到达的多次更改只请求一次。断开后会重新连接，每次间隔稍长。
            <C>live=&#123;false&#125;</C> 可关闭此功能。
          </P>
          <Code code={WATCH} file="自定义界面" />
        </>
      ),
    },
    {
      id: 'more-processes',
      title: '多个进程',
      badge: '服务器',
      color: 'purple',
      body: (
        <P>
          本进程的更改会立即告知。同一存储上其他进程的更改通过存储的修订号发现（SQLite 和 Postgres 都有），有人监听时每两秒检查一次（<C>live: &#123; poll &#125;</C>
          ）。没有修订号的存储只告知本进程的更改。
        </P>
      ),
    },
    {
      id: 'behind-a-proxy',
      title: '在代理之后',
      badge: '生产',
      color: 'yellow',
      body: (
        <List
          items={[
            <>
              每 25 秒发送一行空内容，避免代理因长时间无数据而关闭连接。请让请求可以持续更久：nginx 中设置 <C>proxy_read_timeout 1h</C>。
            </>,
            <>
              响应带有 <C>x-accel-buffering: no</C> 和 <C>cache-control: no-transform</C>，以免 nginx 和压缩缓冲它。
            </>,
            <>
              在几秒后就会结束请求的平台上（serverless 函数），页面断开后会重新连接，期间的更改在下次连接时看到。也可以用 <C>live: false</C> 关闭。
            </>,
          ]}
        />
      ),
    },
    {
      id: 'large-folders',
      title: '大文件夹',
      badge: '性能',
      color: 'green',
      body: (
        <>
          <P>从 200 个条目起，列表和网格只在页面中放入可见部分及其周围几行，其余部分的高度在上下保留，因此滚动条的长度与全部内容一致。行高在显示时测量，网格的列数随宽度变化。</P>
          <P>
            键盘仍可遍历全部条目：方向键、Home 或 End 会先把目标滚动到可见位置，因为屏幕阅读器需要被告知当前项。每一项都说明自己在全部中的位置（<C>aria-posinset</C>、<C>aria-setsize</C>
            ）。Ctrl+A 会选中全部，而不只是页面中的那些；图片地址只为显示的条目请求。
          </P>
        </>
      ),
    },
  ],
};

export const sync: DocPage = {
  title: '同步文件夹',
  description: '让电脑上的文件夹与网盘文件夹双向保持一致：发送和接收更改，冲突时两份都保留，跟随移动。可用于桌面应用，也可作为命令。',
  source: 'packages/sync/src/engine.ts',
  lead: (
    <>
      <C>@rebofiles/sync</C> 让磁盘上的文件夹与网盘中的文件夹保持一致。每次运行都会列出两边，并与上次一致时的状态比较，从而知道是哪一边发生了更改。
    </>
  ),
  sections: [
    {
      id: 'in-the-desktop-app',
      title: '在桌面应用中',
      badge: '桌面',
      color: 'blue',
      body: (
        <P>
          <strong>Server → Sync a Folder…</strong>（⇧⌘S）会询问要同步的文件夹（默认 <C>~/ReboFiles</C>
          ），并在窗口打开期间保持同步：启动时、网盘告知更改时、窗口回到前台时，以及每半分钟一次。底部的标签显示同步结果。磁盘由应用自己的命令读写，这些命令不会离开该文件夹。
        </P>
      ),
    },
    { id: 'as-a-command', title: '作为命令', badge: 'CLI', color: 'green', lead: '在任何装有 Node 的电脑上，也可作为服务运行。', body: <Code lang="bash" code={SYNC_CLI} /> },
    { id: 'in-your-code', title: '在你的代码中', badge: 'API', color: 'purple', body: <Code code={SYNC_CODE} /> },
    {
      id: 'what-it-does',
      title: '它做什么',
      badge: '规则',
      color: 'yellow',
      body: (
        <Table
          label="一次运行做的事"
          columns={['情况', '处理']}
          code={[]}
          rows={[
            ['一边新增', '在另一边创建：文件夹，或发送、取回文件。'],
            ['一边更改', '在网盘中生成新版本，或重新写入磁盘上的文件。'],
            ['两边都更改', '网盘的版本保留原名；磁盘的版本放在旁边，命名为“名称 (conflict 2026-10-26 14.05).ext”，并作为单独的文件上传。'],
            ['磁盘上已删除', '移入网盘回收站（可恢复）；若此后网盘中有更改，则重新取回。'],
            ['网盘中已删除', '在磁盘上移到 .rebofiles/removed/；若此后磁盘上有更改，则重新上传。'],
            ['在网盘中移动或重命名', '在磁盘上移动，文件夹连同其内容一起。'],
            ['在磁盘上移动文件', '在网盘中移动，仍是同一个文件及其版本，按大小和时间识别。'],
          ]}
        />
      ),
    },
    {
      id: 'what-it-does-not',
      title: '它不做什么',
      badge: '限制',
      color: 'pink',
      body: (
        <List
          items={[
            '在磁盘上重命名的文件夹会作为新文件夹重新上传，旧文件夹移入回收站：文件相同，但版本从头开始。',
            '原本有文件的磁盘文件夹变为空时，会被视为磁盘不在，直到明确允许（allowEmpty）之前不做任何操作。',
            '系统文件（.DS_Store、Thumbs.db、Office 的 ~$ 文件）以及它自己的 .rebofiles 文件夹不会同步。',
            '每次都会传输整个文件，而不只是更改的部分。',
          ]}
        />
      ),
    },
    {
      id: 'only-what-changed',
      title: '只传输更改的部分',
      badge: '分块',
      color: 'green',
      body: (
        <P>
          稍有改动的文件只以更改的部分作为新版本上传：每个版本保存其 8 MiB 分块的 SHA-256，相同的分块直接在存储中从上一个版本复制（S3 的 UploadPartCopy，或磁盘上的复制），不再重新发送。一个 1 GB
          的视频只改了标题，只需发送 8 MiB。任何上传都可以通过 <C>partHashes: true</C> 使用此功能。
        </P>
      ),
    },
  ],
};

export const production: DocPage = {
  title: '上线生产环境',
  description: '向用户开放网盘之前：密钥、存储桶的来源规则、限制、条目备份、轮换密钥、未完成的上传以及代理。',
  source: 'apps/site/components/docs/pages/running.tsx',
  lead: <>在应用的网盘向用户开放之前，需要设置和关注的事项。</>,
  sections: [
    {
      id: 'checklist',
      title: '清单',
      badge: '清单',
      color: 'purple',
      body: (
        <List
          items={[
            <>
              <C>secret</C> 要长且随机（<C>openssl rand -hex 32</C>），每个进程相同，来自环境变量，绝不写在代码中。
            </>,
            <>
              <C>identify</C> 来自你的会话，<C>authorize</C> 使用 <C>byRoles</C> 或你自己的规则：绝不使用 <C>everyone()</C>。
            </>,
            <>
              存储桶的来源规则只包含你的域名，并暴露 <C>ETag</C>（<a href={hrefOf('storage')}>存储</a>）。
            </>,
            <>
              设置 <C>maxSize</C> 和每个人的 <C>quota</C>；设置 <C>trashDays</C> 让回收站自动清空。
            </>,
            <>
              至少使用 <C>inspect: checkType()</C>；对于来自陌生人的文件，加上 ClamAV（<a href={hrefOf('checking-uploads')}>检查上传</a>）。
            </>,
            <>
              多个进程时使用 Postgres（<a href={hrefOf('metadata')}>元数据</a>），并做好备份。
            </>,
            <>在存储桶中设置生命周期规则，如下所示。</>,
            <>
              在代理之后设置 <C>clientIp</C>，多个进程时使用基于 Redis 的 <C>limiter</C>（<a href={hrefOf('observability')}>钩子、日志与限制</a>）。
            </>,
            '前端使用 HTTP/2：每个监听的标签页占用一个连接，而在 HTTP/1.1 下浏览器对每个主机只有六个。看不见的标签页会释放自己的连接。',
            <>
              安装 sharp 和 pdf.js 并设置 <C>derive: deriveAll()</C>，为页面未生成的内容生成图片和文字（<a href={hrefOf('previews')}>预览</a>）。
            </>,
          ]}
        />
      ),
    },
    {
      id: 'uploads-left-halfway',
      title: '未完成的上传',
      badge: '存储桶',
      color: 'yellow',
      body: (
        <>
          <P>
            上传中途关闭的页面会把已上传的部分留在存储桶中，它们占用空间却不出现在任何地方。服务器会随请求每十分钟清理一次：超过令牌有效期（一天）的上传会被中止，仅限其 <C>prefix</C>{' '}
            之下；在磁盘上则删除其部分文件。存储桶的生命周期规则无需服务器也能做到：
          </P>
          <Code lang="json" code={LIFECYCLE} file="lifecycle.json" />
        </>
      ),
    },
    {
      id: 'backups',
      title: '备份',
      badge: '数据',
      color: 'green',
      body: (
        <>
          <P>
            条目说明了哪些字节属于哪个文件：没有它们，存储桶只是一堆 id。像备份数据库一样备份它们：Postgres 用 <C>pg_dump</C>，SQLite 用 <C>sqlite3 drive.sqlite ".backup backup.sqlite"</C>
            ，在服务器写入时也安全。
          </P>
          <P>字节从不原地修改：每个版本都是新的键。因此网盘不需要存储桶的版本控制，存储桶的副本（R2 到 S3、rclone）就是只增不减的备份。只删除网盘已删除的内容。</P>
        </>
      ),
    },
    {
      id: 'rotating-keys',
      title: '轮换密钥',
      badge: '密钥',
      color: 'pink',
      body: (
        <List
          items={[
            '存储桶的密钥：创建新密钥，提供给每个进程，两小时后再撤销旧密钥：下载地址有效十五分钟，显示图片的地址有效两小时。',
            <>
              <C>secret</C>：更换后，进行中的上传（其令牌）会结束，链接的地址也会改变。之前创建的链接会失效，因为它们由它签名：请在空闲时段进行，并通知分享过链接的人。
            </>,
          ]}
        />
      ),
    },
    {
      id: 'behind-a-proxy',
      title: '在代理之后',
      badge: 'nginx',
      color: 'blue',
      body: (
        <>
          <Code lang="nginx" code={NGINX} />
          <P>使用存储桶时，字节完全不经过代理：只有网盘的小请求，以及持续的事件流。</P>
        </>
      ),
    },
    {
      id: 'watch',
      title: '需要关注的内容',
      badge: '日志',
      color: 'orange',
      body: (
        <P>
          服务器会把未能完成且未在响应中说明的事写到控制台：未保存的动态、失败的 <C>onShare</C>、未清理的上传、无法检查的文件，每条都附带错误。500 响应不会向页面透露内部信息；控制台会说明一切。
        </P>
      ),
    },
  ],
};
