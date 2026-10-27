// Empezar: qué es ReboFiles, el primer drive en marcha y las demos del repositorio.

import { LiveDemo } from '@/components/home/LiveDemo';
import { PUBLISHED, VERSION } from '@/lib/home';
import { docHref } from '@/lib/site';
import { InstallCommand } from '../../frame/InstallCommand';
import { C, Callout, Cards, Code, DemoBox, type DocPage, List, P, Table } from '../../ui';
import { MEMORY, PAGE, REPOSITORY, ROUTE } from '../start';

const to = (slug: string) => docHref('es', slug);
const SOURCE = 'apps/site/components/docs/pages/es/start.tsx';

export const index: DocPage = {
  title: 'Qué es ReboFiles',
  description: 'Un drive de archivos para el navegador, integrado en tu aplicación y en tu propio almacenamiento: qué hace, sus paquetes y lo que no es.',
  source: SOURCE,
  lead: (
    <>
      ReboFiles es un gestor de archivos para el navegador que vive dentro de tu aplicación: carpetas, subidas, vistas previas, versiones, papelera y compartir, con los bytes en tu propio bucket y las
      entradas en tu propia base de datos. Es el drive de la suite Rebo, junto a <a href="https://www.rebodocs.com">Rebodocs</a>, y viene en paquetes que tomas de uno en uno.
    </>
  ),
  tip: 'consejo: el drive de abajo está funcionando, pruébalo',
  sections: [
    {
      id: 'try',
      title: 'El drive, en marcha',
      badge: 'En vivo',
      color: 'green',
      lead: 'La demo de la portada: el drive guardado en esta página, con los archivos de Acme creados en ella. Nada sale del navegador.',
      body: (
        <DemoBox title="Pruébalo">
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: se desplaza de lado, y el teclado tiene que llegar a lo que queda oculto (WCAG 2.1.1) */}
          <section className="overflow-x-auto" aria-label="La demo" tabIndex={0}>
            <LiveDemo locale="es" />
          </section>
        </DemoBox>
      ),
    },
    {
      id: 'what-you-get',
      title: 'Qué obtienes',
      badge: 'Funciones',
      color: 'blue',
      body: (
        <List
          items={[
            <>
              <strong>Subidas que puedes seguir.</strong> Directo al bucket en partes, tres a la vez, cada una con el tiempo que le queda; carpetas enteras tal como estaban; una subida cortada sigue
              desde donde iba.
            </>,
            <>
              <strong>El mismo archivo, detectado.</strong> Sus bytes, o su nombre, encontrados en el drive antes de subir: reemplazado como nueva versión, ambos conservados u omitido.
            </>,
            <>
              <strong>Carpetas y búsqueda.</strong> Carpetas anidadas, nueve colores, la lista en cualquier orden, búsqueda por nombre y por lo que está escrito dentro de los archivos.
            </>,
            <>
              <strong>Vistas previas y un visor.</strong> Documentos de Word página a página con Rebodocs, PDF, imágenes en cuatro tamaños y difuminadas mientras llegan, vídeo, audio y texto.
            </>,
            <>
              <strong>Versiones, papelera y espacio.</strong> Cada guardado conserva el archivo anterior; la papelera se vacía sola tras los días que digas; una cuota por persona.
            </>,
            <>
              <strong>Compartir.</strong> Lector, comentarista y editor, hacia abajo en el árbol; enlaces que caducan, con contraseña o de una sola descarga; lo nuevo en Compartido conmigo.
            </>,
            <>
              <strong>Actividad.</strong> Quién hizo qué en cada archivo y carpeta, guardado por tu base de datos.
            </>,
            <>
              <strong>Descargas en .zip</strong> de lo seleccionado, de una carpeta o de la carpeta de un enlace, hechas en la página.
            </>,
            <>
              <strong>Asistentes de IA.</strong> Herramientas para Claude por MCP, con los permisos del usuario; documentos de Word editados con Rebodocs, cada cambio una versión.
            </>,
            <>
              <strong>En el momento.</strong> Lo que cambia otra persona aparece al instante; comentarios con respuestas y @; carpetas de miles; el drive leído por partes.
            </>,
            <>
              <strong>A salvo.</strong> Archivos revisados por sus bytes y con ClamAV, límites a quien pide demasiado, un mínimo de días, retención legal, todo lo de una persona exportado.
            </>,
            <>
              <strong>Teclado y lectores de pantalla</strong>, claro y oscuro, inglés, español y chino, una pantalla de ajustes y una aplicación de escritorio que sincroniza una carpeta.
            </>,
          ]}
        />
      ),
    },
    {
      id: 'the-packages',
      title: 'Los paquetes',
      badge: 'Elige',
      color: 'purple',
      body: (
        <>
          <Table
            label="Paquetes"
            columns={['Paquete', 'Tómalo cuando']}
            rows={[
              ['@rebofiles/react', 'Tienes una aplicación de React o Next.js y quieres el drive en una de sus pantallas, entero o a partir de hooks.'],
              ['@rebofiles/drive', 'Tu página no usa framework, o usa uno que no es React: el mismo drive, montado en un elemento.'],
              ['@rebofiles/server', 'Tu backend guarda las entradas y firma las direcciones: una ruta, entra un Request y sale un Response.'],
              ['@rebofiles/core', 'Cambias un drive desde código, en un job o en un almacén propio: el modelo como funciones puras.'],
              ['@rebofiles/mcp', 'Un asistente de IA debe encontrar, leer y archivar documentos con los permisos de su persona.'],
            ]}
          />
          <P>
            <a href={to('packages')}>Paquetes</a> explica qué contiene cada uno y cómo dependen entre sí.
          </P>
        </>
      ),
    },
    {
      id: 'how-it-is-built',
      title: 'Cómo está hecho',
      badge: 'Decidido',
      color: 'yellow',
      body: (
        <List
          items={[
            <>
              <strong>Los bytes nunca pasan por tu servidor.</strong> El navegador los envía al bucket a direcciones que el servidor firma para su longitud exacta, y los lee de vuelta igual.
            </>,
            <>
              <strong>Las entradas viven en un almacén aparte.</strong> Un bucket no tiene carpetas, propietarios ni papelera; la clave de un archivo es su id, nunca su ruta, así que mover y renombrar
              nunca tocan los bytes.
            </>,
            <>
              <strong>Quién puede hacer qué lo decide tu aplicación.</strong> <C>identify</C> y <C>authorize</C> se consultan en cada ruta; ReboFiles no tiene usuarios propios.
            </>,
            <>
              <strong>Sin dependencias en tiempo de ejecución.</strong> S3 se firma con <C>node:crypto</C>, SQLite es <C>node:sqlite</C>, el .zip se escribe en la página.
            </>,
          ]}
        />
      ),
    },
    {
      id: 'what-it-is-not',
      title: 'Lo que no es',
      badge: 'Claramente',
      color: 'pink',
      body: (
        <List
          items={[
            <>
              <strong>No es un servicio alojado.</strong> No hay nada en lo que registrarse: es código que ejecutas, en un almacenamiento que es tuyo.
            </>,
            <>
              <strong>No está terminado.</strong> {PUBLISHED ? `Está en npm en la ${VERSION}` : 'Está probado y aún no está en npm'}, y no lo hace todo:{' '}
              <a href={to('status')}>Estado y hoja de ruta</a> enumera lo comprobado y lo que falta.
            </>,
          ]}
        />
      ),
    },
  ],
};

