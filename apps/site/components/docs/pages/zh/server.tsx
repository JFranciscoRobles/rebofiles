// 服务器：路由、谁可以做什么、文件内容和条目存放在哪里、共享、动态记录，
// 以及其他来源的页面。错误信息保留英文，与服务器返回的一致。

import { docHref } from '@/lib/site';
import { referenceIn } from '../../referenceI18n';
import { C, Callout, Code, type DocPage, List, P, RefTable, Table, Trouble, withCode } from '../../ui';
import { AUTHORIZE, CORS, ENV, NODE, ON_SHARE, ORIGINS, POSTGRES, ROUTE, SHARE, optionId } from '../server';

const to = (slug: string) => docHref('zh', slug);
const SOURCE = 'apps/site/components/docs/pages/zh/server.tsx';
const { SERVER_OPTIONS } = referenceIn('zh');
const ACTIVITY_CODE = `import { activityOf } from '@rebofiles/core';\n\nactivityOf(before, after, 'ana', new Date().toISOString());\n// [{ action: 'renamed', name: 'final.docx', was: 'draft.docx', by: 'ana', at, entry, parent }]`;

export const server: DocPage = {
  title: '路由',
  description: 'createDriveHandler：整个网盘只需一条路由，可运行在 Next.js、Bun、Deno、Worker 或 node:http 中，以及它接受的全部选项。',
  source: SOURCE,
  lead: (
    <>
      <C>createDriveHandler</C> 接收 Request 并返回 Response。网盘的所有路由都位于同一路径下，除了磁盘存储外，没有任何路由传输文件内容：浏览器拿到的是用于发送和读取内容的地址。
    </>
  ),
  sections: [
    { id: 'in-nextjs', title: '在 Next.js 中', badge: 'Next.js', color: 'blue', body: <Code code={ROUTE} file="app/api/files/[...path]/route.ts" /> },
    {
      id: 'on-node-http',
      title: '在 node:http 上',
      badge: 'Node',
      color: 'green',
      lead: 'nodeHandler 会把它变成一个监听器，适用于 node:http、Express 以及基于它们构建的框架。',
      body: <Code code={NODE} file="server.ts" />,
    },
    {
      id: 'options',
      title: '全部选项',
      badge: '选项',
      color: 'yellow',
      body: (
        <RefTable
          label="createDriveHandler 的选项"
          name="选项"
          rows={SERVER_OPTIONS.map((option) => ({ id: optionId(option.name), name: option.name, type: option.type, does: withCode(option.does) }))}
        />
      ),
    },
    {
      id: 'held-in-memory',
      title: '保存在内存中',
      badge: '速度',
      color: 'purple',
      body: (
        <P>
          网盘只读取一次并保存在内存中，只有当存储表明它（被本进程或其他进程）修改过时才会重新读取：列出 20,000 个条目的耗时从 36 毫秒降到了 1
          毫秒以下。对于一个团队乃至更大规模都绰绰有余；但不适用于数百万个条目。
        </P>
      ),
    },
    {
      id: 'every-route',
      title: '所有路由',
      badge: 'API',
      color: 'pink',
      body: (
        <P>
          <a href={to('routes')}>HTTP 路由</a>一页按代码中的定义列出了全部路由。
        </P>
      ),
    },
  ],
};

const ACTIONS: [string, string][] = [
  ['list', '文件夹中的内容；null 表示根目录。之后会对其中每个条目询问 read。'],
  ['read', '单个条目、搜索、最近、回收站、动态记录：一个人能看到的一切。'],
  ['create', '创建文件夹，附带它所在的文件夹。'],
  ['upload', '上传文件，附带它所在的文件夹；新版本、缩小的图片、文字，附带该文件。完成时会再次询问。'],
  ['rename', '重命名条目，或为文件夹设置颜色。'],
  ['move', '先询问条目，再询问目标文件夹。'],
  ['trash, restore', '移入回收站，以及从回收站恢复。'],
  ['delete', '永久删除：文件内容从存储桶中删除。'],
  ['download', '获取读取文件的地址，有效期几分钟。'],
  ['comment', '目前尚未用于任何操作：评论者在查看者之外可以做的事。'],
  ['share', '共享、撤回共享，以及链接。'],
  ['configure', '整个网盘的设置。使用 byRoles 时，identify 返回 { id, admin: true } 的用户。'],
];

