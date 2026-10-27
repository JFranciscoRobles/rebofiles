// 文件：如何上传、如何显示、如何查找、如何保存、如何打包下载，以及借助 Rebodocs 处理 Word 文档。

import { docHref } from '@/lib/site';
import { C, Code, type DocPage, List, P, Table } from '../../ui';
import { COMPARE_CODE, COPY_CODE, DOCX, NEW_DOC, QUEUE, RESUME, SAVE, SIZES, SPACE, TOGETHER } from '../files';
import { DERIVE_CODE, OCR_CODE } from '../team';

const to = (slug: string) => docHref('zh', slug);
const SOURCE = 'apps/site/components/docs/pages/zh/files.tsx';
const ZIP_CODE = `import { downloadZip } from '@rebofiles/drive';\n\nconst { files, size, missed } = await downloadZip(client, ids, { name: '合同', onProgress, signal });`;

export const uploads: DocPage = {
  title: '上传',
  description: '分片直传到存储桶，同时三个文件并显示各自的剩余时间，支持整个文件夹、断点续传，并在上传前检测重复文件。',
  source: SOURCE,
  lead: <>可以通过按钮、拖放文件，或上传电脑上的整个文件夹。浏览器把文件内容直接发送到存储桶；服务器只负责签名目标地址、检查到达的内容并将其列出。</>,
  tip: '提示：把整个文件夹拖到网盘上试试',
  sections: [
    {
      id: 'in-parts',
      title: '分片直传到存储桶',
      badge: '原理',
      color: 'blue',
      lead: '大于 8 MiB 的文件会分片上传，每个分片发送到按其确切长度签名的地址，同时上传若干个。',
      body: (
        <List
          items={[
            <>
              <C>POST /uploads</C> 告诉页面每个分片发往哪里；分片发送到存储桶；<C>POST /uploads/finish</C> 将它们合并，服务器在列出文件之前会检查到达的大小。
            </>,
            <>
              失败的分片会从已到达的位置重试，最多五次，每次等待时间更长。文件最大 5 GiB，除非 <C>maxSize</C> 另有设定。
            </>,
            <>存储桶必须在跨域规则中暴露 ETag：页面从每个分片读取它，服务器需要它来合并分片。</>,
          ]}
        />
      ),
    },
    {
      id: 'the-panel',
      title: '上传面板',
      badge: '进度',
      color: 'green',
      lead: '同时上传三个文件；每个都显示已上传多少、速度和剩余时间，全部文件的汇总也一样。',
      body: (
        <>
          <P>可以停止某个文件，已到达的部分会被清除；失败的文件会从已到达的位置重试。速度取最近几秒的平均值，因此剩余时间能跟上变化，又不会随每次波动跳动。</P>
          <Code lang="tsx" code={QUEUE} />
        </>
      ),
    },
    {
      id: 'resumed',
      title: '断点续传',
      badge: '续传',
      color: 'yellow',
      lead: '被中断的上传，或关闭页面时未完成的上传，在把同一文件再次上传到同一位置时，会从中断处继续。',
      body: (
        <>
          <Code code={RESUME} />
          <P>
            页面会在 <C>localStorage</C> 中记住它一天，只要服务器还保留着这些分片。从未继续的上传会留在存储桶中，等待生命周期规则清理（“1 天后中止未完成的分片上传”）。
          </P>
        </>
      ),
    },
    {
      id: 'folders',
      title: '整个文件夹',
      badge: '文件夹',
      color: 'purple',
      body: <P>拖放到网盘上，或通过“上传文件夹”选择，文件夹会连同其中所有内容一起上传：子文件夹自上而下创建，空文件夹也会创建，名称冲突时加上 “(2)”。</P>,
    },
    {
      id: 'the-same-file',
      title: '重复文件的询问',
      badge: '重复',
      color: 'pink',
      lead: '每个文件上传前，都会先在网盘中查找。',
      body: (
        <>
          <Table
            label="询问内容"
            code={[]}
            columns={['发现', '询问']}
            rows={[
              ['在自己可读的任何位置有相同内容', '仍然上传，或跳过。'],
              ['目标位置已有同名文件', '替换（作为它的新版本）、两者都保留（“(2)”），或跳过。'],
            ]}
          />
          <P>
            内容通过页面中计算的 SHA-256 判断（适用于 64 MiB 以内的文件），并随版本保存（由 <C>POST /duplicates</C> 查找）。“对其余文件执行相同操作”会一次性回答同类的所有文件。
            <C>checkUploads=&#123;false&#125;</C> 则直接上传，不再询问。
          </P>
        </>
      ),
    },
    {
      id: 'what-goes-with-it',
      title: '随文件一起发送的内容',
      badge: '之后',
      color: 'orange',
      lead: '在页面中生成，并在文件之后发送；无论它们是否送达，文件本身都已上传完成。',
      body: (
        <List
          items={[
            <>
              图片：按网盘设置生成四种尺寸的副本，以及几像素大小的占位图。见<a href={to('previews')}>预览</a>。
            </>,
            <>
              文本文件或 Word 文档：其中的文字。见<a href={to('search')}>搜索</a>。
            </>,
          ]}
        />
      ),
    },
  ],
};

