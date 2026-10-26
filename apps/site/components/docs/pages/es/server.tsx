// El servidor: la ruta, quién puede hacer qué, dónde están los bytes y las
// entradas, compartir, la actividad y páginas de otros orígenes. Los mensajes
// de error se dejan en inglés, como los dice el servidor.

import { docHref } from '@/lib/site';
import { referenceIn } from '../../referenceI18n';
import { C, Callout, Code, type DocPage, List, P, RefTable, Table, Trouble, withCode } from '../../ui';
import { AUTHORIZE, CORS, ENV, NODE, ON_SHARE, ORIGINS, POSTGRES, ROUTE, SHARE, optionId } from '../server';

const to = (slug: string) => docHref('es', slug);
const SOURCE = 'apps/site/components/docs/pages/es/server.tsx';
const { SERVER_OPTIONS } = referenceIn('es');
const ACTIVITY_CODE = `import { activityOf } from '@rebofiles/core';\n\nactivityOf(before, after, 'ana', new Date().toISOString());\n// [{ action: 'renamed', name: 'final.docx', was: 'draft.docx', by: 'ana', at, entry, parent }]`;

export const server: DocPage = {
  title: 'La ruta',
  description: 'createDriveHandler: una sola ruta para todo el drive, en Next.js, Bun, Deno, un Worker o node:http, y todas las opciones que acepta.',
  source: SOURCE,
  lead: (
    <>
      <C>createDriveHandler</C> recibe un Request y devuelve un Response. Todas las rutas del drive viven bajo una misma ruta, y ninguna transporta los bytes salvo en un disco: al navegador se le dan
      direcciones a las que enviarlos y desde las que leerlos.
    </>
  ),
  sections: [
    { id: 'in-nextjs', title: 'En Next.js', badge: 'Next.js', color: 'blue', body: <Code code={ROUTE} file="app/api/files/[...path]/route.ts" /> },
    {
      id: 'on-node-http',
      title: 'Sobre node:http',
      badge: 'Node',
      color: 'green',
      lead: 'nodeHandler lo convierte en un listener, para node:http, Express y lo que esté construido encima.',
      body: <Code code={NODE} file="server.ts" />,
    },
    {
      id: 'options',
      title: 'Todas las opciones',
      badge: 'Opciones',
      color: 'yellow',
      body: (
        <RefTable
          label="Opciones de createDriveHandler"
          name="Opción"
          rows={SERVER_OPTIONS.map((option) => ({ id: optionId(option.name), name: option.name, type: option.type, does: withCode(option.does) }))}
        />
      ),
    },
    {
      id: 'held-in-memory',
      title: 'Guardado en memoria',
      badge: 'Velocidad',
      color: 'purple',
      body: (
        <P>
          El drive se lee una vez y se guarda, y solo se vuelve a leer cuando el almacén dice que cambió, por este proceso o por otro: un listado de 20 000 entradas pasó de 36 ms a menos de 1.
          Suficiente para un equipo y mucho más; no para millones de entradas.
        </P>
      ),
    },
    {
      id: 'every-route',
      title: 'Todas las rutas',
      badge: 'API',
      color: 'pink',
      body: (
        <P>
          <a href={to('routes')}>Rutas HTTP</a> las enumera, tal como las guarda el código.
        </P>
      ),
    },
  ],
};

const ACTIONS: [string, string][] = [
  ['list', 'Lo que hay en una carpeta; null para arriba del todo. Después se pregunta read por cada entrada.'],
  ['read', 'Una entrada, una búsqueda, Recientes, la papelera, su actividad: lo que una persona puede ver.'],
  ['create', 'Una carpeta, con la carpeta en la que va.'],
  ['upload', 'Un archivo, con la carpeta en la que va; una nueva versión, sus imágenes reducidas, su texto, con el archivo. Se vuelve a preguntar al terminar.'],
  ['rename', 'La entrada renombrada, o una carpeta a la que se le da un color.'],
  ['move', 'La entrada, y después la carpeta a la que va.'],
  ['trash, restore', 'A la papelera, y fuera de ella.'],
  ['delete', 'Eliminado para siempre: los bytes salen del bucket.'],
  ['download', 'Una dirección para leer el archivo, durante unos minutos.'],
  ['comment', 'Aún no se pregunta por nada: lo que un comentarista puede hacer además de un lector.'],
  ['share', 'Compartirlo, retirarlo, y sus enlaces.'],
  ['configure', 'Los ajustes de todo el drive. Con byRoles, un usuario que identify da como { id, admin: true }.'],
];