export const authorize: DocPage = {
  title: '谁可以做什么',
  description: 'identify 和 authorize、会被询问的各种操作、byRoles，以及在它之外包一层你自己的规则。',
  source: SOURCE,
  lead: (
    <>
      ReboFiles 本身没有用户体系。<C>identify</C> 根据你的会话判断谁在请求；<C>authorize</C> 在每条路由上被调用，并传入所涉及的条目。
    </>
  ),
  sections: [
    {
      id: 'identify',
      title: 'identify',
      badge: '是谁',
      color: 'blue',
      body: (
        <P>
          它接收 Request，为已登录的人返回 <C>&#123; id &#125;</C>，否则返回 null（响应 401）。这个 id 就是网盘称呼他们的方式：所有者、共享、动态记录。<C>admin: true</C> 在使用 <C>byRoles</C>{' '}
          时可以配置网盘。
        </P>
      ),
    },
    {
      id: 'the-actions',
      title: '操作',
      badge: '做什么',
      color: 'yellow',
      body: <Table label="操作" columns={['操作', '询问时机']} rows={ACTIONS.map(([action, what]) => [action, what])} />,
    },
    {
      id: 'byroles',
      title: 'byRoles',
      badge: '角色',
      color: 'green',
      body: (
        <P>
          根据网盘本身判断：所有者可以对条目及其中的内容做任何事；被共享的人可以做其角色允许的事。查看者可以浏览、阅读和下载；编辑者还可以创建、上传、重命名、移动和移到回收站；只有所有者可以永久删除和共享。任何已登录的人都可以查看根目录并在其中放置内容；每个人只看到自己的。
        </P>
      ),
    },
    {
      id: 'rules-of-your-own',
      title: '你自己的规则',
      badge: '自定义',
      color: 'purple',
      lead: '在你的规则中调用 byRoles。第四个参数是整个网盘，便于编写需要查看条目所在文件夹的规则。',
      body: <Code code={AUTHORIZE} file="lib/auth.ts" />,
    },
    {
      id: 'when-it-says-no',
      title: '被拒绝时',
      badge: '错误',
      color: 'pink',
      body: (
        <Trouble says="Sign in first. · You may not do that here.">
          401 表示 <C>identify</C> 返回了 null；403 表示 <C>authorize</C> 返回了 false。
        </Trouble>
      ),
    },
  ],
};