const COMMANDS: [string, string][] = [
  ['npm run dev', 'El playground: el drive completo contra un servidor en el mismo proceso, los bytes en una carpeta, las entradas en SQLite. `?as=bea` es otra persona.'],
  ['npm run demo', 'La demo de la portada: el drive guardado en la página, con las llamadas de Claude a las herramientas MCP.'],
  ['npm run storage', 'El drive contra un bucket real (R2, S3, MinIO), desde `apps/storage/.env`.'],
  ['npm run storage:check', 'Todo el recorrido de un archivo contra ese bucket, desde Node, y todo borrado al final.'],
  ['npm run desktop', 'La aplicación de escritorio, con Tauri, contra el playground.'],
  ['npm run site', 'Este sitio.'],
  ['npm test', 'Todos los tests de los paquetes, en Node.'],
  ['npm run test:browser', 'El drive en Chrome con Playwright, axe en cada estado.'],
  ['npm run typecheck', 'TypeScript, estricto, en los paquetes y las aplicaciones.'],
  ['npm run lint', 'Biome.'],
];

export const gettingStarted: DocPage = {
  title: 'Primeros pasos',
  description: 'Un drive en una aplicación de Next.js: la página, la ruta y adónde ir después; el drive sin ningún servidor; y los comandos del repositorio.',
  source: SOURCE,
  lead: (
    <>
      Tres piezas: <C>&lt;FileDrive&gt;</C> en una página, una ruta de tu servidor que guarda las entradas y pregunta a tu aplicación quién puede hacer qué, y un bucket que guarda los bytes. Esta
      página pone las dos primeras en una aplicación de Next.js; <a href={to('storage')}>Almacenamiento</a> es la tercera.
    </>
  ),
  sections: [
    {
      id: 'install',
      title: 'Instalar',
      badge: 'npm',
      color: 'blue',
      lead: '@rebofiles/react para la página, @rebofiles/server para la ruta. React 18 o posterior, Node 22.12 o posterior.',
      body: PUBLISHED ? (
        <div className="mt-5">
          <InstallCommand command="npm install @rebofiles/react @rebofiles/server" />
        </div>
      ) : (
        <>
          <Callout title="Aún no está en npm.">La 0.1.0 se publica cuando esté hecho lo que le falta. Hasta entonces, todo lo de aquí funciona desde el repositorio: mira la última sección.</Callout>
          <div className="mt-5">
            <InstallCommand command="npm install @rebofiles/react @rebofiles/server" />
          </div>
        </>
      ),
    },
    {
      id: 'the-page',
      title: 'La página',
      badge: 'React',
      color: 'purple',
      lead: 'El drive completo, en la altura que se le dé.',
      body: (
        <>
          <Code lang="tsx" code={PAGE} file="app/files/page.tsx" />
          <P>
            Eso es la búsqueda, Mis archivos, Compartido conmigo, Recientes y la papelera, la lista y la cuadrícula, vistas previas y el visor, versiones, actividad, subidas con botón o arrastrando
            archivos y carpetas, y una pantalla de ajustes. <a href={to('react')}>Componente de React</a> tiene todas las props.
          </P>
        </>
      ),
    },
    {
      id: 'the-route',
      title: 'La ruta',
      badge: 'Servidor',
      color: 'pink',
      lead: 'createDriveHandler recibe un Request y devuelve un Response, así que es un route handler de Next.js tal cual.',
      body: (
        <>
          <Code code={ROUTE} file="app/api/files/[...path]/route.ts" />
          <P>
            <C>identify</C> dice quién pregunta, a partir de tu sesión; <C>byRoles</C> responde quién puede hacer qué según el propio drive. <a href={to('server')}>La ruta</a> y{' '}
            <a href={to('authorize')}>Quién puede hacer qué</a> explican ambos.
          </P>
        </>
      ),
    },
    {
      id: 'no-server',
      title: 'Sin servidor',
      badge: 'En la página',
      color: 'green',
      lead: 'Para una demo, una historia o un test: el drive guardado en la página, los bytes como Blobs.',
      body: <Code lang="tsx" code={MEMORY} />,
    },
    {
      id: 'where-to-go-next',
      title: 'Adónde ir después',
      badge: 'Siguiente',
      color: 'yellow',
      body: (
        <Cards
          items={[
            { title: 'Almacenamiento: S3 y disco', href: to('storage'), text: 'El bucket, sus claves y su regla de orígenes.' },
            { title: 'Headless: tu propia interfaz', href: to('hooks'), text: 'Los hooks con los que está hecho el drive, y un drive entero hecho con ellos.' },
            { title: 'Compartir y enlaces', href: to('sharing'), text: 'Roles hacia abajo en el árbol, enlaces con contraseña, avisar a la gente.' },
            { title: 'Asistentes de IA (MCP)', href: to('assistants'), text: 'Claude encontrando, leyendo y archivando documentos, con los permisos del usuario.' },
          ]}
        />
      ),
    },
    {
      id: 'run-the-repository',
      title: 'Ejecuta el repositorio',
      badge: 'Repositorio',
      color: 'orange',
      lead: 'Todos los paquetes y todas las aplicaciones, desde el código fuente.',
      body: (
        <>
          <Code lang="bash" code={REPOSITORY} />
          <Table label="Comandos" columns={['Comando', 'Qué hace']} rows={COMMANDS.map(([command, does]) => [command, does])} />
        </>
      ),
    },
  ],
};

