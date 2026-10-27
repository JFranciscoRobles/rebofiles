// 数据库结构：@rebofiles/server 创建的表、条目的保存形式、文件的每个字段、
// 设置、Prisma，以及你自己的查询。

import { docHref } from '@/lib/site';
import { C, Callout, Code, type DocPage, List, P, Table } from '../../ui';
import { BASELINE, FILE, FOLDER, FRESH, LINE, ONE_POOL, POSTGRES, PRISMA, PRISMA_QUERIES, QUERIES, STORE } from '../schema';

const to = (slug: string) => docHref('zh', slug);

const ENTRY_FIELDS: [string, string, string][] = [
  ['kind', "'file' | 'folder'", '它是什么。'],
  ['id', 'string', '它的 id，默认为 UUID，除非 newId 另有规定；同时也是 id 列。'],
  ['name', 'string', '用户看到的名称，包含扩展名；同一文件夹中不会重复，不区分大小写和重音。'],
  ['parent', 'string | null', '它所在的文件夹；根目录为 null。同时也是 parent 列。'],
  ['owner', 'string', 'identify() 为创建者提供的 id；在根目录时，表示它位于谁的“我的文件”中。'],
  ['created', 'ISO 8601', '创建或首次上传的时间。'],
  ['modified, modifiedBy', 'ISO 8601, string', '最近一次修改名称、位置或内容的时间及修改人。更改颜色或共享不计入。'],
  ['type', 'string', '文件的媒体类型，与上传时声明的一致（application/pdf、image/png）。'],
  ['versions', 'Version[]', '文件的各个版本，最新的在前，永不为空。versions[0] 就是文件的当前状态。'],
  ['color', 'FolderColor', '文件夹的颜色：red、orange、yellow、green、teal、blue、purple、pink 或 gray；使用网盘默认颜色时省略。'],
  ['trashed', '{ at, by }', '只出现在被直接移入回收站的条目上；其中的内容是随它一起进入回收站的。'],
  ['shares', 'Share[]', '还与谁共享：{ with, role, by, at }，"*" 表示所有已登录用户。'],
  ['links', 'Link[]', '它的链接：{ id, role, expires, locked?, uses?, used?, spent?, by, at }。'],
];

const VERSION_FIELDS: [string, string, string][] = [
  ['id', 'string', '它的 id。'],
  ['key', 'string', '内容在存储桶中的位置：文件的 id 加上版本自己的 id，即 "<file>/<version>"。绝不是路径。'],
  ['size', 'number', '字节数，以上传完成时服务器核对的结果为准。'],
  ['at, by', 'ISO 8601, string', '上传时间及上传人。'],
  ['sha256', 'string', '内容的 SHA-256（十六进制），由页面计算（适用于 64 MiB 以内的文件）：用于识别再次上传的同一文件。'],
  ['placeholder', 'string', '图片或 Word 文档的占位图：几百字节的 data: URL，加载时以模糊方式显示。'],
  ['renditions', 'Rendition[]', '缩小的副本：{ size, width, height, key, type, bytes }，键为 "<file>/<version>@<size>"。'],
  ['restoredFrom', 'string', '通过恢复旧版本创建的版本：恢复自哪个版本。'],
  ['note', 'string', '版本备注（如果有）。'],
];

