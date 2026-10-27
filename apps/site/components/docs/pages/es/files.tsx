// Archivos: cómo suben, cómo se muestran, se encuentran, se guardan, se descargan
// juntos, y los documentos de Word con Rebodocs.

import { docHref } from '@/lib/site';
import { C, Code, type DocPage, List, P, Table } from '../../ui';
import { DOCX, NEW_DOC, QUEUE, RESUME, SAVE, SIZES, SPACE, TOGETHER } from '../files';
import { DERIVE_CODE, OCR_CODE } from '../team';

const to = (slug: string) => docHref('es', slug);
const SOURCE = 'apps/site/components/docs/pages/es/files.tsx';
const ZIP_CODE = `import { downloadZip } from '@rebofiles/drive';\n\nconst { files, size, missed } = await downloadZip(client, ids, { name: 'Contratos', onProgress, signal });`;

export const uploads: DocPage = {
  title: 'Subidas',
  description: 'Directo al bucket en partes, tres archivos a la vez con su tiempo restante, carpetas enteras, reanudación tras un corte y aviso de duplicados.',
  source: SOURCE,
  lead: <>Con el botón, soltando archivos, o una carpeta entera del ordenador. El navegador envía los bytes directo al bucket; el servidor solo firma adónde, comprueba lo que llegó y lo lista.</>,
  tip: 'consejo: suelta una carpeta entera sobre el drive',
  sections: [
    {
      id: 'in-parts',
      title: 'En partes, al bucket',
      badge: 'Cómo',
      color: 'blue',
      lead: 'Un archivo de más de 8 MiB va en partes, cada una a una dirección firmada para su longitud exacta, unas cuantas a la vez.',
      body: (
        <List
          items={[
            <>
              <C>POST /uploads</C> dice adónde enviar cada parte; las partes van al bucket; <C>POST /uploads/finish</C> las une, y el servidor comprueba el tamaño que llegó antes de listar el archivo.
            </>,
            <>
              Una parte que falla se reintenta, cinco veces con una espera más larga cada vez, desde lo que llegó. Archivos de hasta 5 GiB, salvo que <C>maxSize</C> diga otra cosa.
            </>,
            <>El bucket debe exponer ETag en su regla de orígenes: la página lo lee de cada parte, y el servidor lo necesita para unirlas.</>,
          ]}
        />
      ),
    },
    {
      id: 'the-panel',
      title: 'El panel de subidas',
      badge: 'Seguir',
      color: 'green',
      lead: 'Tres archivos a la vez; cada uno dice cuánto ha subido, a qué velocidad y cuánto le queda, y lo mismo de todos juntos.',
      body: (
        <>
          <P>
            Uno se detiene, y lo que llegó de él se retira; uno que falló se reintenta desde lo que llegó. La velocidad es la de los últimos segundos, así que el tiempo restante sigue los cambios sin
            saltar a cada sacudida.
          </P>
          <Code lang="tsx" code={QUEUE} />
        </>
      ),
    },
    {
      id: 'resumed',
      title: 'Reanudadas tras un corte',
      badge: 'Reanudar',
      color: 'yellow',
      lead: 'Una subida cortada, o dejada al cerrar la página, sigue desde donde iba cuando el mismo archivo se vuelve a subir al mismo sitio.',
      body: (
        <>
          <Code code={RESUME} />
          <P>
            La página lo recuerda en <C>localStorage</C> durante un día, mientras el servidor conserve las partes. Una que nunca se continúa espera en el bucket a una regla de ciclo de vida (“abortar
            subidas multiparte incompletas tras 1 día”).
          </P>
        </>
      ),
    },
    {
      id: 'folders',
      title: 'Carpetas enteras',
      badge: 'Carpetas',
      color: 'purple',
      body: (
        <P>
          Soltada sobre el drive, o elegida con “Subir una carpeta”, una carpeta sube con todo lo que contiene: sus carpetas creadas de arriba abajo, también las vacías, y “(2)” para un nombre ya
          ocupado.
        </P>
      ),
    },
    {
      id: 'the-same-file',
      title: 'El mismo archivo, consultado',
      badge: 'Duplicados',
      color: 'pink',
      lead: 'Antes de subir cada archivo, se busca en el drive.',
      body: (
        <>
          <Table
            label="Qué se pregunta"
            code={[]}
            columns={['Encontrado', 'Pregunta']}
            rows={[
              ['Los mismos bytes, en cualquier sitio que uno pueda leer', 'Subir igualmente, u omitir.'],
              ['Un archivo con su nombre donde va', 'Reemplazarlo (una nueva versión), conservar ambos (“(2)”), u omitir.'],
            ]}
          />
          <P>
            Los bytes se distinguen por un SHA-256 hecho en la página, para archivos de hasta 64 MiB, guardado con la versión (<C>POST /duplicates</C> lo encuentra). “Hacer lo mismo con todos los
            demás” responde de una vez a todos los de un tipo. <C>checkUploads=&#123;false&#125;</C> sube sin preguntar.
          </P>
        </>
      ),
    },
    {
      id: 'what-goes-with-it',
      title: 'Lo que va con él',
      badge: 'Después',
      color: 'orange',
      lead: 'Hecho en la página y enviado tras el archivo, que queda subido tanto si llegan como si no.',
      body: (
        <List
          items={[
            <>
              De una imagen, copias en los cuatro tamaños del drive y un placeholder de unos pocos píxeles: <a href={to('previews')}>Vistas previas</a>.
            </>,
            <>
              De un archivo de texto o un documento de Word, lo que tiene escrito: <a href={to('search')}>Búsqueda</a>.
            </>,
          ]}
        />
      ),
    },
  ],
};