export const demos: DocPage = {
  title: 'Demos para ejecutar',
  description: 'Las aplicaciones del repositorio, qué muestra cada una y qué necesita: el playground, la demo, un bucket real, el escritorio y el sitio.',
  source: SOURCE,
  lead: (
    <>
      Cada una es una carpeta de <C>apps/</C>, que se arranca desde la raíz del repositorio. Ninguna necesita una cuenta, salvo la de un bucket real.
    </>
  ),
  sections: [
    {
      id: 'the-playground',
      title: 'El playground',
      badge: 'npm run dev',
      color: 'green',
      lead: 'El drive en este ordenador: los bytes en storage/files, las entradas en SQLite, el servidor en el mismo proceso que la página.',
      body: (
        <List
          items={[
            <>
              <C>http://localhost:5180</C> es el drive en React; <C>/vanilla.html</C> sin framework; <C>/headless.html</C> hecho solo con los hooks.
            </>,
            <>
              <C>?as=bea</C> es otra persona, para compartir con ella; <C>?lang=es</C>, <C>?lang=zh</C> y <C>?theme=dark</C> hacen lo que dicen.
            </>,
            <>
              Las herramientas para un asistente en <C>/api/mcp</C>: <C>claude mcp add --transport http rebofiles http://localhost:5180/api/mcp</C>.
            </>,
            <>Un documento de Word se abre en el editor de Rebodocs, y ⌘S lo guarda como su siguiente versión.</>,
          ]}
        />
      ),
    },
    {
      id: 'the-demo',
      title: 'La demo',
      badge: 'npm run demo',
      color: 'blue',
      lead: 'El drive de la portada, guardado en la página: los archivos de Acme creados en ella, y Claude renombrando uno con las herramientas MCP, respondidas en la página.',
      body: (
        <P>
          Está hecha con <C>createMemoryClient</C>, así que no necesita servidor, y los tests del navegador pasan por ella.
        </P>
      ),
    },
    {
      id: 'a-real-bucket',
      title: 'Un bucket real',
      badge: 'npm run storage',
      color: 'yellow',
      lead: 'El drive contra Cloudflare R2, AWS S3, MinIO o Backblaze, con las entradas en SQLite en este ordenador.',
      body: (
        <P>
          Copia <C>apps/storage/.env.example</C> a <C>.env</C>, complétalo, da al bucket la regla de orígenes de <C>apps/storage/cors.json</C>, y <C>npm run storage:check</C> hace todo el recorrido de
          un archivo desde Node antes de que la página lo intente. <a href={to('storage')}>Almacenamiento</a> explica cómo. Ahí está todo activo: <C>?as=bea</C> para compartir con Bea (en{' '}
          <C>group:team</C> con Carl), enlaces con contraseña, comentarios, la primera página de un PDF hecha por el servidor, archivos revisados, el asistente en <C>/api/mcp</C>.
        </P>
      ),
    },
    {
      id: 'the-documents',
      title: 'Documentos',
      badge: 'npm run documents',
      color: 'orange',
      lead: 'Documentos de Word de principio a fin, todo con Rebodocs: Crear documento, su editor con varias personas en un documento a la vez, su visor y PDF. En http://localhost:5184.',
      body: (
        <P>
          Abre un documento como <C>?as=ana</C> y, compartido con ella, como <C>?as=bea</C>: cada una ve el cursor de la otra y lo que escribe, y se guarda una versión cuando las dos se van. En{' '}
          <C>apps/documents</C>, las salas sobre el drive son <C>server/collab.ts</C>.
        </P>
      ),
    },
    {
      id: 'the-desktop',
      title: 'El escritorio',
      badge: 'npm run desktop',
      color: 'purple',
      lead: 'El drive en su propia ventana, con Tauri, contra el playground o cualquier servidor.',
      body: (
        <P>
          Rust y las herramientas de línea de comandos de Xcode en un Mac. <C>npm run build:desktop</C> genera ReboFiles.app; <strong>Server → Sync a Folder…</strong> mantiene una carpeta de la
          computadora igual que el drive (<a href={to('sync')}>Sincronizar una carpeta</a>). <a href={to('desktop')}>Escritorio y otros orígenes</a> explica qué necesita el servidor.
        </P>
      ),
    },
    {
      id: 'the-site',
      title: 'Este sitio',
      badge: 'npm run site',
      color: 'pink',
      body: (
        <P>
          La portada, con la demo dentro, y estas páginas: Next.js y Tailwind, generados como archivos estáticos, en inglés, español y chino. <a href="/es/demo/">/demo/</a> tiene el drive de tres
          formas, una en cada pestaña: <C>&lt;FileDrive&gt;</C> tal como viene, su diseño compacto, y una interfaz con aspecto de suite creativa hecha solo con los hooks headless.
        </P>
      ),
    },
  ],
};
