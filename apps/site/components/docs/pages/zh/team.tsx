// 团队很快会对网盘提出的需求（中文）：评论；服务器告知做了什么、
// 哪里出错、每人可请求多少；以及保留、法律保留和导出个人的全部数据。

import { docHref } from '@/lib/site';
import { C, Callout, Code, type DocPage, List, P, Table } from '../../ui';
import { COMMENTS_HOOK, EXPORT_CODE, FIELDS_CODE, HOOKS_CODE, LIMITS_CODE, ON_COMMENT, REDIS_CODE, RETENTION_CODE, STARRED_CODE, WEBHOOK_CODE } from '../team';

const hrefOf = (slug: string) => docHref('zh', slug);

export const comments: DocPage = {
  title: '评论',
  description: '人们对文件或文件夹的评论：带回复的讨论串、处理后标记为已解决、用 @ 提到某人，可在网盘、hooks 和助手中使用。',
  source: 'packages/core/src/comments.ts',
  lead: (
    <>
      可以评论的人（评论者、编辑者、所有者）在文件或文件夹详情的<strong>评论</strong>中发表意见；可以读取的人都能看到。回复位于其讨论串的第一条评论之下，处理完毕后可将讨论串标记为已解决。
    </>
  ),
  sections: [
    {
      id: 'in-the-drive',
      title: '在网盘中',
      badge: '详情',
      color: 'blue',
      body: (
        <List
          items={[
            <>
              详情中的<strong>评论</strong>标签：每个讨论串及其回复，谁在何时说了什么，修改过的会标注“已编辑”。
            </>,
            <>
              <strong>回复</strong>、<strong>标记为已解决</strong>或<strong>重新打开</strong>讨论串；<strong>编辑</strong>和<strong>删除</strong>自己的评论。所有者可以删除任何评论。
            </>,
            <>⌘Enter 或 Ctrl+Enter 发送；Escape 退出编辑。他人的评论通过事件实时到达。</>,
            <>
              每条评论都记录在其所属条目的动态中（<C>commented</C>），条目被永久删除时评论也随之删除。
            </>,
          ]}
        />
      ),
    },
    { id: 'in-your-own-screen', title: '在自定义界面中', badge: 'Hooks', color: 'purple', body: <Code code={COMMENTS_HOOK} lang="tsx" /> },
    {
      id: 'telling-who-is-named',
      title: '通知被提到的人',
      badge: '服务器',
      color: 'green',
      lead: '评论中用 @ 提到的人（`@bea`、`@ana.lopez`）在 `mentions` 中：通知他们由你的应用负责，与 onShare 相同。',
      body: <Code code={ON_COMMENT} />,
    },
    {
      id: 'for-the-assistant',
      title: '供助手使用',
      badge: 'MCP',
      color: 'orange',
      body: (
        <P>
          <C>list_comments</C> 读取评论，<C>add_comment</C> 以助手所服务的人的名义、按其权限发表评论，或带上 <C>replyTo</C> 回复：“在合同上备注客户已签字”。参见{' '}
          <a href={hrefOf('assistants')}>AI 助手</a>。
        </P>
      ),
    },
  ],
};

