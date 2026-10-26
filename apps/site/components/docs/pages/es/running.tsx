// El servidor en una aplicación y en producción, en español: cada framework y
// el inicio de sesión, las subidas revisadas antes de guardarlas, los cambios
// en vivo, una carpeta sincronizada, y lo que hay que fijar antes de abrirlo.
// El código es el de la página en inglés, leído de examples/.

import { docHref } from '@/lib/site';
import { C, Callout, Code, type DocPage, List, P, Table, Trouble } from '../../ui';
import { AUTHJS, BEFORE_UPLOAD, CLAMD, CLERK, DRIVE, EXPRESS, FASTIFY, HONO, INSPECT, JWT, LIFECYCLE, NEXT_ROUTE, NGINX, OWN_INSPECT, SYNC_CLI, SYNC_CODE, WATCH } from '../running';

const hrefOf = (slug: string) => docHref('es', slug);

export const frameworks: DocPage = {
  title: 'Frameworks e inicio de sesión',
  description: 'El drive en Next.js, Express, Hono y Fastify, y quién pregunta desde Auth.js, Clerk o un token propio: código que ejecutan los tests.',
  source: 'examples/',
  lead: (
    <>
      <C>createDriveHandler</C> recibe un Request y da un Response, así que cada framework necesita unas pocas líneas: pasarle la petición tal como llegó, antes de que nada lea su cuerpo. Cada ejemplo
      aquí es un archivo de <C>examples/</C>, servido en un puerto y consultado por HTTP en sus tests: una carpeta creada, un archivo de dos partes subido y leído de vuelta, y un cambio avisado en el
      momento.
    </>
  ),
  sections: [
    {
      id: 'one-drive',
      title: 'Un drive para todos',
      badge: 'Base',
      color: 'purple',
      lead: 'Los bytes en un bucket cuando S3_BUCKET lo indica, si no en el disco; las entradas en SQLite. Igual en cada ejemplo.',
      body: <Code code={DRIVE()} file="examples/drive.ts" />,
    },
    {
      id: 'nextjs',
      title: 'Next.js',
      badge: 'App Router',
      color: 'blue',
      lead: 'Un route handler para todas las rutas, en Node: firma con node:crypto.',
      body: <Code code={NEXT_ROUTE()} file="app/api/files/[...path]/route.ts" />,
    },
    {
      id: 'express',
      title: 'Express',
      badge: 'Node',
      color: 'green',
      lead: 'Montado antes de express.json(): el drive lee sus propios cuerpos.',
      body: <Code code={EXPRESS()} file="examples/express/server.ts" />,
    },
    { id: 'hono', title: 'Hono', badge: 'Node · Bun · Deno', color: 'yellow', lead: 'La petición de Hono es la que recibe el drive.', body: <Code code={HONO()} file="examples/hono/server.ts" /> },
    {
      id: 'fastify',
      title: 'Fastify',
      badge: 'Node',
      color: 'orange',
      lead: 'En un plugin propio, donde ningún parser de Fastify lee el cuerpo, y la respuesta escrita en la respuesta cruda.',
      body: <Code code={FASTIFY()} file="examples/fastify/server.ts" />,
    },
    {
      id: 'auth-js',
      title: 'Quién pregunta, con Auth.js',
      badge: 'Sesión',
      color: 'pink',
      body: (
        <>
          <Code code={AUTHJS()} file="examples/auth/authjs.ts" />
          <P>
            Pásalo como <C>identify</C>. La página envía la cookie de sesión con cada petición a su propio origen, así que en el navegador no hace falta nada más.
          </P>
        </>
      ),
    },
    { id: 'clerk', title: 'Quién pregunta, con Clerk', badge: 'Sesión', color: 'pink', body: <Code code={CLERK()} file="examples/auth/clerk.ts" /> },
    {
      id: 'your-own-token',
      title: 'Un token propio',
      badge: 'JWT',
      color: 'pink',
      lead: 'Para una aplicación con su propio inicio de sesión, y para la aplicación de escritorio, que envía `Authorization: Bearer`.',
      body: (
        <>
          <Code code={JWT()} file="examples/auth/jwt.ts" />
          <Callout title="Probado, y no:">
            el token propio lo comprueban los tests, y uno falsificado se rechaza. Auth.js y Clerk están escritos según su documentación y no se ejecutan aquí, porque necesitan cuentas suyas.
          </Callout>
        </>
      ),
    },
    {
      id: 'when-something-fails',
      title: 'Cuando algo falla',
      badge: 'Errores',
      color: 'pink',
      body: (
        <>
          <Trouble says="The body is not JSON.">Un parser del framework leyó el cuerpo primero: monta el drive antes, o fuera de su alcance, como hacen los ejemplos.</Trouble>
          <Trouble says="No GET /api/files/…">
            La ruta que dio el framework no es la completa. <C>nodeHandler</C> toma <C>originalUrl</C> cuando lo hay (Express); si no, móntalo donde dice <C>base</C>.
          </Trouble>
          <Trouble says="Sign in first.">
            <C>identify</C> no encontró a nadie: no llegó la cookie (otro origen necesita <C>cors</C> y un token), o la sesión no tiene id.
          </Trouble>
        </>
      ),
    },
  ],
};