export const authorize: DocPage = {
  title: 'Quién puede hacer qué',
  description: 'identify y authorize, las acciones por las que se pregunta, byRoles y reglas propias alrededor.',
  source: SOURCE,
  lead: (
    <>
      ReboFiles no tiene usuarios propios. <C>identify</C> dice quién pregunta, a partir de tu sesión; <C>authorize</C> se consulta en cada ruta, con la entrada de la que se trata.
    </>
  ),
  sections: [
    {
      id: 'identify',
      title: 'identify',
      badge: 'Quién',
      color: 'blue',
      body: (
        <P>
          Con el Request, devuelve <C>&#123; id &#125;</C> para alguien con sesión, o null, que se responde con 401. El id es como el drive lo nombra: propietarios, comparticiones, actividad.{' '}
          <C>admin: true</C> puede configurar el drive con <C>byRoles</C>.
        </P>
      ),
    },
    {
      id: 'the-actions',
      title: 'Las acciones',
      badge: 'Qué',
      color: 'yellow',
      body: <Table label="Acciones" columns={['Acción', 'Se pregunta para']} rows={ACTIONS.map(([action, what]) => [action, what])} />,
    },
    {
      id: 'byroles',
      title: 'byRoles',
      badge: 'Roles',
      color: 'green',
      body: (
        <P>
          Según el propio drive: el propietario puede hacerlo todo con una entrada y con lo que tiene dentro; aquellos con quienes se comparte, lo que permita su rol. Un lector mira, lee y descarga;
          un editor además crea, sube, renombra, mueve y manda a la papelera; solo el propietario borra para siempre y comparte. Cualquiera con sesión puede mirar arriba del todo y poner cosas ahí; a
          cada uno le muestra lo suyo.
        </P>
      ),
    },
    {
      id: 'rules-of-your-own',
      title: 'Reglas propias',
      badge: 'Tuyas',
      color: 'purple',
      lead: 'Llama a byRoles desde las tuyas. El cuarto argumento es el drive entero, para reglas que miran las carpetas en las que está una entrada.',
      body: <Code code={AUTHORIZE} file="lib/auth.ts" />,
    },
    {
      id: 'when-it-says-no',
      title: 'Cuando dice que no',
      badge: 'Errores',
      color: 'pink',
      body: (
        <Trouble says="Sign in first. · You may not do that here.">
          401 es <C>identify</C> devolviendo null; 403 es <C>authorize</C> devolviendo false.
        </Trouble>
      ),
    },
  ],
};