export const previews: DocPage = {
  title: 'Vistas previas y el visor',
  description: 'Lo que muestran los detalles, el visor sobre el drive, imágenes en cuatro tamaños y difuminadas mientras llegan, y direcciones válidas durante una hora.',
  source: SOURCE,
  lead: <>Los detalles muestran un archivo en pequeño; un doble clic o Enter lo muestra entero, sobre el drive, con ← y → para pasar al siguiente.</>,
  sections: [
    {
      id: 'what-is-shown',
      title: 'Qué se muestra',
      badge: 'Tipos',
      color: 'blue',
      body: (
        <Table
          label="Tipos que se muestran"
          code={[]}
          columns={['Tipo', 'En los detalles', 'En el visor']}
          rows={[
            ['Imágenes', 'La copia más pequeña que lo llena', 'Ajustada a la ventana, un clic para el tamaño real'],
            ['Documentos de Word', 'Título y primeros párrafos, o la primera página', 'Página a página, o todas; el zoom de Rebodocs; imprimir'],
            ['PDF', 'Su primera página, por el navegador', 'El del propio navegador'],
            ['Vídeo, audio', '—', 'Se reproduce'],
            ['Libros de Excel (.xlsx)', 'Sus primeras filas, en su tarjeta', 'Cada hoja como una tabla'],
            ['Texto, Markdown, CSV, JSON, código', 'El comienzo', 'Entero, hasta un tamaño'],
          ]}
        />
      ),
    },
    {
      id: 'pictures-in-sizes',
      title: 'Imágenes en cuatro tamaños',
      badge: 'Copias',
      color: 'green',
      lead: 'Al subir una imagen, la página hace copias de ella para los tamaños de los ajustes del drive, en JPEG salvo que se diga que conserve el tipo; el original queda tal como llegó.',
      body: (
        <>
          <Code code={SIZES} />
          <P>
            La cuadrícula lee la de 160 o la de 480, los detalles la de 480, el visor la de 2048; <C>download?size=</C> da la más pequeña que muestra una imagen a un tamaño.
          </P>
        </>
      ),
    },
    {
      id: 'blurred-while-they-come',
      title: 'Difuminadas mientras llegan',
      badge: 'Placeholder',
      color: 'purple',
      body: (
        <P>
          Una copia diminuta de cada imagen, de 16 píxeles en su lado más largo y unos cientos de bytes como URL <C>data:</C>, se guarda con su versión. La cuadrícula, los detalles y el visor la
          muestran difuminada donde estará la imagen, debajo de ella, hasta que llega. De un documento de Word, lo mismo de su primera página.
        </P>
      ),
    },
    {
      id: 'addresses',
      title: 'Direcciones válidas durante una hora',
      badge: 'Caché',
      color: 'yellow',
      body: (
        <P>
          Una dirección para mostrar un archivo en la página se firma desde el comienzo de la hora, igual durante toda ella y válida durante dos, con <C>Cache-Control: private, max-age=7200</C>: el
          navegador conserva una miniatura que ya leyó. Una cuadrícula pide todas sus direcciones en una sola petición (<C>POST /urls</C>), y una que caducó se vuelve a pedir.
        </P>
      ),
    },
    {
      id: 'made-by-the-server',
      title: 'Hechas por el servidor',
      badge: 'derive',
      color: 'orange',
      lead: 'Lo que no viene de una página (un asistente, una sincronización, un script), y lo que ninguna página hace (la primera página de un PDF): lo hace el servidor un momento después de guardarlo.',
      body: (
        <>
          <Code code={DERIVE_CODE} />
          <List
            items={[
              <>
                <C>pictures()</C>: una imagen en los tamaños del drive, nunca mayor que ella, y su placeholder, con <C>sharp</C>.
              </>,
              <>
                <C>pdf()</C>: la primera página de un PDF dibujada, y el texto de sus primeras cincuenta páginas para la búsqueda, con <C>pdfjs-dist</C> y <C>@napi-rs/canvas</C>.
              </>,
              <>
                <C>docx()</C>, <C>xlsx()</C> y <C>text()</C>: lo que tiene escrito un documento de Word, con Rebodocs, las celdas de un libro de Excel y un archivo de texto.
              </>,
            ]}
          />
          <P>
            La página dice lo que hace ella misma, y el servidor hace solo el resto; cada biblioteca se pide al necesitarla, así que solo se instala lo que se usa. La página muestra lo que llega, como
            lo avisan los eventos.
          </P>
        </>
      ),
    },
    {
      id: 'read-in-pictures',
      title: 'Lo que dicen las imágenes',
      badge: 'OCR',
      color: 'pink',
      lead: 'La foto de un recibo, un contrato escaneado: encontrados por sus palabras, leídas por Tesseract. No está entre lo que hace deriveAll() si no se da, porque la primera vez descarga los datos de un idioma.',
      body: (
        <>
          <Code code={OCR_CODE} />
          <P>
            <C>ocr()</C> lee una imagen, y las primeras páginas de un PDF sin texto propio (después de <C>pdf()</C>, que lee los que sí lo tienen). <C>langPath</C> y <C>cachePath</C> dicen de dónde
            vienen y dónde se guardan los datos de cada idioma.
          </P>
        </>
      ),
    },
  ],
};