export const schema: DocPage = {
  title: '数据库结构',
  description: '@rebofiles/server 在 Postgres 和 SQLite 中创建的表、文件的每个字段、设置、Prisma ORM 的模型与迁移，以及你自己的查询。',
  source: 'apps/site/components/docs/pages/zh/schema.tsx',
  lead: (
    <>
      文件内容存放在存储桶中；其余一切都在数据库里：文件夹、名称、所有者、版本、共享、链接、回收站、设置、动态记录以及文件中的文字。存储在首次启动时会自动建表，无需手动执行任何操作：本页只是让你了解其中有什么。
    </>
  ),
  tip: '提示：五张表，无需手动迁移，还提供 Prisma 模型',
  sections: [
    {
      id: 'the-tables',
      title: '表',
      badge: '概览',
      color: 'blue',
      lead: '共五张，以条目表的名称命名：默认为 rebofiles_entries，除非为 postgresMetadata 传入 { table }。sqliteMetadata 会在一个文件中创建同样的表，命名为 rebofiles_*，文字存放在 SQLite 的全文搜索表（FTS5）中。',
      body: (
        <Table
          label="表"
          columns={['表', '每行是', '写入时机']}
          code={[0]}
          rows={[
            ['rebofiles_entries', '一个完整的文件夹或文件，以 JSON 形式', '每次改动，只写入涉及的行'],
            ['…_settings', '按名称存放的一项设置，以 JSON 形式', '保存设置时；创建带密码的链接时；查看“与我共享”时'],
            ['…_revision', '只有一行：一个数字', '随每次改动递增，与改动在同一条语句中'],
            ['…_activity', '一条操作记录', '每次改动后，为其中的每个操作写一行'],
            ['…_text', '文件中的文字', '上传文件且页面读取了其中的文字时'],
          ]}
        />
      ),
    },
    {
      id: 'on-postgres',
      title: '在 Postgres 中',
      badge: 'Postgres',
      color: 'green',
      lead: '由 postgresMetadata 创建，期间持有数据库锁，避免两个同时启动的进程重复建表。',
      body: <Code lang="sql" code={POSTGRES} file="postgresMetadata(pool)" />,
    },
    {
      id: 'an-entry',
      title: '条目的保存形式',
      badge: 'entry',
      color: 'purple',
      lead: 'entry 列就是 @rebofiles/core 中的条目本身：文件包含其版本、共享和链接；文件夹包含其颜色。',
      body: (
        <>
          <Code lang="jsonc" code={FILE} file="文件" />
          <Code lang="jsonc" code={FOLDER} file="文件夹" />
          <List
            items={[
              <>
                <C>id</C> 和 <C>parent</C> 同时也是列，用于索引文件夹中的内容；其余字段只存在于 JSON 中。
              </>,
              <>版本的键由文件 id 和版本自己的 id 组成，绝不是路径：重命名和移动从不触及存储桶。</>,
              <>
                回收站中文件夹里的内容是随文件夹一起进入回收站的：只有文件夹本身带有 <C>trashed</C>。共享也是如此：共享文件夹中的内容是随文件夹一起共享的。
              </>,
              <>
                链接的密码不在这里：<C>locked: true</C> 表示它设置了密码，密码保存在设置中。
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: 'the-fields-of-a-file',
      title: '文件的字段',
      badge: '元数据',
      color: 'yellow',
      lead: '每个文件和文件夹的元数据就是 rebofiles_entries 的 entry 列：没有其他文件表。它的全部字段如下：',
      body: (
        <>
          <Table label="条目的字段" columns={['字段', '类型', '说明']} code={[0]} rows={ENTRY_FIELDS.map(([field, type, what]) => [field, <C key={field}>{type}</C>, what])} />
          <P>以及每个版本的字段：</P>
          <Table label="版本的字段" columns={['字段', '类型', '说明']} code={[0]} rows={VERSION_FIELDS.map(([field, type, what]) => [field, <C key={field}>{type}</C>, what])} />
          <Callout title="目前尚未保存：">
            原图的宽度和高度（只有缩小副本的）、相机写入照片的信息（EXIF）、视频或音乐的时长，以及文档的页数。你可以在旁边建一张自己的表，按文件 id 保存这些信息。
          </Callout>
        </>
      ),
    },
    {
      id: 'settings',
      title: '按名称保存的设置',
      badge: 'settings',
      color: 'orange',
      body: (
        <Table
          label="保存的设置"
          columns={['名称', '值']}
          code={[0]}
          rows={[
            ['drive', '{ language, theme, brand, images: { enabled, sizes, format, quality }, quota, trashDays, company, requestTemplates }：网盘的设置，由有权配置的人保存。'],
            ['person:<id>', '{ language, theme }：某个人自己的设置，优先于网盘设置。'],
            ['link:<link id>', '"salt:hash"：经 scrypt 处理的链接密码（32 字节，16 字节盐值），绝不保存密码原文。'],
            ['seen-shared:<id>', '此人上次查看“与我共享”的时间（ISO 8601）：比它新的就是新内容。'],
          ]}
        />
      ),
    },
    {
      id: 'activity',
      title: '一条动态记录',
      badge: 'activity',
      color: 'pink',
      lead: 'line 列；旁边还有 entry、parent 和 origin 列，用于查找某个文件以及某个文件夹内的记录。',
      body: <Code lang="jsonc" code={LINE} />,
    },
    {
      id: 'why-so',
      title: '为什么这样设计',
      badge: '设计',
      color: 'blue',
      body: (
        <List
          items={[
            <>
              <strong>一行一个条目。</strong>网盘一次性完整读取并保存在内存中，只有当修订号表明有改动时才重新读取，因此对数据库只按 id 查询，从不做连接：列出 20,000 个条目不到一毫秒。
            </>,
            <>
              <strong>只写入改动的部分。</strong>重命名只写一行；移动文件夹只写文件夹本身，不写其中的内容，因为子项是按 id 引用它的。
            </>,
            <>
              <strong>要么全部完成，要么完全不做。</strong>在 Postgres 中，一次改动就是一条语句：删除的行、写入的行和修订号一起提交。传入连接池时，每次改动还会持有 <C>pg_advisory_xact_lock</C>
              ，因此两台服务器永远不会同时修改网盘。
            </>,
            <>
              <strong>没有外键。</strong>模型在写入之前检查目录树（文件夹不会位于自身之内，同一文件夹中不会有重名）；数据库只负责保存。
            </>,
            <>
              <strong>足以支撑一个团队乃至更大规模；</strong>但不适用于数百万个条目，那需要按文件夹查询存储。
            </>,
          ]}
        />
      ),
    },
    {
      id: 'with-prisma',
      title: '配合 Prisma ORM',
      badge: 'Prisma',
      color: 'yellow',
      lead: '适用于用 Prisma 7 管理自己数据表的应用：把网盘的表作为 schema.prisma 中的模型，用 Prisma 读取，并避免它的迁移触及这些表。',
      body: (
        <>
          <Code lang="prisma" code={PRISMA} file="prisma/schema.prisma" />
          <List
            items={[
              <>
                <C>@@map</C> 保留表本身的名称；如果使用 <C>postgresMetadata(pool, &#123; table: 'acme_files' &#125;)</C>，请改为映射到那些表名。
              </>,
              <>
                <C>words</C> 是 <C>tsvector</C> 类型，Prisma 将其识别为 <C>Unsupported</C>：文字表的模型需要用 SQL 读取，并且只由网盘写入。
              </>,
              <>
                <C>prisma db pull</C> 会提示修订表上的 <C>CHECK (id = 1)</C>：它仍保留在表中，只是 Prisma 不对其建模。
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: 'one-pool',
      title: 'Prisma 与网盘共用一个连接池',
      badge: 'Prisma',
      color: 'green',
      lead: 'Prisma 7 通过 @prisma/adapter-pg 连接 Postgres，它接受一个 pg.Pool：把同一个连接池也传给 postgresMetadata。',
      body: <Code code={ONE_POOL} />,
    },
    {
      id: 'migrations-with-prisma',
      title: '使用 Prisma 迁移',
      badge: 'Prisma',
      color: 'purple',
      lead: 'Prisma Migrate 会把它不认识的表视为偏差（drift），并提议重置数据库、清空其中的一切：请把网盘的表写进 schema，并将它们标记为已创建。',
      body: (
        <>
          <Code lang="bash" code={BASELINE} />
          <Code lang="bash" code={FRESH} />
          <Callout title="两种顺序都可以。">
            ReboFiles 用 <C>IF NOT EXISTS</C> 建表，用 <C>ON CONFLICT DO NOTHING</C> 写入修订表的唯一一行：Prisma 先建好的表会被原样沿用。
          </Callout>
        </>
      ),
    },
    {
      id: 'queries-with-prisma',
      title: '使用 Prisma 查询',
      badge: 'Prisma',
      color: 'pink',
      lead: '用 Prisma 客户端和 JSON 路径读取网盘，无法表达的部分用 SQL。修改请通过网盘的路由进行，这样修订号会递增，目录树也保持完整。',
      body: <Code code={PRISMA_QUERIES} />,
    },
    {
      id: 'queries-of-your-own',
      title: '你自己的查询',
      badge: 'SQL',
      color: 'green',
      lead: '用于报表、导出或后台任务：随意读取。修改请通过服务器或 @rebofiles/core 进行，这样修订号会递增，目录树也保持完整。',
      body: (
        <>
          <Code lang="sql" code={QUERIES} />
          <Callout title="手动写入表">在修订号递增之前，已在内存中持有网盘的进程是看不到的：请在同一事务中递增修订号，或通过路由修改网盘。</Callout>
        </>
      ),
    },
    {
      id: 'making-it-yourself',
      title: '自行建表',
      badge: '迁移',
      color: 'yellow',
      body: (
        <List
          items={[
            <>
              服务器连接数据库所用的用户，第一次需要有建表权限，之后需要读写权限。如果你想用自己的迁移来建表，请先执行上面的 DDL：<C>IF NOT EXISTS</C> 会让已有的表保持不变。
            </>,
            <>
              <C>postgresMetadata(pool, &#123; table: 'acme_files' &#125;)</C> 会把表命名为 <C>acme_files</C>、<C>acme_files_settings</C>……与你应用自己的表放在同一个 schema 中。
            </>,
            <>如果 ReboFiles 的新版本需要新增表或列，也会在首次启动时以同样的方式创建。</>,
          ]}
        />
      ),
    },
    {
      id: 'a-store-of-your-own',
      title: '你自己的存储',
      badge: 'MetadataStore',
      color: 'purple',
      lead: '换一种数据库，或以不同方式组织你自己的表：只需两个方法，其余都是可选的。',
      body: (
        <>
          <Code code={STORE} />
          <P>
            <C>save</C> 会收到每次改动中写入的条目和删除的 id，来自 core 的 <C>changes(before, after)</C>。<a href={to('metadata')}>元数据</a>一页介绍了每种存储的用途。
          </P>
        </>
      ),
    },
  ],
};