export const storage: DocPage = {
  title: 'Almacenamiento: S3 y disco',
  description: 'Los bytes en cualquier bucket que hable S3, sin SDK, o en una carpeta del disco: las claves, la regla de orígenes y lo que puede fallar.',
  source: SOURCE,
  lead: (
    <>
      Los bytes van del navegador directo al bucket y de vuelta, a direcciones que el servidor firma durante unos minutos. Eso le pide dos cosas al bucket: una clave con la que firmar, y una regla que
      deje entrar a tus páginas.
    </>
  ),
  sections: [
    {
      id: 'the-key',
      title: 'La clave',
      badge: 'S3',
      color: 'blue',
      lead: 'En Cloudflare R2: R2 → Create bucket, luego Manage API tokens → Create API token con “Object Read & Write” solo para ese bucket.',
      body: (
        <>
          <Code lang="bash" code={ENV} file=".env" />
          <P>
            <C>s3Storage(s3OptionsFrom(process.env))</C> las lee. En AWS, omite <C>S3_ENDPOINT</C> y da la región; MinIO y Backblaze usan las mismas variables.
          </P>
        </>
      ),
    },
    {
      id: 'the-rule-of-origins',
      title: 'La regla de orígenes',
      badge: 'CORS',
      color: 'yellow',
      lead: 'En Settings → CORS policy, con las direcciones desde las que se sirve tu aplicación. ETag tiene que estar expuesto.',
      body: (
        <>
          <Code lang="json" code={CORS} file="CORS policy" />
          <P>Una regla de ciclo de vida que aborta las subidas multiparte sin terminar tras un día evita que las partes de una subida nunca terminada se queden en el bucket.</P>
        </>
      ),
    },
    {
      id: 'on-the-disk',
      title: 'En el disco',
      badge: 'Disco',
      color: 'green',
      body: (
        <P>
          <C>diskStorage(&#123; folder, secret &#125;)</C> guarda los bytes en una carpeta, y el propio servidor los transporta, a direcciones suyas: para una sola máquina, una demo o un test.
        </P>
      ),
    },
    {
      id: 'when-something-fails',
      title: 'Cuando algo falla',
      badge: 'Errores',
      color: 'pink',
      body: (
        <>
          <Trouble says="S3_ENDPOINT is the public address of the bucket (r2.dev)">
            La API S3 de R2 está en <C>https://&lt;account-id&gt;.r2.cloudflarestorage.com</C>, en la página de ajustes del bucket.
          </Trouble>
          <Trouble says="The part could not be sent. If the bytes go to a bucket, check that it lets this origin in.">
            La regla de orígenes: falta la dirección de la página en <C>AllowedOrigins</C>, o <C>content-type</C> en <C>AllowedHeaders</C>.
          </Trouble>
          <Trouble says="The bucket did not let the page read the ETag of a part.">
            Los archivos pequeños suben y los grandes no: <C>ExposeHeaders</C> necesita <C>ETag</C>.
          </Trouble>
          <Trouble says="The bucket answered 403 to …">La clave: no puede escribir en ese bucket, o el endpoint, la región o el nombre del bucket no son para los que se hizo.</Trouble>
          <Trouble says="There is no room for it: … are used, and it is ….">
            La cuota de la persona (<C>413 over-quota</C>): más espacio en los ajustes del drive, o menos en sus archivos y su papelera.
          </Trouble>
          <P>
            En el repositorio, <C>npm run storage:check</C> hace todo el recorrido de un archivo contra el bucket de <C>apps/storage/.env</C> y dice qué respondió el bucket en el paso que falló.
          </P>
        </>
      ),
    },
  ],
};

export const metadata: DocPage = {
  title: 'Metadatos: SQLite y Postgres',
  description: 'Dónde están las entradas: en memoria, en SQLite con node:sqlite, o en Postgres con tu driver; qué guarda cada uno, y varios procesos.',
  source: SOURCE,
  lead: <>Un bucket no tiene carpetas, propietarios, permisos ni papelera. Eso va en un almacén de metadatos aparte, que escribe solo lo que cambió, un cambio a la vez.</>,
  sections: [
    {
      id: 'the-stores',
      title: 'Los almacenes',
      badge: 'Elige',
      color: 'blue',
      body: (
        <Table
          label="Almacenes"
          columns={['Almacén', 'Para']}
          rows={[
            ['memoryMetadata()', 'Tests y demos: desaparece al terminar el proceso.'],
            ['sqliteMetadata(path)', 'Una aplicación en un solo servidor: un archivo, con el propio node:sqlite de Node.'],
            ['postgresMetadata(pool)', 'Más de un servidor, o un alojamiento sin disco: tu driver, y un bloqueo de la base de datos por cada cambio.'],
          ]}
        />
      ),
    },
    {
      id: 'on-postgres',
      title: 'En Postgres',
      badge: 'Postgres',
      color: 'green',
      body: (
        <>
          <Code code={POSTGRES} />
          <P>
            Acepta cualquier cosa con <C>query(text, values)</C> que responda <C>&#123; rows &#125;</C>: <C>pg</C>, el Pool de Neon, PGlite. Con un pool, cada cambio mantiene un bloqueo de la base de
            datos mientras lee y escribe, así que dos servidores nunca cambian el drive a la vez; sin él, dos carpetas creadas en el mismo momento podrían ser ambas “(2)”.{' '}
            <C>&#123; table: 'acme_files' &#125;</C> para una tabla con otro nombre.
          </P>
        </>
      ),
    },
    {
      id: 'what-is-kept',
      title: 'Qué se guarda',
      badge: 'Tablas',
      color: 'yellow',
      body: (
        <List
          items={[
            'Las entradas, una fila cada una, como JSON.',
            'Los ajustes del drive y de cada persona, y las contraseñas de los enlaces tal como las hace scrypt.',
            'La actividad, una fila por línea, encontrada por la entrada y las carpetas de las que trata.',
            'El texto de cada archivo: la búsqueda de texto completo de SQLite, o un tsvector en Postgres.',
            'Una revisión que sube con cada cambio, para que cada proceso sepa cuándo volver a leer el drive.',
          ]}
        />
      ),
    },
    {
      id: 'a-store-of-your-own',
      title: 'Un almacén propio',
      badge: 'Tuyo',
      color: 'purple',
      body: (
        <P>
          <C>MetadataStore</C> es <C>load()</C> y <C>save(changes)</C>; <C>revision</C>, <C>lock</C>, los ajustes, <C>record</C>/<C>activity</C> y <C>keepText</C>/<C>findText</C> son opcionales, y sin
          ellos el servidor guarda eso en el proceso. <a href={to('schema')}>Esquema de la base de datos</a> tiene todas las tablas.
        </P>
      ),
    },
  ],
};

export const sharing: DocPage = {
  title: 'Compartir y enlaces',
  description: 'Roles hacia abajo en el árbol, Compartido conmigo y lo nuevo en él, un drive para todo un equipo, y enlaces que caducan, con contraseña o de una descarga.',
  source: SOURCE,
  lead: <>Compartir, en los detalles de una entrada, se la da a alguien por el id que le da tu identify, o a todos los que tienen sesión; lo que hay en una carpeta va con ella.</>,
  sections: [
    {
      id: 'roles',
      title: 'Roles',
      badge: 'Personas',
      color: 'blue',
      body: (
        <P>
          Lector, comentarista o editor, en una entrada y lo que tiene dentro. Aparece en su <strong>Compartido conmigo</strong>, no en sus Mis archivos, que son solo suyos; al lado, cuántos son
          nuevos desde la última vez que miró. Para un solo drive de todo un equipo, dale al servidor <C>top: 'everyone'</C>.
        </P>
      ),
    },
    {
      id: 'links',
      title: 'Enlaces',
      badge: 'Enlaces',
      color: 'green',
      lead: 'Cualquiera que tenga uno puede mirar y descargar, sin iniciar sesión, durante un día, una semana o un mes, o hasta que se quite.',
      body: (
        <>
          <List
            items={[
              <>
                <strong>Con contraseña</strong>: se pide antes de mostrar nada, se envía como <C>x-link-password</C> en cada petición, se guarda solo como la hace scrypt, y tras cada intento fallido
                se espera un momento.
              </>,
              <>
                <strong>De una descarga</strong>: se gasta al descargar un archivo o un .zip de él, no al mirar; sigue funcionando un cuarto de hora después, para los archivos de esa descarga.
              </>,
            ]}
          />
          <Code lang="tsx" code={SHARE} />
        </>
      ),
    },
    {
      id: 'when-a-link-fails',
      title: 'Cuando un enlace falla',
      badge: 'Errores',
      color: 'pink',
      body: (
        <>
          <Trouble says="This link does not work any more.">
            Se quitó, caducó, se usó, lo que leía fue a la papelera, o su dirección cambió por el camino: cuál de ellas, un enlace no se lo dice a quien lo tiene.
          </Trouble>
          <Trouble says="This link asks for its password. · That is not the password.">La página del enlace la pide primero, y la envía en cada petición.</Trouble>
        </>
      ),
    },
    {
      id: 'telling-people',
      title: 'Avisar a la gente',
      badge: 'Avisos',
      color: 'yellow',
      body: (
        <P>
          <a href={to('activity')}>Actividad y notificaciones</a>: <C>onShare</C> se llama con cada compartición, para enviar un correo o un aviso de tu aplicación.
        </P>
      ),
    },
  ],
};

export const activity: DocPage = {
  title: 'Actividad y notificaciones',
  description: 'Quién hizo qué en cada archivo y carpeta, guardado con cada cambio, y avisar a la gente de lo que se compartió con ella.',
  source: SOURCE,
  lead: (
    <>
      Cada cambio se guarda como actividad, lo haga quien lo haga: una ruta, un asistente, la papelera vaciándose sola. Se deduce del drive antes y después del cambio, así que no se queda nada fuera.
    </>
  ),
  sections: [
    {
      id: 'what-is-kept',
      title: 'Qué se guarda',
      badge: 'Actividad',
      color: 'blue',
      body: (
        <>
          <P>Creado, subido, una nueva versión, renombrado, movido, enviado a la papelera y de vuelta, borrado, compartido y ya no, un enlace creado y retirado, un color dado; quién, y cuándo.</P>
          <P>
            Los detalles de un archivo tienen su <strong>Actividad</strong>, y los de una carpeta también lo que se hizo justo dentro (<C>GET /entries/:id/activity</C>, <C>client.activity</C>); un
            asistente la lee con <C>get_activity</C>.
          </P>
        </>
      ),
    },
    { id: 'in-code', title: 'En código', badge: 'Core', color: 'green', body: <Code code={ACTIVITY_CODE} /> },
    {
      id: 'telling-people',
      title: 'Avisar a la gente',
      badge: 'onShare',
      color: 'yellow',
      lead: 'Junto a Compartido conmigo, el drive cuenta lo nuevo. Para avisar tú a la persona, dale onShare al servidor.',
      body: <Code code={ON_SHARE} />,
    },
    {
      id: 'know',
      title: 'Qué saber',
      badge: 'A saber',
      color: 'pink',
      body: <Callout title="Un cambio se guarda sin su línea">si el almacén no consigue escribir la actividad: el cambio es el drive, la línea va aparte.</Callout>,
    },
  ],
};

export const desktop: DocPage = {
  title: 'Escritorio y otros orígenes',
  description: 'La aplicación de escritorio del repositorio, con Tauri, y cómo dejarla entrar, o a una página de otro dominio, con cors en el servidor y en el bucket.',
  source: SOURCE,
  lead: <>El drive en su propia ventana, primero en un Mac, contra tu servidor; o en una página servida desde otro dominio. Ambos son otro origen, al que se deja entrar por su nombre.</>,
  sections: [
    {
      id: 'the-application',
      title: 'La aplicación',
      badge: 'Tauri',
      color: 'purple',
      body: (
        <List
          items={[
            'La primera vez pide la dirección de las rutas del servidor y, cuando el servidor lo pide, un token, enviado como Authorization: Bearer; se guarda, y se reintenta en cada inicio.',
            'Server → Change Server… (⇧⌘K) pide otro.',
            'Lo que descarga va a Descargas, con un nombre ocupado liberado: “informe (2).pdf”.',
            <>
              <C>npm run desktop</C> la abre contra el playground; <C>npm run build:desktop</C> genera ReboFiles.app.
            </>,
          ]}
        />
      ),
    },
    {
      id: 'let-it-in',
      title: 'Déjala entrar',
      badge: 'cors',
      color: 'yellow',
      lead: 'Primero se responde a la pregunta del navegador, y el ETag de una parte queda legible. Solo los orígenes de la lista.',
      body: <Code code={ORIGINS} />,
    },
    {
      id: 'and-the-bucket',
      title: 'Y el bucket',
      badge: 'Bucket',
      color: 'blue',
      body: <P>Los bytes van de la ventana directo al bucket: pon los mismos orígenes en su regla de orígenes.</P>,
    },
    {
      id: 'not-yet',
      title: 'Todavía no',
      badge: 'Siguiente',
      color: 'pink',
      body: (
        <List
          items={[
            'Mantener una carpeta del disco como una carpeta del drive: el motor de sincronización, @rebofiles/desktop, es lo siguiente.',
            'Iniciar sesión mediante la página del servidor, para un servidor cuya sesión es solo una cookie.',
            'Windows y Linux: se construyen igual, sin probar. Firmada y notarizada: todavía no.',
          ]}
        />
      ),
    },
  ],
};