export const previews: DocPage = {
  title: '预览与查看器',
  description: '详情中显示的内容、覆盖在网盘上的查看器、四种尺寸且加载时先模糊显示的图片，以及有效期一小时的地址。',
  source: SOURCE,
  lead: <>详情中以小尺寸显示文件；双击或按 Enter 会在网盘之上完整显示，用 ← 和 → 切换到下一个。</>,
  sections: [
    {
      id: 'what-is-shown',
      title: '显示哪些内容',
      badge: '类型',
      color: 'blue',
      body: (
        <Table
          label="可显示的类型"
          code={[]}
          columns={['类型', '在详情中', '在查看器中']}
          rows={[
            ['图片', '能填满区域的最小副本', '适应窗口，点击查看实际大小'],
            ['Word 文档', '标题和开头几段，或第一页', '逐页或全部显示；Rebodocs 的缩放；打印'],
            ['PDF', '由浏览器显示第一页', '浏览器自带的查看器'],
            ['视频、音频', '—', '播放'],
            ['Excel 工作簿（.xlsx）', '卡片上显示前几行', '每个工作表显示为表格'],
            ['文本、Markdown、CSV、JSON、代码', '开头部分', '完整显示，有大小上限'],
          ]}
        />
      ),
    },
    {
      id: 'pictures-in-sizes',
      title: '四种尺寸的图片',
      badge: '副本',
      color: 'green',
      lead: '上传图片时，页面会按网盘设置中的尺寸生成副本，除非设置为保留原格式，否则使用 JPEG；原图保持原样。',
      body: (
        <>
          <Code code={SIZES} />
          <P>
            网格读取 160 或 480 的副本，详情读取 480，查看器读取 2048；<C>download?size=</C> 会返回在该尺寸下能显示图片的最小副本。
          </P>
        </>
      ),
    },
    {
      id: 'blurred-while-they-come',
      title: '加载时先模糊显示',
      badge: '占位图',
      color: 'purple',
      body: (
        <P>
          每张图片都有一个极小的副本，最长边 16 像素，以几百字节的 <C>data:</C> URL 形式随版本保存。网格、详情和查看器会在图片的位置下方以模糊方式显示它，直到图片加载完成。Word 文档的第一页也是如此。
        </P>
      ),
    },
    {
      id: 'addresses',
      title: '有效期一小时的地址',
      badge: '缓存',
      color: 'yellow',
      body: (
        <P>
          用于在页面中显示文件的地址从整点开始签名，整个小时内保持相同，有效期两小时，并带有 <C>Cache-Control: private, max-age=7200</C>：浏览器会缓存已读取过的缩略图。网格通过一次请求（
          <C>POST /urls</C>）获取所有地址，过期的地址会重新获取。
        </P>
      ),
    },
    {
      id: 'made-by-the-server',
      title: '由服务器生成',
      badge: 'derive',
      color: 'orange',
      lead: '不是来自页面的内容（助手、同步、脚本），以及页面不会生成的内容（PDF 的第一页）：在保存后片刻由服务器生成。',
      body: (
        <>
          <Code code={DERIVE_CODE} />
          <List
            items={[
              <>
                <C>pictures()</C>：用 <C>sharp</C> 生成网盘各尺寸的图片（不会大于原图）及其占位图。
              </>,
              <>
                <C>pdf()</C>：用 <C>pdfjs-dist</C> 和 <C>@napi-rs/canvas</C> 绘制 PDF 第一页，并提取前五十页的文字用于搜索。
              </>,
              <>
                <C>docx()</C>、<C>xlsx()</C> 和 <C>text()</C>：用 Rebodocs 读取 Word 文档的文字，读取 Excel 工作簿的单元格，以及文本文件的文字。
              </>,
              <>
                <C>video()</C>（传给 <C>deriveAll(…)</C>）：用 ffmpeg 截取视频的一帧，生成网盘的各个尺寸。
              </>,
            ]}
          />
          <P>页面会说明自己生成了什么，服务器只生成其余部分；每个库在首次需要时才加载，因此只需安装用到的库。页面会根据事件显示新生成的内容。</P>
        </>
      ),
    },
    {
      id: 'read-in-pictures',
      title: '图片中的文字',
      badge: 'OCR',
      color: 'pink',
      lead: '收据照片、扫描的合同：由 Tesseract 识别其中的文字后即可搜索。deriveAll() 默认不包含它，因为首次使用时会下载语言数据。',
      body: (
        <>
          <Code code={OCR_CODE} />
          <P>
            <C>ocr()</C> 读取图片，以及没有文字层的 PDF 的前几页（在 <C>pdf()</C> 之后运行，有文字的 PDF 由 <C>pdf()</C> 读取）。<C>langPath</C> 和 <C>cachePath</C> 指定语言数据的来源和保存位置。
          </P>
        </>
      ),
    },
  ],
};