export const search: DocPage = {
  title: 'Búsqueda',
  description: 'Por nombre sin importar mayúsculas ni acentos, y por lo que está escrito en archivos de texto y documentos de Word, con las palabras encontradas en la fila.',
  source: SOURCE,
  lead: <>Una sola caja busca primero por nombre, y luego por lo que está escrito en un archivo. Cada palabra, en mayúsculas o minúsculas, con o sin acentos: “cancion” encuentra “Canción”.</>,
  sections: [
    {
      id: 'by-name',
      title: 'Por nombre',
      badge: 'Nombres',
      color: 'blue',
      body: <P>Cada palabra en alguna parte del nombre; primero los que empiezan por lo escrito. En la papelera, se busca en la papelera.</P>,
    },
    {
      id: 'by-what-is-written',
      title: 'Por lo que está escrito',
      badge: 'Texto',
      color: 'green',
      lead: 'Al subir un archivo, la página lee su texto y lo envía después, guardado con la versión a la que pertenece.',
      body: (
        <>
          <List
            items={[
              <>Archivos de texto por su tipo o su nombre: los primeros 2 MiB.</>,
              <>
                Documentos de Word con <C>textDocument=&#123;textOfDocx&#125;</C>, con el motor de Rebodocs; libros de Excel por sus celdas.
              </>,
              <>
                PDF, imágenes y escaneos, por el servidor, con <a href={`${docHref('es', 'previews')}#made-by-the-server`}>derive</a> y <C>ocr()</C>.
              </>,
              <>Se guardan los primeros 100 000 caracteres; una versión nueva sin texto propio no se encuentra por el de la anterior.</>,
            ]}
          />
          <P>Las filas encontradas así muestran, bajo su nombre, un trozo del texto alrededor de las palabras.</P>
        </>
      ),
    },
    {
      id: 'where-it-is-kept',
      title: 'Dónde se guarda',
      badge: 'Almacén',
      color: 'yellow',
      body: (
        <P>
          SQLite guarda los textos en una tabla de búsqueda de texto completo (FTS5), Postgres con un <C>tsvector</C> y un índice GIN; un almacén sin ninguno de los dos, en la memoria del proceso. El
          servidor revisa lo que encontró el almacén, así que todos los almacenes encuentran lo mismo.
        </P>
      ),
    },
  ],
};

