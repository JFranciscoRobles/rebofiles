// El esquema de la base de datos: las tablas que crea @rebofiles/server, una
// entrada tal como se guarda, cada campo de un archivo, los ajustes, Prisma y
// consultas propias.

import { docHref } from '@/lib/site';
import { C, Callout, Code, type DocPage, List, P, Table } from '../../ui';
import { BASELINE, FILE, FOLDER, FRESH, LINE, ONE_POOL, POSTGRES, PRISMA, PRISMA_QUERIES, QUERIES, STORE } from '../schema';

const to = (slug: string) => docHref('es', slug);

const ENTRY_FIELDS: [string, string, string][] = [
  ['kind', "'file' | 'folder'", 'Qué es.'],
  ['id', 'string', 'Su id, un UUID salvo que newId diga otra cosa; también la columna id.'],
  ['name', 'string', 'Como lo lee la persona, con la extensión; nunca dos veces en una carpeta, sin importar mayúsculas ni acentos.'],
  ['parent', 'string | null', 'La carpeta en la que está; null arriba del todo. También la columna parent.'],
  ['owner', 'string', 'El id que identify() dio a quien lo creó; arriba del todo, en los Mis archivos de quién está.'],
  ['created', 'ISO 8601', 'Cuándo se creó o se subió por primera vez.'],
  ['modified, modifiedBy', 'ISO 8601, string', 'Su último cambio de nombre, de lugar o de bytes, y de quién. Un color o una compartición no cuentan.'],
  ['type', 'string', 'De un archivo: su tipo de medio, como lo dijo la subida (application/pdf, image/png).'],
  ['versions', 'Version[]', 'De un archivo: sus versiones, la más nueva primero, nunca vacío. versions[0] es el archivo tal como está ahora.'],
  ['color', 'FolderColor', 'De una carpeta: red, orange, yellow, green, teal, blue, purple, pink o gray; se omite para el propio del drive.'],
  ['trashed', '{ at, by }', 'Solo en lo que se mandó a la papelera directamente; lo que tiene dentro está en la papelera a través de ello.'],
  ['shares', 'Share[]', 'Con quién más se comparte: { with, role, by, at }, con "*" para todos los que tienen sesión.'],
  ['links', 'Link[]', 'Sus enlaces: { id, role, expires, locked?, uses?, used?, spent?, by, at }.'],
];

const VERSION_FIELDS: [string, string, string][] = [
  ['id', 'string', 'Su id.'],
  ['key', 'string', 'Dónde están sus bytes en el bucket: el id del archivo y el suyo, "<file>/<version>". Nunca una ruta.'],
  ['size', 'number', 'En bytes, como los comprobó el servidor al terminar la subida.'],
  ['at, by', 'ISO 8601, string', 'Cuándo se subió, y quién.'],
  ['sha256', 'string', 'El SHA-256 de sus bytes en hex, como lo dijo la página (archivos de hasta 64 MiB): para reconocer el mismo archivo subido otra vez.'],
  ['placeholder', 'string', 'De una imagen o un documento de Word: una URL data: de unos cientos de bytes, mostrada difuminada mientras llega.'],
  ['renditions', 'Rendition[]', 'Copias más pequeñas: { size, width, height, key, type, bytes }, con la clave "<file>/<version>@<size>".'],
  ['restoredFrom', 'string', 'De una hecha al recuperar una versión antigua: cuál.'],
  ['note', 'string', 'Una nota sobre ella, si se dio.'],
];