export const search: DocPage = {
  title: '搜索',
  description: '按名称搜索，不区分大小写和重音；也可搜索文本文件和 Word 文档中的文字，并在列表中显示命中的词句。',
  source: SOURCE,
  lead: <>一个搜索框，先按名称查找，再按文件中的文字查找。每个词都会匹配，不区分大小写，有无重音均可：“cancion” 能找到 “Canción”。</>,
  sections: [
    {
      id: 'by-name',
      title: '按名称',
      badge: '名称',
      color: 'blue',
      body: <P>名称中包含每个词即可；以输入内容开头的结果排在前面。在回收站中，则搜索回收站。</P>,
    },
    {
      id: 'by-what-is-written',
      title: '按文字内容',
      badge: '文字',
      color: 'green',
      lead: '上传文件时，页面会读取其中的文字并随后发送，与对应的版本一起保存。',
      body: (
        <>
          <List
            items={[
              <>按类型或名称识别的文本文件：读取前 2 MiB。</>,
              <>
                Word 文档：使用 <C>textDocument=&#123;textOfDocx&#125;</C>，由 Rebodocs 的引擎读取；Excel 工作簿按单元格读取。
              </>,
              <>
                PDF、图片和扫描件由服务器读取，使用 <a href={`${docHref('zh', 'previews')}#made-by-the-server`}>derive</a> 和 <C>ocr()</C>。
              </>,
              <>保存前 100,000 个字符；没有自己文字的新版本不会被旧版本的文字搜到。</>,
            ]}
          />
          <P>通过文字找到的结果，会在名称下方显示关键词周围的一段原文。</P>
        </>
      ),
    },
    {
      id: 'where-it-is-kept',
      title: '保存在哪里',
      badge: '存储',
      color: 'yellow',
      body: (
        <P>
          SQLite 把文字保存在全文搜索表（FTS5）中，Postgres 使用 <C>tsvector</C> 和 GIN 索引；两者都不支持的存储则保存在进程内存中。服务器会再次核对存储找到的结果，因此所有存储的搜索结果都一致。
        </P>
      ),
    },
  ],
};