export const versions: DocPage = {
  title: 'Versiones, papelera y espacio',
  description: 'Cada guardado conservado como versión y recuperado sin volver a enviar sus bytes, una papelera que se vacía sola, y una cuota por persona.',
  source: SOURCE,
  lead: <>Nada se pierde por guardar ni por borrar, hasta que alguien lo dice, o terminan los días que el drive lo conserva.</>,
  sections: [
    {
      id: 'versions',
      title: 'Versiones',
      badge: 'Versiones',
      color: 'blue',
      body: (
        <P>
          Un archivo subido donde ya hay uno con su nombre, cuando se elige “Reemplazar”, o guardado desde Rebodocs, es su siguiente versión; la anterior se queda. Restaurar una la vuelve la más
          reciente, como una nueva versión con los mismos bytes, así que no se escribe en el almacenamiento y también la restauración se puede deshacer.
        </P>
      ),
    },
    {
      id: 'the-trash',
      title: 'La papelera',
      badge: 'Papelera',
      color: 'yellow',
      body: (
        <P>
          Una carpeta entra con todo lo que contiene, y vuelve igual, donde estaba. Borrar desde la papelera quita los bytes del bucket, de cada versión. ⌘Z, o Deshacer en el aviso, revierte el último
          envío a la papelera, movimiento, cambio de nombre o color.
        </P>
      ),
    },
    {
      id: 'space',
      title: 'Espacio, y una papelera que se vacía sola',
      badge: 'Cuota',
      color: 'green',
      body: (
        <>
          <Code code={SPACE} />
          <P>
            Una subida que supera la cuota se rechaza antes de enviar nada (<C>413 over-quota</C>); cuentan todas las versiones, también las de la papelera. El lateral del drive muestra el espacio que
            uno usa, de cuánto. La papelera se revisa cada diez minutos, según llegan peticiones, y lo que lleva en ella los días indicados se borra, con sus bytes.
          </P>
        </>
      ),
    },
  ],
};

export const zip: DocPage = {
  title: 'Descargar como .zip',
  description: 'Varios archivos, una carpeta o la carpeta de un enlace en un solo archivo comprimido, hecho en la página a medida que llegan, avisando de lo que no se pudo leer.',
  source: SOURCE,
  lead: (
    <>
      Varios elegidos, o una carpeta, se descargan como un solo .zip. Se hace en la página: el servidor dice qué va dentro, y los bytes de cada archivo pasan del bucket al .zip a medida que se leen.
    </>
  ),
  sections: [
    {
      id: 'how',
      title: 'Cómo se hace',
      badge: 'Cómo',
      color: 'blue',
      body: (
        <List
          items={[
            <>
              <C>POST /zip</C> da lo que va dentro: cada archivo, cada carpeta con lo que contiene, en sus rutas, sin lo que no se puede leer.
            </>,
            <>El texto se comprime con el propio CompressionStream del navegador; lo que ya está comprimido (imágenes, PDF, documentos de Word) se guarda tal cual. ZIP64 para uno de más de 4 GiB.</>,
            <>A partir de 500 MB, donde el navegador deja que una página escriba un archivo, se escribe en uno que elige la persona, sin guardar nada en la página.</>,
          ]}
        />
      ),
    },
    {
      id: 'what-was-left-out',
      title: 'Lo que quedó fuera',
      badge: 'Omitidos',
      color: 'yellow',
      body: <P>Un archivo que no se pudo leer queda fuera, el .zip se hace con el resto, y el aviso dice cuántos, con un botón para descargarlos por separado.</P>,
    },
    {
      id: 'from-a-link',
      title: 'Desde un enlace',
      badge: 'Enlaces',
      color: 'pink',
      body: <P>Quien tiene un enlace a una carpeta la descarga entera, o una de sus carpetas, de la misma forma, sin iniciar sesión.</P>,
    },
    { id: 'in-code', title: 'En código', badge: 'Código', color: 'green', body: <Code code={ZIP_CODE} /> },
  ],
};