export const checkingUploads: DocPage = {
  title: 'Revisar las subidas',
  description: 'Rechaza un archivo antes de que suba, por nombre, tipo y tamaño; y cuando llegan sus bytes, por lo que de verdad son, o por lo que ClamAV encuentra en ellos.',
  source: 'packages/server/src/inspect.ts',
  lead: (
    <>
      Los bytes van del navegador al bucket sin pasar por el servidor, y el servidor solo lista un archivo cuando ya están ahí. Así que hay dos momentos para decir que no: antes de darle direcciones (
      <C>beforeUpload</C>), y cuando llegaron sus bytes y antes de que nadie lo vea (<C>inspect</C>). Lo rechazado en el segundo se quita del bucket.
    </>
  ),
  sections: [
    {
      id: 'before',
      title: 'Antes de que suba',
      badge: 'beforeUpload',
      color: 'blue',
      lead: 'Con lo que la página dice de él: nombre, tipo, tamaño y adónde va. Aún no se ha enviado nada.',
      body: (
        <>
          <Code code={BEFORE_UPLOAD} />
          <P>
            Un <C>Refused</C> se responde con su estado, código y mensaje; <C>false</C> es un 403. Se pregunta por cada archivo nuevo y cada versión nueva, no por las imágenes pequeñas que hace la
            página. El tipo y el tamaño son los que dice la página: para lo que de verdad son, <C>inspect</C>.
          </P>
        </>
      ),
    },
    {
      id: 'after',
      title: 'Cuando llegaron sus bytes',
      badge: 'inspect',
      color: 'yellow',
      lead: 'Se pregunta antes de guardar el archivo o la versión, con una lectura de los bytes del almacenamiento. Los dos almacenamientos del servidor pueden leer.',
      body: (
        <>
          <Code code={INSPECT} />
          <List
            items={[
              <>
                <C>checkType()</C> lee los primeros 4 KB. Rechaza un programa (un .exe, un binario de Linux o de Mac) salvo con <C>programs: true</C>, y un archivo cuyos bytes no son los de su
                extensión: un PNG que no lo es, un .docx que no es un zip. <C>only</C> limita a algunos tipos.
              </>,
              <>
                <C>clamav()</C> envía los bytes a clamd, un megabyte cada vez, con su comando INSTREAM. Un archivo mayor de lo que acepta clamd (25 MB si no se dice) se rechaza, no se deja pasar sin
                revisar.
              </>,
              <>
                <C>inspectAll(…)</C> pregunta a varios en orden: el primero que rechaza, rechaza.
              </>,
            ]}
          />
          <Callout title="Un archivo sin revisar no entra.">
            Cuando <C>inspect</C> lanza algo que no es un <C>Refused</C> (clamd caído, un tiempo agotado), la subida se rechaza con un 503 y se quitan sus bytes. La página lo dice, y la persona lo
            vuelve a subir.
          </Callout>
        </>
      ),
    },
    { id: 'clamav', title: 'ClamAV en el servidor', badge: 'Virus', color: 'pink', body: <Code lang="bash" code={CLAMD} /> },
    {
      id: 'your-own',
      title: 'Un inspect propio',
      badge: 'Tuyo',
      color: 'purple',
      lead: 'Cualquier función: un escáner de tu proveedor, una regla propia sobre lo que se puede guardar.',
      body: <Code code={OWN_INSPECT} />,
    },
    {
      id: 'what-people-read',
      title: 'Lo que lee la gente',
      badge: 'Errores',
      color: 'green',
      body: (
        <>
          <Table
            label="Rechazos de una subida"
            columns={['Código', 'Estado', 'Cuándo']}
            rows={[
              ['upload-refused', '403', 'beforeUpload devolvió false'],
              ['program-refused', '422', 'checkType: un programa'],
              ['type-mismatch', '422', 'checkType: los bytes no son los de la extensión'],
              ['type-refused', '422', 'checkType: un tipo fuera de only'],
              ['virus-found', '422', 'clamav: un virus, nombrado en el mensaje'],
              ['refused-content', '422', 'inspect devolvió false'],
              ['not-scanned · not-inspected', '503', 'clamav, o inspect, no pudo revisarlo'],
            ]}
          />
          <P>El drive dice cada uno en el idioma de la persona, por su código.</P>
        </>
      ),
    },
  ],
};