export const versions: DocPage = {
  title: '版本、回收站与空间',
  description: '每次保存都作为一个版本保留，恢复时无需重新上传内容；回收站会自动清空；每个人都有存储配额。',
  source: SOURCE,
  lead: <>无论保存还是删除，都不会丢失任何内容，除非有人明确操作，或超过了网盘保留的天数。</>,
  sections: [
    {
      id: 'versions',
      title: '版本',
      badge: '版本',
      color: 'blue',
      body: (
        <P>
          当上传位置已有同名文件并选择“替换”，或从 Rebodocs
          保存时，新文件会成为它的下一个版本，之前的版本保留。恢复某个版本会让它重新成为最新版本——以相同内容创建一个新版本，因此不会写入存储，恢复操作本身也可以撤销。
        </P>
      ),
    },
    {
      id: 'a-copy',
      title: '副本',
      badge: '副本',
      color: 'purple',
      lead: '在文件的菜单或详情中“创建副本”：一个独立的文件，放在原文件旁边，名称带“(2)”，内容在存储中直接复制。',
      body: (
        <>
          <Code code={COPY_CODE} />
          <P>副本属于创建者，计入其空间；只读共享的文件的副本放在其自己的顶层。缩略图和文字也会一并复制。S3、Azure 和磁盘由存储自己复制；Google Cloud Storage 则由服务器读取再写入，最多 100 MB。</P>
        </>
      ),
    },
    {
      id: 'the-trash',
      title: '回收站',
      badge: '回收站',
      color: 'yellow',
      body: (
        <P>文件夹会连同其中的所有内容一起移入回收站，恢复时也原样回到原位。从回收站删除会把每个版本的内容从存储桶中删除。⌘Z 或提示中的“撤销”可以撤回上一次移到回收站、移动、重命名或更改颜色的操作。</P>
      ),
    },
    {
      id: 'space',
      title: '空间，以及自动清空的回收站',
      badge: '配额',
      color: 'green',
      body: (
        <>
          <Code code={SPACE} />
          <P>
            超出配额的上传会在发送任何内容之前被拒绝（<C>413 over-quota</C>
            ）；所有版本都计入配额，回收站中的也算。网盘侧边会显示已用空间和总量。回收站每十分钟检查一次（随请求触发），放入时间超过设定天数的内容会被删除，文件内容也一并删除。
          </P>
        </>
      ),
    },
  ],
};

export const zip: DocPage = {
  title: '打包下载 .zip',
  description: '把多个文件、一个文件夹或共享链接中的文件夹打包成一个压缩包，在页面中边下载边生成，并提示无法读取的文件。',
  source: SOURCE,
  lead: <>选中多个文件或一个文件夹，即可打包为一个 .zip 下载。压缩包在页面中生成：服务器告诉页面包含哪些内容，每个文件的内容从存储桶读取后直接写入压缩包。</>,
  sections: [
    {
      id: 'how',
      title: '生成方式',
      badge: '原理',
      color: 'blue',
      body: (
        <List
          items={[
            <>
              <C>POST /zip</C> 返回要包含的内容：每个文件、每个文件夹及其中的内容，以及它们的路径，无权读取的内容会被排除。
            </>,
            <>文本由浏览器自带的 CompressionStream 压缩；已经压缩过的内容（图片、PDF、Word 文档）保持原样。超过 4 GiB 时使用 ZIP64。</>,
            <>超过 500 MB 时，如果浏览器允许页面写入文件，会直接写入用户选择的文件，页面中不保留任何内容。</>,
          ]}
        />
      ),
    },
    {
      id: 'what-was-left-out',
      title: '未包含的文件',
      badge: '遗漏',
      color: 'yellow',
      body: <P>无法读取的文件会被排除，压缩包由其余文件生成，提示中会显示数量，并提供单独下载它们的按钮。</P>,
    },
    {
      id: 'from-a-link',
      title: '通过链接下载',
      badge: '链接',
      color: 'pink',
      body: <P>拥有文件夹链接的人可以用同样的方式下载整个文件夹或其中的子文件夹，无需登录。</P>,
    },
    { id: 'in-code', title: '在代码中', badge: '代码', color: 'green', body: <Code code={ZIP_CODE} /> },
  ],
};