export const word: DocPage = {
  title: 'Documentos de Word',
  description: 'Con Rebodocs instalado: .docx leídos por su motor para los detalles, el visor, la cuadrícula y la búsqueda, abiertos en su editor, y cada guardado una versión.',
  source: SOURCE,
  lead: (
    <>
      Rebodocs es una dependencia opcional: con <C>@rebodocs/core</C> y <C>@rebodocs/viewer</C> instalados, un .docx se lee con su motor y se muestra en el visor de Rebodocs. Sin él, el drive muestra
      un .docx como cualquier otro archivo.
    </>
  ),
  sections: [
    { id: 'give-it-rebodocs', title: 'Dale Rebodocs', badge: 'Empezar', color: 'blue', body: <Code lang="tsx" code={DOCX} /> },
    {
      id: 'open-and-save',
      title: 'Ábrelo, y guárdalo de vuelta',
      badge: 'Editor',
      color: 'purple',
      lead: '“Abrir en Rebodocs” llama a onOpenDocument con una dirección desde la que leer el archivo; guardarlo de vuelta es subir una nueva versión.',
      body: (
        <>
          <Code lang="tsx" code={SAVE} />
          <P>
            El playground lo hace, en <C>apps/playground/src/Editor.tsx</C>: ⌘S guarda, y el drive muestra el documento como su siguiente versión.
          </P>
        </>
      ),
    },
    {
      id: 'create-a-document',
      title: 'Crear un documento',
      badge: 'Nuevo',
      color: 'yellow',
      body: (
        <>
          <Code lang="tsx" code={NEW_DOC} />
          <P>
            <C>newDocument</C> es lo que hace uno vacío: <C>newDocx</C> de Rebodocs, o una plantilla tuya. Sin <C>onOpenDocument</C>, el documento nuevo se abre en el visor.
          </P>
        </>
      ),
    },
    {
      id: 'as-a-pdf',
      title: 'Como PDF',
      badge: 'PDF',
      color: 'orange',
      body: (
        <P>
          El visor de un documento de Word tiene <strong>PDF</strong> junto a Imprimir: lo hace Rebodocs en la página, a partir de las páginas que se ven, y se descarga (<C>pdf()</C> de lo que da{' '}
          <C>viewDocx</C>). El editor también lo hace, con <C>editor.exportPdf()</C>.
        </P>
      ),
    },
    {
      id: 'together',
      title: 'Varias personas a la vez',
      badge: 'Colaboración',
      color: 'pink',
      lead: 'Con el servidor de colaboración de Rebodocs, cada documento del drive es una sala: quien lo abre escribe con los demás a la vez, cada uno con su cursor, y quien solo puede leerlo mira.',
      body: (
        <>
          <Code lang="tsx" code={TOGETHER} />
          <P>
            La demo de documentos (<C>npm run documents</C>, <C>apps/documents</C>) lo hace completo: las salas sobre el drive, un ticket firmado para cada persona según lo que puede hacer con el
            archivo, y una versión guardada cuando todos se van.
          </P>
        </>
      ),
    },
    {
      id: 'for-an-assistant',
      title: 'Para un asistente',
      badge: 'MCP',
      color: 'green',
      body: (
        <P>
          Con Rebodocs instalado junto a <C>@rebofiles/mcp</C>, Claude lee y edita los documentos de Word del drive con las propias herramientas de Rebodocs, cada cambio guardado como una versión:{' '}
          <a href={to('assistants')}>Asistentes de IA</a>.
        </P>
      ),
    },
  ],
};