export const schema: DocPage = {
  title: 'Esquema de la base de datos',
  description: 'Las tablas que crea @rebofiles/server en Postgres y SQLite, cada campo de un archivo, sus ajustes, modelos y migraciones de Prisma, y consultas propias.',
  source: 'apps/site/components/docs/pages/es/schema.tsx',
  lead: (
    <>
      Los bytes están en el bucket; todo lo demás está en una base de datos: carpetas, nombres, propietarios, versiones, comparticiones, enlaces, la papelera, ajustes, actividad y el texto de los
      archivos. El almacén crea sus tablas la primera vez que arranca, así que no hay nada que ejecutar a mano: esta página es para saber qué hay.
    </>
  ),
  tip: 'consejo: cinco tablas, nada que migrar a mano, y modelos para Prisma',
  sections: [
    {
      id: 'the-tables',
      title: 'Las tablas',
      badge: 'Resumen',
      color: 'blue',
      lead: 'Cinco, con el nombre de la tabla de entradas: rebofiles_entries salvo que postgresMetadata reciba { table }. sqliteMetadata crea las mismas en un archivo, llamadas rebofiles_*, con el texto en una tabla de búsqueda de texto completo de SQLite (FTS5).',
      body: (
        <Table
          label="Tablas"
          columns={['Tabla', 'Una fila es', 'Se escribe cuando']}
          code={[0]}
          rows={[
            ['rebofiles_entries', 'Una carpeta o un archivo, entero, como JSON', 'Cada cambio, solo las filas que toca'],
            ['…_settings', 'Un ajuste por su nombre, como JSON', 'Se guardan ajustes; se crea un enlace con contraseña; se mira Compartido conmigo'],
            ['…_revision', 'Una fila: un número', 'Sube con cada cambio, en la misma sentencia'],
            ['…_activity', 'Una línea de lo que se hizo', 'Tras cada cambio, una línea por cada cosa que hizo'],
            ['…_text', 'Lo que está escrito en un archivo', 'Se sube un archivo y la página leyó su texto'],
          ]}
        />
      ),
    },
    {
      id: 'on-postgres',
      title: 'En Postgres',
      badge: 'Postgres',
      color: 'green',
      lead: 'Tal como las crea postgresMetadata, bajo un bloqueo de la base de datos para que dos procesos que arrancan a la vez no lo intenten ambos.',
      body: <Code lang="sql" code={POSTGRES} file="postgresMetadata(pool)" />,
    },
    {
      id: 'an-entry',
      title: 'Una entrada, tal como se guarda',
      badge: 'entry',
      color: 'purple',
      lead: 'La columna entry es la entrada de @rebofiles/core tal cual: un archivo con sus versiones, comparticiones y enlaces; una carpeta con su color.',
      body: (
        <>
          <Code lang="jsonc" code={FILE} file="un archivo" />
          <Code lang="jsonc" code={FOLDER} file="una carpeta" />
          <List
            items={[
              <>
                <C>id</C> y <C>parent</C> también son columnas, para el índice de lo que hay en una carpeta; el resto solo está en el JSON.
              </>,
              <>La clave de una versión es el id de su archivo y el suyo, nunca una ruta: renombrar y mover nunca tocan el bucket.</>,
              <>
                Lo que hay dentro de una carpeta en la papelera está en la papelera a través de ella: solo la carpeta tiene <C>trashed</C>. Con las comparticiones pasa lo mismo: lo que hay dentro de
                una carpeta compartida se comparte a través de ella.
              </>,
              <>
                La contraseña de un enlace no está aquí: <C>locked: true</C> dice que tiene una, y la guardan los ajustes.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: 'the-fields-of-a-file',
      title: 'Los campos de un archivo',
      badge: 'Metadatos',
      color: 'yellow',
      lead: 'Los metadatos de cada archivo y carpeta son la columna entry de rebofiles_entries: no hay otra tabla de archivos. Todos sus campos:',
      body: (
        <>
          <Table label="Campos de una entrada" columns={['Campo', 'Tipo', 'Qué es']} code={[0]} rows={ENTRY_FIELDS.map(([field, type, what]) => [field, <C key={field}>{type}</C>, what])} />
          <P>Y de cada una de sus versiones:</P>
          <Table label="Campos de una versión" columns={['Campo', 'Tipo', 'Qué es']} code={[0]} rows={VERSION_FIELDS.map(([field, type, what]) => [field, <C key={field}>{type}</C>, what])} />
          <Callout title="Aún no se guarda:">
            el ancho y el alto de la imagen original (solo los de sus copias reducidas), lo que una cámara escribe en una foto (EXIF), la duración de un vídeo o una canción, y las páginas de un
            documento. Una tabla propia al lado puede guardarlos, por el id del archivo.
          </Callout>
        </>
      ),
    },
    {
      id: 'settings',
      title: 'Ajustes, por nombre',
      badge: 'settings',
      color: 'orange',
      body: (
        <Table
          label="Ajustes guardados"
          columns={['Nombre', 'Valor']}
          code={[0]}
          rows={[
            [
              'drive',
              '{ language, theme, brand, images: { enabled, sizes, format, quality }, quota, trashDays, company, requestTemplates }: los del drive, tal como los guardó quien puede configurarlo.',
            ],
            ['person:<id>', '{ language, theme }: los propios de una persona, por encima de los del drive.'],
            ['link:<link id>', '"salt:hash": la contraseña de un enlace, tal como la hace scrypt (32 bytes, una sal de 16), nunca la contraseña.'],
            ['seen-shared:<id>', 'Cuándo miró la persona Compartido conmigo por última vez, en ISO 8601: lo más reciente es nuevo.'],
          ]}
        />
      ),
    },
    {
      id: 'activity',
      title: 'Una línea de actividad',
      badge: 'activity',
      color: 'pink',
      lead: 'La columna line; entry, parent y origin van al lado, para encontrar las líneas de un archivo y de lo que hay en una carpeta.',
      body: <Code lang="jsonc" code={LINE} />,
    },
    {
      id: 'why-so',
      title: 'Por qué está organizado así',
      badge: 'Diseño',
      color: 'blue',
      body: (
        <List
          items={[
            <>
              <strong>Una fila, una entrada.</strong> El drive se lee entero una vez y se guarda en memoria, y solo se vuelve a leer cuando la revisión dice que cambió, así que a la base de datos se
              le pregunta por id, nunca con joins: un listado de 20 000 entradas tarda menos de un milisegundo.
            </>,
            <>
              <strong>Solo se escribe lo que cambió.</strong> Renombrar escribe una fila; mover una carpeta escribe la carpeta, no lo que contiene, porque sus hijos la nombran por id.
            </>,
            <>
              <strong>Todo o nada.</strong> En Postgres un cambio es una sola sentencia: las filas quitadas, las puestas y la revisión, juntas. Con un pool, cada cambio también mantiene{' '}
              <C>pg_advisory_xact_lock</C>, así que dos servidores nunca cambian el drive a la vez.
            </>,
            <>
              <strong>Sin claves foráneas.</strong> El modelo comprueba el árbol (una carpeta nunca dentro de sí misma, un nombre nunca dos veces en una carpeta) antes de escribir nada; la base de
              datos solo lo guarda.
            </>,
            <>
              <strong>Suficiente para un equipo y mucho más;</strong> no para millones de entradas, que necesitarían preguntar al almacén por carpeta.
            </>,
          ]}
        />
      ),
    },
    {
      id: 'with-prisma',
      title: 'Con Prisma ORM',
      badge: 'Prisma',
      color: 'yellow',
      lead: 'Para una aplicación que lleva sus propias tablas con Prisma 7: las del drive, como modelos de su schema.prisma, para leerlas con Prisma y que sus migraciones no las toquen.',
      body: (
        <>
          <Code lang="prisma" code={PRISMA} file="prisma/schema.prisma" />
          <List
            items={[
              <>
                <C>@@map</C> conserva los nombres propios de las tablas; con <C>postgresMetadata(pool, &#123; table: 'acme_files' &#125;)</C>, mapea a esos en su lugar.
              </>,
              <>
                <C>words</C> es un <C>tsvector</C>, que Prisma lee como <C>Unsupported</C>: el modelo del texto se lee en SQL, y solo lo escribe el drive.
              </>,
              <>
                <C>prisma db pull</C> avisa del <C>CHECK (id = 1)</C> de la revisión: sigue en la tabla, solo que Prisma no lo modela.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: 'one-pool',
      title: 'Un solo pool para Prisma y el drive',
      badge: 'Prisma',
      color: 'green',
      lead: 'Prisma 7 habla con Postgres a través de @prisma/adapter-pg, que recibe un pg.Pool: dale el mismo a postgresMetadata.',
      body: <Code code={ONE_POOL} />,
    },
    {
      id: 'migrations-with-prisma',
      title: 'Migraciones con Prisma',
      badge: 'Prisma',
      color: 'purple',
      lead: 'Prisma Migrate toma las tablas que no conoce por drift, y ofrece reiniciar la base de datos, borrándolo todo: pon las tablas del drive en el esquema, y márcalas como creadas.',
      body: (
        <>
          <Code lang="bash" code={BASELINE} />
          <Code lang="bash" code={FRESH} />
          <Callout title="Funciona en cualquier orden.">
            ReboFiles crea sus tablas con <C>IF NOT EXISTS</C> y su única fila de la revisión con <C>ON CONFLICT DO NOTHING</C>: las tablas que Prisma creó antes se toman tal como están.
          </Callout>
        </>
      ),
    },
    {
      id: 'queries-with-prisma',
      title: 'Consultas con Prisma',
      badge: 'Prisma',
      color: 'pink',
      lead: 'Lee el drive con el cliente de Prisma y rutas JSON, y en SQL para lo que no pueden expresar. Cámbialo a través de las rutas del drive, para que la revisión suba y el árbol siga entero.',
      body: <Code code={PRISMA_QUERIES} />,
    },
    {
      id: 'queries-of-your-own',
      title: 'Consultas propias',
      badge: 'SQL',
      color: 'green',
      lead: 'Para un informe, una exportación o un job: léelo como quieras. Cámbialo a través del servidor o de @rebofiles/core, para que la revisión suba y el árbol siga entero.',
      body: (
        <>
          <Code lang="sql" code={QUERIES} />
          <Callout title="Escribir en las tablas a mano">
            no lo ve un proceso que tiene el drive en memoria hasta que sube la revisión: súbela en la misma transacción, o cambia el drive a través de las rutas.
          </Callout>
        </>
      ),
    },
    {
      id: 'making-it-yourself',
      title: 'Crearlas tú mismo',
      badge: 'Migraciones',
      color: 'yellow',
      body: (
        <List
          items={[
            <>
              El usuario con el que se conecta el servidor necesita crear tablas la primera vez, y leerlas y escribirlas después. Para crearlas tú, con tus propias migraciones, ejecuta antes el DDL de
              arriba: <C>IF NOT EXISTS</C> las deja como están.
            </>,
            <>
              <C>postgresMetadata(pool, &#123; table: 'acme_files' &#125;)</C> las llama <C>acme_files</C>, <C>acme_files_settings</C>… junto a las tablas propias de tu aplicación, en su esquema.
            </>,
            <>Una nueva versión de ReboFiles que necesite una tabla o una columna más la crea igual, en su primer arranque.</>,
          ]}
        />
      ),
    },
    {
      id: 'a-store-of-your-own',
      title: 'Un almacén propio',
      badge: 'MetadataStore',
      color: 'purple',
      lead: 'Otra base de datos, o tablas propias organizadas de otra forma: dos métodos, y el resto opcional.',
      body: (
        <>
          <Code code={STORE} />
          <P>
            <C>save</C> recibe las entradas puestas y los ids quitados en cada cambio, de <C>changes(before, after)</C> de core. <a href={to('metadata')}>Metadatos</a> explica para qué sirve cada
            almacén.
          </P>
        </>
      ),
    },
  ],
};