export const word: DocPage = {
  title: 'Word 文档',
  description: '安装 Rebodocs 后：.docx 由其引擎读取，用于详情、查看器、网格和搜索；可在其编辑器中打开，每次保存都是一个版本。',
  source: SOURCE,
  lead: (
    <>
      Rebodocs 是可选的对等依赖：安装 <C>@rebodocs/core</C> 和 <C>@rebodocs/viewer</C> 后，.docx 会由它的引擎读取，并在 Rebodocs 的查看器中显示。没有它时，网盘会像对待其他文件一样显示 .docx。
    </>
  ),
  sections: [
    { id: 'give-it-rebodocs', title: '接入 Rebodocs', badge: '开始', color: 'blue', body: <Code lang="tsx" code={DOCX} /> },
    {
      id: 'open-and-save',
      title: '打开并保存回网盘',
      badge: '编辑器',
      color: 'purple',
      lead: '“在 Rebodocs 中打开”会调用 onOpenDocument，并传入读取文件的地址；保存回网盘就是上传一个新版本。',
      body: (
        <>
          <Code lang="tsx" code={SAVE} />
          <P>
            playground 中的 <C>apps/playground/src/Editor.tsx</C> 就是这样做的：⌘S 保存，网盘会把该文档显示为它的下一个版本。
          </P>
        </>
      ),
    },
    {
      id: 'create-a-document',
      title: '创建文档',
      badge: '新建',
      color: 'yellow',
      body: (
        <>
          <Code lang="tsx" code={NEW_DOC} />
          <P>
            <C>newDocument</C> 用于生成空文档：Rebodocs 的 <C>newDocx</C>，或你自己的模板。没有 <C>onOpenDocument</C> 时，新文档在查看器中打开。
          </P>
        </>
      ),
    },
    {
      id: 'as-a-pdf',
      title: '导出为 PDF',
      badge: 'PDF',
      color: 'orange',
      body: (
        <P>
          Word 文档的查看器在“打印”旁有 <strong>PDF</strong> 按钮：由 Rebodocs 在页面中根据显示的页面生成并下载（<C>viewDocx</C> 返回对象的 <C>pdf()</C>）。编辑器也可以用 <C>editor.exportPdf()</C>{' '}
          生成。
        </P>
      ),
    },
    {
      id: 'together',
      title: '多人同时编辑',
      badge: '协作',
      color: 'pink',
      lead: '借助 Rebodocs 的协作服务器，网盘中的每个文档都是一个房间：打开它的人可以与其他人同时编写，各自有自己的光标；只能读取的人只能观看。',
      body: (
        <>
          <Code lang="tsx" code={TOGETHER} />
          <P>
            文档演示（<C>npm run documents</C>，<C>apps/documents</C>）完整实现了这一点：基于网盘的房间、根据每个人对文件的权限签发的票据，以及所有人离开后保存的新版本。
          </P>
        </>
      ),
    },
    {
      id: 'compare-versions',
      title: '比较两个版本',
      badge: '历史',
      color: 'blue',
      lead: 'Word 文档在某个版本与当前版本之间的变化，显示在页面上：红色删除线表示删除的内容，绿色下划线表示添加的内容，可逐个查看。',
      body: <Code lang="tsx" code={COMPARE_CODE} />,
    },
    {
      id: 'for-an-assistant',
      title: '供助手使用',
      badge: 'MCP',
      color: 'green',
      body: (
        <P>
          在 <C>@rebofiles/mcp</C> 旁边安装 Rebodocs 后，Claude 可以用 Rebodocs 自带的工具阅读和编辑网盘中的 Word 文档，每次修改都保存为一个版本：<a href={to('assistants')}>AI 助手</a>。
        </P>
      ),
    },
  ],
};