export const live: DocPage = {
  title: 'Cambios en vivo y carpetas grandes',
  description: 'Lo que cambian otros, mostrado en el momento con server-sent events, sin recargar; y carpetas de miles, de las que solo está en la página lo que se ve.',
  source: 'packages/server/src/api.ts',
  lead: (
    <>
      Dos personas con la misma carpeta abierta ven los cambios de la otra en un momento: una carpeta creada, un archivo renombrado, movido o a la papelera. Y una carpeta de miles de archivos se
      desplaza como una de diez.
    </>
  ),
  sections: [
    {
      id: 'as-it-happens',
      title: 'En el momento',
      badge: 'Eventos',
      color: 'blue',
      body: (
        <>
          <P>
            La página escucha <C>GET /events</C>, un flujo de server-sent events, leído con <C>fetch</C> para que lleve tus <C>headers</C>. Cada cambio se le cuenta a cada quien solo hasta donde puede
            verlo: las carpetas donde pasó que puede listar, y las entradas que puede leer. No se envían nombres; la página pide lo que muestra, como siempre.
          </P>
          <P>
            <C>&lt;FileDrive&gt;</C>, <C>mountDrive</C> y cada hook bajo un <C>DriveProvider</C> vuelven a pedir un cuarto de segundo después de un cambio, una vez para los cambios que llegan juntos.
            Tras un corte se conecta de nuevo, un poco más tarde cada vez. <C>live=&#123;false&#125;</C> lo apaga.
          </P>
          <Code code={WATCH} file="una pantalla propia" />
        </>
      ),
    },
    {
      id: 'more-processes',
      title: 'Más de un proceso',
      badge: 'Servidores',
      color: 'purple',
      body: (
        <P>
          Un cambio hecho por este proceso se avisa al instante. Uno hecho por otro proceso sobre el mismo store se ve por su revisión, que guardan SQLite y Postgres, mirada cada dos segundos mientras
          alguien escucha (<C>live: &#123; poll &#125;</C>). Un store sin revisión solo avisa los cambios de este proceso.
        </P>
      ),
    },
    {
      id: 'behind-a-proxy',
      title: 'Detrás de un proxy',
      badge: 'Producción',
      color: 'yellow',
      body: (
        <List
          items={[
            <>
              Cada 25 segundos va una línea vacía, para que un proxy no cierre el flujo por estar callado. Deja que una petición dure más que eso: <C>proxy_read_timeout 1h</C> en nginx.
            </>,
            <>
              La respuesta dice <C>x-accel-buffering: no</C> y <C>cache-control: no-transform</C>, para que nginx y la compresión no la retengan.
            </>,
            <>
              En una plataforma que corta una petición a los pocos segundos (funciones serverless), la página se reconecta al cortarse, y lo que cambie entretanto se ve en la siguiente. O apágalo con{' '}
              <C>live: false</C>.
            </>,
          ]}
        />
      ),
    },
    {
      id: 'large-folders',
      title: 'Carpetas grandes',
      badge: 'Velocidad',
      color: 'green',
      body: (
        <>
          <P>
            Desde 200 entradas, la lista y la cuadrícula ponen en la página solo lo que se ve y unas filas alrededor, con el espacio del resto guardado arriba y abajo, así que la barra de
            desplazamiento mide lo que mide todo. Las filas se miden al mostrarse, y las columnas de la cuadrícula siguen su ancho.
          </P>
          <P>
            El teclado las recorre todas como antes: una flecha, Inicio o Fin traen primero a la vista la que toca, porque a un lector de pantalla se le dice la actual. Cada una dice dónde está entre
            todas (<C>aria-posinset</C>, <C>aria-setsize</C>). Ctrl+A selecciona todas, no solo las de la página, y las direcciones de las imágenes se piden solo para las que se muestran.
          </P>
        </>
      ),
    },
  ],
};

export const sync: DocPage = {
  title: 'Sincronizar una carpeta',
  description: 'Una carpeta de la computadora igual que una del drive, en los dos sentidos: cambios, conflictos guardados dos veces y movimientos. En el escritorio y como comando.',
  source: 'packages/sync/src/engine.ts',
  lead: (
    <>
      <C>@rebofiles/sync</C> mantiene una carpeta del disco igual que una del drive. Cada pasada lista las dos y las compara con lo que eran la última vez que fueron iguales, así sabe qué lado cambió.
    </>
  ),
  sections: [
    {
      id: 'in-the-desktop-app',
      title: 'En la aplicación de escritorio',
      badge: 'Escritorio',
      color: 'blue',
      body: (
        <P>
          <strong>Server → Sync a Folder…</strong> (⇧⌘S) pregunta qué carpeta, <C>~/ReboFiles</C> si no se dice, y la mantiene mientras la ventana está abierta: al empezar, cuando el drive avisa un
          cambio, cuando la ventana vuelve al frente, y cada medio minuto. La etiqueta de abajo dice cómo fue. El disco lo leen y escriben los comandos propios de la aplicación, que nunca salen de esa
          carpeta.
        </P>
      ),
    },
    { id: 'as-a-command', title: 'Como comando', badge: 'CLI', color: 'green', lead: 'En cualquier computadora con Node, también como servicio.', body: <Code lang="bash" code={SYNC_CLI} /> },
    { id: 'in-your-code', title: 'En tu código', badge: 'API', color: 'purple', body: <Code code={SYNC_CODE} /> },
    {
      id: 'what-it-does',
      title: 'Lo que hace',
      badge: 'Reglas',
      color: 'yellow',
      body: (
        <Table
          label="Lo que hace una pasada"
          columns={['Cuando', 'Hace']}
          code={[]}
          rows={[
            ['Nuevo en un lado', 'Lo crea en el otro: una carpeta, o el archivo enviado o traído.'],
            ['Cambiado en un lado', 'Una versión nueva en el drive, o el archivo del disco escrito de nuevo.'],
            ['Cambiado en los dos', 'El del drive con su nombre; el del disco al lado como “nombre (conflict 2026-10-26 14.05).ext”, enviado como archivo propio.'],
            ['Ya no está en el disco', 'A la papelera del drive, de donde vuelve; salvo que cambiara en el drive desde entonces, que se trae otra vez.'],
            ['Ya no está en el drive', 'Apartado en el disco, en .rebofiles/removed/; salvo que cambiara en el disco desde entonces, que se envía otra vez.'],
            ['Movido o renombrado en el drive', 'Movido en el disco, una carpeta con lo que tiene dentro.'],
            ['Un archivo movido en el disco', 'Movido en el drive, el mismo archivo con sus versiones, encontrado por su tamaño y hora.'],
          ]}
        />
      ),
    },
    {
      id: 'what-it-does-not',
      title: 'Lo que no hace',
      badge: 'Límites',
      color: 'pink',
      body: (
        <List
          items={[
            'Una carpeta renombrada en el disco se envía otra vez como nueva, y la vieja va a la papelera: los archivos son los mismos, sus versiones empiezan de nuevo.',
            'Una carpeta vacía en el disco donde había archivos se toma por un disco que no está, y no se hace nada hasta que se diga (allowEmpty).',
            'Los archivos de los sistemas (.DS_Store, Thumbs.db, los ~$ de Office) se dejan fuera, y también su propia carpeta .rebofiles.',
            'Un archivo va entero cada vez, no solo la parte que cambió.',
          ]}
        />
      ),
    },
  ],
};

export const production: DocPage = {
  title: 'Ir a producción',
  description: 'Antes de abrir el drive a la gente: el secreto, la regla de orígenes del bucket, límites, copias de las entradas, rotar claves, subidas a medias y un proxy.',
  source: 'apps/site/components/docs/pages/running.tsx',
  lead: <>Lo que hay que fijar, y lo que hay que mirar, antes de que el drive de tu aplicación esté abierto a quienes la usan.</>,
  sections: [
    {
      id: 'checklist',
      title: 'La lista',
      badge: 'Lista',
      color: 'purple',
      body: (
        <List
          items={[
            <>
              <C>secret</C> largo y aleatorio (<C>openssl rand -hex 32</C>), el mismo en cada proceso, desde el entorno, nunca en el código.
            </>,
            <>
              <C>identify</C> desde tu sesión, y <C>authorize</C> con <C>byRoles</C> o reglas tuyas: nunca <C>everyone()</C>.
            </>,
            <>
              La regla de orígenes del bucket solo con tus dominios, <C>ETag</C> expuesto (<a href={hrefOf('storage')}>Almacenamiento</a>).
            </>,
            <>
              <C>maxSize</C> y la <C>quota</C> de cada persona en los ajustes; <C>trashDays</C> para que la papelera se vacíe sola.
            </>,
            <>
              Al menos <C>inspect: checkType()</C>, y ClamAV para archivos de gente que no conoces (<a href={hrefOf('checking-uploads')}>Revisar las subidas</a>).
            </>,
            <>
              Postgres para más de un proceso (<a href={hrefOf('metadata')}>Metadatos</a>), con sus copias.
            </>,
            <>Una regla de ciclo de vida en el bucket, como la de abajo.</>,
          ]}
        />
      ),
    },
    {
      id: 'uploads-left-halfway',
      title: 'Subidas a medias',
      badge: 'Bucket',
      color: 'yellow',
      body: (
        <>
          <P>
            Una página cerrada a mitad de una subida deja sus partes en el bucket, que ocupan espacio y no aparecen en ningún sitio. El servidor las barre solo cada diez minutos, según llegan
            peticiones: las más viejas que la vida de sus tokens (un día) se abortan, solo bajo su <C>prefix</C>, y en el disco se quitan sus partes. Una regla de ciclo de vida del bucket hace lo
            mismo sin él:
          </P>
          <Code lang="json" code={LIFECYCLE} file="lifecycle.json" />
        </>
      ),
    },
    {
      id: 'backups',
      title: 'Copias de seguridad',
      badge: 'Datos',
      color: 'green',
      body: (
        <>
          <P>
            Las entradas son lo que dice qué bytes son qué archivo: sin ellas, el bucket es un montón de ids. Cópialas como tu base de datos: <C>pg_dump</C> para Postgres, o para SQLite{' '}
            <C>sqlite3 drive.sqlite ".backup backup.sqlite"</C>, que es seguro mientras el servidor escribe.
          </P>
          <P>
            Los bytes nunca se cambian en su sitio: una versión es una clave nueva. Así que el versionado del bucket no hace falta para el drive, y una copia del bucket (R2 a S3, rclone) es una copia
            que solo crece. Borra en ella solo lo que borró el drive.
          </P>
        </>
      ),
    },
    {
      id: 'rotating-keys',
      title: 'Rotar claves',
      badge: 'Secretos',
      color: 'pink',
      body: (
        <List
          items={[
            <>La clave del bucket: haz una nueva, dásela a cada proceso, y revoca la vieja pasadas dos horas: una dirección de descarga dura quince minutos, una para mostrar una imagen dos horas.</>,
            <>
              El <C>secret</C>: uno nuevo termina las subidas en curso (sus tokens) y cambia las direcciones de los enlaces. Los enlaces hechos antes dejan de funcionar, porque se firman con él: hazlo
              a una hora tranquila, y avisa a quienes compartieron enlaces.
            </>,
          ]}
        />
      ),
    },
    {
      id: 'behind-a-proxy',
      title: 'Detrás de un proxy',
      badge: 'nginx',
      color: 'blue',
      body: (
        <>
          <Code lang="nginx" code={NGINX} />
          <P>Con un bucket, los bytes no pasan por el proxy: solo las peticiones del drive, que son pequeñas, y los eventos, que duran.</P>
        </>
      ),
    },
    {
      id: 'watch',
      title: 'Qué vigilar',
      badge: 'Logs',
      color: 'orange',
      body: (
        <P>
          El servidor escribe en la consola lo que no pudo hacer y no respondió: una actividad no guardada, <C>onShare</C> fallido, subidas sin barrer, un archivo que no se pudo revisar. Cada uno con
          su error. Un 500 no le dice nada de dentro a la página; la consola lo dice todo.
        </P>
      ),
    },
  ],
};
