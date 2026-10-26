// 协作：AI 助手以其用户的权限在网盘中工作。

import { TOOLS } from '@rebofiles/mcp';
import { C, Callout, Code, type DocPage, List, P, RefTable } from '../../ui';
import { CLAUDE, DocumentTools, HTTP, STDIO, toolId } from '../together';

export const assistants: DocPage = {
  title: 'AI 助手（MCP）',
  description: '供 Claude 等助手使用的 MCP 服务器：在你的应用中通过 HTTP 或通过 stdio 运行，每个工具的说明、助手可以触及的范围，以及借助 Rebodocs 处理 Word 文档。',
  source: 'apps/site/components/docs/pages/zh/together.tsx',
  lead: (
    <>
      <C>@rebofiles/mcp</C> 把网盘以工具的形式提供给助手：列出、搜索、阅读、写入文字、重命名、移动、设置颜色和移到回收站。每个工具都以用户本人的权限调用网盘的路由，因此助手同样要经过 <C>authorize</C>
      。
    </>
  ),
  sections: [
    {
      id: 'over-http',
      title: '在你的应用中，通过 HTTP',
      badge: 'HTTP',
      color: 'blue',
      lead: '放在网盘路由旁边：它会把每个请求的授权信息和 cookie 转发给网盘，因此只需用户的令牌即可。',
      body: (
        <>
          <Code code={HTTP} />
          <Code lang="bash" code={CLAUDE} />
          <P>
            <C>headers</C> 可以另行指定请求网盘时使用的请求头；<C>fetch</C> 直接传入网盘的处理器，在同一进程中调用；<C>origins</C> 是除自身外允许浏览器调用它的来源。
          </P>
        </>
      ),
    },
    {
      id: 'over-stdio',
      title: '在你的电脑上，通过 stdio',
      badge: 'stdio',
      color: 'green',
      lead: '适用于 Claude Desktop 以及其他通过启动命令接入的客户端。',
      body: <Code lang="json" code={STDIO} />,
    },
    {
      id: 'what-it-may-touch',
      title: '助手可以触及的范围',
      badge: '安全',
      color: 'yellow',
      body: (
        <List
          items={[
            '仅限其用户本人可以操作的内容：每个工具都要经过网盘的路由、identify 和 authorize。',
            '没有不可撤回的操作：它可以移到回收站，但不能永久删除；也不能共享。它做的一切都可以从回收站或版本中撤回。',
            '服务器拒绝的请求会以文字形式返回给模型，让它改做别的事。',
          ]}
        />
      ),
    },
    {
      id: 'every-tool',
      title: '全部工具',
      badge: '工具',
      color: 'purple',
      lead: '与服务器向助手描述的一致（英文）。',
      body: (
        <RefTable
          label="网盘的工具"
          name="工具"
          rows={TOOLS.map((tool) => ({ id: toolId(tool.name), name: tool.name, type: tool.annotations.readOnlyHint ? '只读' : '写入', does: tool.description }))}
        />
      ),
    },
    {
      id: 'word-documents',
      title: '借助 Rebodocs 处理 Word 文档',
      badge: 'Rebodocs',
      color: 'pink',
      lead: '安装 @rebodocs/mcp 后，网盘中的 .docx 会通过 Rebodocs 自带的工具阅读和编辑，每次修改都保存为一个版本。',
      body: (
        <>
          <DocumentTools none="构建本网站的环境中未安装 Rebodocs。" label="网盘上的 Rebodocs 工具" name="工具" />
          <Callout title="期间他人做出的保存">会在写入前向网盘查询时被发现，不会被覆盖。</Callout>
        </>
      ),
    },
  ],
};