export const observe: DocPage = {
  title: '钩子、日志与限制',
  description: '服务器告诉你的应用做了什么（onChange）、哪里出错（logger）、每个路由耗时多少（OpenTelemetry），以及每人可请求多少。',
  source: 'packages/server/src/observe.ts',
  lead: (
    <>
      服务器对自身的报告，以及允许每个人多频繁地操作。每一项都是 <C>createDriveHandler</C> 的选项，你的代码出错只会被记录，不影响请求。
    </>
  ),
  sections: [
    {
      id: 'what-is-done',
      title: '做了什么、哪里出错、耗时多少',
      badge: '钩子',
      color: 'blue',
      body: (
        <>
          <Code code={HOOKS_CODE} />
          <List
            items={[
              <>
                <C>onChange</C> 会收到每一次操作，与动态记录一致（<C>created</C>、<C>uploaded</C>、<C>version</C>、<C>renamed</C>、<C>moved</C>、<C>trashed</C>、<C>restored</C>、<C>deleted</C>、
                <C>shared</C>、<C>commented</C>、<C>held</C>…），并附带操作后的条目，删除后为 null。
              </>,
              <>
                <C>logger</C> 记录服务器未在响应中说明的问题：未保存的动态、失败的钩子、无法检查的文件。默认为 <C>console</C>。
              </>,
              <>
                <C>onRequest</C> 会收到每个路由（如 <C>GET /entries/:id</C>）、状态、耗时和请求者。<C>openTelemetry(meter)</C> 将其记录为 <C>http.server.request.duration</C> 直方图和 5xx 计数器。
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: 'how-much-each-may-ask',
      title: '每人可请求多少',
      badge: '限制',
      color: 'yellow',
      body: (
        <>
          <Table
            label="默认限制"
            columns={['类型', '按', '默认']}
            code={[0]}
            rows={[
              ['uploads', '个人', '每分钟 1000 次'],
              ['zip', '个人，以及链接', '每分钟 30 次'],
              ['searchText', '个人', '每分钟 120 次'],
              ['linkPassword', '链接和地址', '15 分钟内错误 10 次，之后连正确的也不接受'],
              ['links', '链接', '每分钟 600 次'],
              ['requests', '个人', '无'],
            ]}
          />
          <Code code={LIMITS_CODE} />
          <P>
            超过限制时返回 <C>429 rate-limited</C> 并带有 <C>Retry-After</C>，网盘会用每个人的语言提示。设为 <C>limits: false</C> 则不限制。
          </P>
        </>
      ),
    },
    {
      id: 'webhooks',
      title: 'Webhook',
      badge: 'HTTP',
      color: 'green',
      lead: '通过 HTTP 把每次更改告知其他服务，就像 onChange 告诉你的代码一样：从不拖慢触发更改的请求。',
      body: (
        <>
          <Code code={WEBHOOK_CODE} />
          <List
            items={[
              <>
                请求体：<C>id</C>（每次重试相同）、<C>action</C>、<C>at</C>、<C>by</C>、简要的 <C>entry</C> 和 <C>activity</C>。请求头 <C>X-Rebofiles-Event</C>、<C>X-Rebofiles-Delivery</C>、
                <C>X-Rebofiles-Timestamp</C> 和 <C>X-Rebofiles-Signature</C>（时间戳和请求体的 HMAC-SHA256）。
              </>,
              <>
                一秒后和四秒后重试，但因请求本身被拒绝（4xx）时不重试；未送达时会通知 <C>onFailure</C>。
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: 'more-than-one-process',
      title: '多个进程',
      badge: 'Redis',
      color: 'pink',
      lead: '计数默认保存在进程内，除非你提供的 `limiter` 为所有进程保存：基于 Redis 只需几行。',
      body: <Code code={REDIS_CODE} file="limiter.ts" />,
    },
  ],
};

export const keeping: DocPage = {
  title: '保留、法律保留与导出',
  description: '让文件至少保留若干天，对文件夹设置法律保留使其中内容不被删除，并按 GDPR 要求把某人的全部数据打包为一个 .zip。',
  source: 'packages/core/src/ops.ts',
  lead: <>企业把文件放进网盘之前会提出的三件事：不能过早删除，案件所需的内容要保留，个人可以带走自己的数据。</>,
  sections: [
    {
      id: 'a-minimum-of-days',
      title: '最少保留天数',
      badge: '保留',
      color: 'blue',
      body: (
        <>
          <P>
            网盘设置中的 <C>retentionDays</C>（<strong>设置 → 存储</strong>
            ，限有配置权限的人）：创建未满这么多天的内容，任何人或回收站自动清空都不能永久删除。仍可移入回收站并恢复；清空回收站时会保留它，删除时返回 <C>409 retained</C>。
          </P>
          <Code code={RETENTION_CODE} />
        </>
      ),
    },
    {
      id: 'a-legal-hold',
      title: '法律保留',
      badge: '保留',
      color: 'pink',
      body: (
        <List
          items={[
            <>
              在详情中<strong>设置保留</strong>（限有配置权限的人）：在解除之前，它及其中的任何内容都不能被任何人移入回收站或删除。尝试时返回 <C>409 on-hold</C>。
            </>,
            '仍可上传新版本：之前的版本照常保留。',
            <>
              详情会显示谁设置了保留以及原因；动态中有 <C>held</C> 和 <C>released</C>，并会通知 <C>onChange</C>。
            </>,
          ]}
        />
      ),
    },
    {
      id: 'everything-of-a-person',
      title: '某人的全部数据',
      badge: '导出',
      color: 'green',
      body: (
        <>
          <P>
            <strong>设置 → 语言 → 下载我的数据</strong>会把自己拥有的内容按原位置打包为 .zip，并附上 <C>rebofiles-export.json</C>：其全部条目、与其共享的内容、评论、操作记录和设置。
            <C>GET /export</C> 返回同样的内容；有配置权限的人可用 <C>?user=</C> 导出他人的数据。
          </P>
          <Code code={EXPORT_CODE} />
          <Callout title="导出他人的数据时，">
            导出包含其拥有的内容和操作记录；其文件字节由你的服务器从存储中读取，因为 <C>byRoles</C> 只允许本人下载。
          </Callout>
        </>
      ),
    },
  ],
};

export const organizing: DocPage = {
  title: '星标与字段',
  description: '每个人加星标的文件和文件夹，集中在自己的位置；以及应用在每个条目上的自有字段，用来关联你的记录并据此查找。',
  source: 'packages/core/src/ops.ts',
  lead: <>两种再次找到重要内容的方式：个人为自己加的星标，以及你的应用关联到自身记录的字段。</>,
  sections: [
    {
      id: 'starred',
      title: '星标',
      badge: '个人',
      color: 'yellow',
      body: (
        <>
          <List
            items={[
              <>
                在文件或文件夹的详情或菜单中点击<strong>加星标</strong>：它在任何显示的位置都会带有星标，并出现在<strong>已加星标</strong>中，最近加星标的排在前面。
              </>,
              '仅限自己：其他人看不到某人加了哪些星标。已在回收站、已删除或已无权读取的内容不会显示。',
              <>
                作为个人设置保存（<C>starred:&lt;id&gt;</C>），最多一千个：<C>GET /starred</C>，<C>PUT</C> 和 <C>DELETE /entries/:id/star</C>。
              </>,
            ]}
          />
          <Code code={STARRED_CODE} />
        </>
      ),
    },
    {
      id: 'fields',
      title: '自有字段',
      badge: '你的记录',
      color: 'blue',
      lead: '条目上按名称保存的文字，由你的应用或用户设置，并可据此查找：把合同关联到 CRM 中的客户，把扫描件关联到案件。',
      body: (
        <>
          <Code code={FIELDS_CODE} lang="tsx" />
          <List
            items={[
              <>
                名称由字母、数字和 <C>_ . -</C> 组成，最多 64 个字符；值为文字，最多 1000 个字符；每个条目最多五十个。由有重命名权限的人设置（<C>PATCH /entries/:id</C>，带 <C>fields</C>）。
              </>,
              <>
                <C>GET /fields?name=&amp;value=</C> 查找具有该字段值且请求者可读取的内容：SQLite 和 Postgres 直接查询每个条目的 JSON，因此数千个条目的网盘不必整个读取。
              </>,
              <>
                详情中会显示这些字段，除非设置 <C>fields=&#123;false&#125;</C>；<C>fields="edit"</C> 允许有重命名权限的人在详情中修改，每行一个字段。
              </>,
            ]}
          />
        </>
      ),
    },
  ],
};