export const storage: DocPage = {
  title: '存储：S3 与磁盘',
  description: '文件内容可存放在任何兼容 S3 的存储桶中（无需 SDK），或磁盘上的文件夹中：密钥、跨域规则，以及可能出现的问题。',
  source: SOURCE,
  lead: <>文件内容从浏览器直接发送到存储桶并从中读回，使用服务器签名、有效期几分钟的地址。这对存储桶有两个要求：一个用于签名的密钥，以及一条允许你的页面访问的规则。</>,
  sections: [
    {
      id: 'the-key',
      title: '密钥',
      badge: 'S3',
      color: 'blue',
      lead: '在 Cloudflare R2 中：R2 → Create bucket，然后 Manage API tokens → Create API token，仅为该存储桶授予 “Object Read & Write”。',
      body: (
        <>
          <Code lang="bash" code={ENV} file=".env" />
          <P>
            <C>s3Storage(s3OptionsFrom(process.env))</C> 会读取它们。在 AWS 上，省略 <C>S3_ENDPOINT</C> 并提供区域；MinIO 和 Backblaze 使用相同的变量。
          </P>
        </>
      ),
    },
    {
      id: 'the-rule-of-origins',
      title: '跨域规则',
      badge: 'CORS',
      color: 'yellow',
      lead: '在 Settings → CORS policy 中，填入你的应用所在的地址。必须暴露 ETag。',
      body: (
        <>
          <Code lang="json" code={CORS} file="CORS policy" />
          <P>再加一条生命周期规则，在一天后中止未完成的分片上传，就能避免从未完成的上传分片一直留在存储桶中。</P>
        </>
      ),
    },
    {
      id: 'on-the-disk',
      title: '存放在磁盘上',
      badge: '磁盘',
      color: 'green',
      body: (
        <P>
          <C>diskStorage(&#123; folder, secret &#125;)</C> 把文件内容保存在一个文件夹中，由服务器自己通过它的地址传输：适用于单机、演示或测试。
        </P>
      ),
    },
    {
      id: 'when-something-fails',
      title: '出现问题时',
      badge: '错误',
      color: 'pink',
      body: (
        <>
          <Trouble says="S3_ENDPOINT is the public address of the bucket (r2.dev)">
            R2 的 S3 API 位于 <C>https://&lt;account-id&gt;.r2.cloudflarestorage.com</C>，可在存储桶的设置页面找到。
          </Trouble>
          <Trouble says="The part could not be sent. If the bytes go to a bucket, check that it lets this origin in.">
            跨域规则问题：<C>AllowedOrigins</C> 中缺少页面地址，或 <C>AllowedHeaders</C> 中缺少 <C>content-type</C>。
          </Trouble>
          <Trouble says="The bucket did not let the page read the ETag of a part.">
            小文件能上传而大文件不能：<C>ExposeHeaders</C> 需要包含 <C>ETag</C>。
          </Trouble>
          <Trouble says="The bucket answered 403 to …">密钥问题：它无权写入该存储桶，或者 endpoint、区域或存储桶名称与创建密钥时的不一致。</Trouble>
          <Trouble says="There is no room for it: … are used, and it is ….">
            该用户的配额已满（<C>413 over-quota</C>）：在网盘设置中增加空间，或减少其文件和回收站中的内容。
          </Trouble>
          <P>
            在仓库中，<C>npm run storage:check</C> 会针对 <C>apps/storage/.env</C> 中的存储桶走一遍文件的完整流程，并告诉你出错那一步存储桶返回了什么。
          </P>
        </>
      ),
    },
  ],
};

export const metadata: DocPage = {
  title: '元数据：SQLite 与 Postgres',
  description: '条目存放在哪里：内存中、使用 node:sqlite 的 SQLite，或使用你自己驱动的 Postgres；各自保存什么，以及多进程的情况。',
  source: SOURCE,
  lead: <>存储桶没有文件夹、所有者、权限或回收站的概念。这些信息存放在旁边的元数据存储中，它只写入改动的部分，每次一个改动。</>,
  sections: [
    {
      id: 'the-stores',
      title: '各种存储',
      badge: '选择',
      color: 'blue',
      body: (
        <Table
          label="存储"
          columns={['存储', '适用于']}
          rows={[
            ['memoryMetadata()', '测试和演示：进程结束后即消失。'],
            ['sqliteMetadata(path)', '运行在单台服务器上的应用：一个文件，使用 Node 自带的 node:sqlite。'],
            ['postgresMetadata(pool)', '多台服务器，或没有磁盘的托管环境：使用你自己的驱动，每次改动都会加数据库锁。'],
          ]}
        />
      ),
    },
    {
      id: 'on-postgres',
      title: '使用 Postgres',
      badge: 'Postgres',
      color: 'green',
      body: (
        <>
          <Code code={POSTGRES} />
          <P>
            它接受任何带有 <C>query(text, values)</C> 并返回 <C>&#123; rows &#125;</C> 的对象：<C>pg</C>、Neon 的
            Pool、PGlite。传入连接池时，每次改动在读写期间都会持有数据库锁，因此两台服务器永远不会同时修改网盘；没有连接池时，同一时刻创建的两个文件夹可能都会被命名为 “(2)”。用{' '}
            <C>&#123; table: 'acme_files' &#125;</C> 可以指定其他表名。
          </P>
        </>
      ),
    },
    {
      id: 'what-is-kept',
      title: '保存的内容',
      badge: '表',
      color: 'yellow',
      body: (
        <List
          items={[
            '条目：每个一行，以 JSON 形式保存。',
            '网盘和每个人的设置，以及经 scrypt 处理后的链接密码。',
            '动态记录：每条一行，可按条目及其所在文件夹查找。',
            '每个文件的文字：SQLite 的全文搜索，或 Postgres 中的 tsvector。',
            '一个随每次改动递增的修订号，让每个进程知道何时需要重新读取网盘。',
          ]}
        />
      ),
    },
    {
      id: 'a-store-of-your-own',
      title: '你自己的存储',
      badge: '自定义',
      color: 'purple',
      body: (
        <P>
          <C>MetadataStore</C> 只需实现 <C>load()</C> 和 <C>save(changes)</C>；<C>revision</C>、<C>lock</C>、设置、<C>record</C>/<C>activity</C> 以及 <C>keepText</C>/<C>findText</C>{' '}
          都是可选的，缺少时服务器会把这些信息保存在进程中。<a href={to('schema')}>数据库结构</a>一页列出了所有表。
        </P>
      ),
    },
  ],
};

export const sharing: DocPage = {
  title: '共享与链接',
  description: '沿目录树继承的角色、“与我共享”及其中的新内容、整个团队共用一个网盘，以及可设有效期、密码或仅限一次下载的链接。',
  source: SOURCE,
  lead: <>在条目的详情中点击“共享”，即可按你的 identify 提供的 id 把它共享给某人，或共享给所有已登录用户；文件夹中的内容会随之共享。</>,
  sections: [
    {
      id: 'roles',
      title: '角色',
      badge: '成员',
      color: 'blue',
      body: (
        <P>
          查看者、评论者或编辑者，作用于条目及其中的内容。它会出现在对方的<strong>与我共享</strong>
          中，而不是对方的“我的文件”里——那里只属于他们自己；旁边还会显示自上次查看以来的新内容数量。如果想让整个团队共用一个网盘，请为服务器设置 <C>top: 'everyone'</C>。
        </P>
      ),
    },
    {
      id: 'links',
      title: '链接',
      badge: '链接',
      color: 'green',
      lead: '任何拥有链接的人都可以查看和下载，无需登录，有效期可设为一天、一周或一个月，或直到被移除。',
      body: (
        <>
          <List
            items={[
              <>
                <strong>带密码</strong>：在显示任何内容之前先要求输入，每次请求都以 <C>x-link-password</C> 发送，只保存经 scrypt 处理后的结果，每次输错后都会稍作延迟。
              </>,
              <>
                <strong>仅限一次下载</strong>：下载文件或其压缩包时才算使用，仅查看不算；之后的一刻钟内仍然有效，以便完成该次下载中的文件。
              </>,
            ]}
          />
          <Code lang="tsx" code={SHARE} />
        </>
      ),
    },
    {
      id: 'when-a-link-fails',
      title: '链接失效时',
      badge: '错误',
      color: 'pink',
      body: (
        <>
          <Trouble says="This link does not work any more.">它已被移除、已过期、已被使用、所指内容已移到回收站，或者地址在传递过程中被改动：具体是哪一种，链接不会告诉持有者。</Trouble>
          <Trouble says="This link asks for its password. · That is not the password.">链接页面会先要求输入密码，并在每次请求时发送。</Trouble>
        </>
      ),
    },
    {
      id: 'telling-people',
      title: '通知相关人员',
      badge: '通知',
      color: 'yellow',
      body: (
        <P>
          见<a href={to('activity')}>动态与通知</a>：每次共享都会调用 <C>onShare</C>，你可以借此发送邮件或应用内通知。
        </P>
      ),
    },
  ],
};

export const activity: DocPage = {
  title: '动态与通知',
  description: '谁对每个文件和文件夹做了什么，随每次改动一并保存；以及通知别人有内容与他们共享了。',
  source: SOURCE,
  lead: <>每次改动都会被记录为动态，无论由谁发起：路由、助手，还是回收站自动清空。动态根据改动前后的网盘推导而来，因此不会有任何遗漏。</>,
  sections: [
    {
      id: 'what-is-kept',
      title: '记录的内容',
      badge: '动态',
      color: 'blue',
      body: (
        <>
          <P>创建、上传、新版本、重命名、移动、移入回收站和恢复、删除、共享和取消共享、创建和撤回链接、设置颜色；以及由谁、在何时。</P>
          <P>
            文件的详情中有它的<strong>动态</strong>，文件夹的详情中还包括直接在其中进行的操作（<C>GET /entries/:id/activity</C>、<C>client.activity</C>）；助手可以通过 <C>get_activity</C> 读取。
          </P>
        </>
      ),
    },
    { id: 'in-code', title: '在代码中', badge: 'Core', color: 'green', body: <Code code={ACTIVITY_CODE} /> },
    {
      id: 'telling-people',
      title: '通知相关人员',
      badge: 'onShare',
      color: 'yellow',
      lead: '网盘会在“与我共享”旁统计新内容。如果你想自己通知对方，请为服务器提供 onShare。',
      body: <Code code={ON_SHARE} />,
    },
    {
      id: 'know',
      title: '须知',
      badge: '须知',
      color: 'pink',
      body: <Callout title="改动会被保存，但可能没有对应的动态记录">如果存储写入动态失败：改动属于网盘本身，动态记录只是附带的。</Callout>,
    },
  ],
};

export const desktop: DocPage = {
  title: '桌面端与其他来源',
  description: '仓库中基于 Tauri 的桌面应用，以及如何通过服务器和存储桶上的 cors 允许它或其他域名的页面访问。',
  source: SOURCE,
  lead: <>在独立窗口中运行网盘（首先支持 Mac），连接你的服务器；或者在其他域名提供的页面中运行。两者都属于其他来源，需要按名称放行。</>,
  sections: [
    {
      id: 'the-application',
      title: '应用',
      badge: 'Tauri',
      color: 'purple',
      body: (
        <List
          items={[
            '首次启动时，它会询问服务器路由的地址；如果服务器需要，还会询问令牌，并以 Authorization: Bearer 发送；这些信息会被保存，每次启动时重试。',
            'Server → Change Server…（⇧⌘K）可以更换服务器。',
            '下载的文件保存到“下载”文件夹，重名时自动改名，例如 “report (2).pdf”。',
            <>
              <C>npm run desktop</C> 会连接 playground 打开它；<C>npm run build:desktop</C> 会生成 ReboFiles.app。
            </>,
          ]}
        />
      ),
    },
    {
      id: 'let-it-in',
      title: '放行',
      badge: 'cors',
      color: 'yellow',
      lead: '先应答浏览器的预检请求，并允许读取分片的 ETag。仅限列出的来源。',
      body: <Code code={ORIGINS} />,
    },
    {
      id: 'and-the-bucket',
      title: '还有存储桶',
      badge: '存储桶',
      color: 'blue',
      body: <P>文件内容会从窗口直接发送到存储桶：请把相同的来源也加入存储桶的跨域规则。</P>,
    },
    {
      id: 'not-yet',
      title: '暂不支持',
      badge: '下一步',
      color: 'pink',
      body: (
        <List
          items={[
            '让磁盘上的文件夹像网盘文件夹一样被管理：同步引擎 @rebofiles/desktop 是下一步。',
            '通过服务器页面登录，适用于会话只靠 cookie 的服务器。',
            'Windows 和 Linux：构建方式相同，但尚未测试。签名和公证：尚未完成。',
          ]}
        />
      ),
    },
  ],
};
