// Ponlo en tu app: el componente, los hooks, el drive sin framework, su aspecto,
// su teclado y sus palabras.

import { REPO, docHref } from '@/lib/site';
import type { PropGroup } from '../../reference';
import { referenceIn } from '../../referenceI18n';
import { C, Callout, Code, type DocPage, List, P, RefTable, Table, withCode } from '../../ui';
import { ACTIONS, ENTRIES, FILEDRIVE, GROUPS, PROVIDER, QUEUE, SHARED, SPANISH, THEMED, TOGETHER, UPLOADS, VANILLA, WHOLE, hookId, propId } from '../app';

const to = (slug: string) => docHref('es', slug);
const SOURCE = 'apps/site/components/docs/pages/es/app.tsx';
const { PROPS, HOOKS } = referenceIn('es');
const GROUP_NAMES: Record<PropGroup, string> = { Server: 'servidor', Look: 'aspecto', Files: 'archivos', 'Word documents': 'documentos de Word', Events: 'eventos' };

export const react: DocPage = {
  title: 'Componente de React',
  description: '<FileDrive>: ponerlo en una página, cada prop según para qué sirve, la página de un enlace y qué pasa al cambiar una prop.',
  source: SOURCE,
  lead: (
    <>
      <C>&lt;FileDrive&gt;</C> es el drive completo: la búsqueda, las secciones, la lista y la cuadrícula, los detalles, el visor, las subidas, compartir y los ajustes. Ocupa la altura que se le da y
      no pide nada a tu CSS.
    </>
  ),
  sections: [
    {
      id: 'put-it-in-a-page',
      title: 'Ponlo en una página',
      badge: 'Empezar',
      color: 'purple',
      lead: 'Un componente de cliente, dentro de un elemento con altura. Con Rebodocs instalado, los documentos de Word se leen con su motor.',
      body: <Code lang="tsx" code={FILEDRIVE} file="app/files/page.tsx" />,
    },
    ...GROUPS.map((group) => ({
      id: `props-${group.toLowerCase().replace(/\s+/g, '-')}`,
      title: `Props: ${GROUP_NAMES[group]}`,
      badge: 'Props',
      color: 'yellow' as const,
      body: (
        <RefTable
          label={`Props: ${GROUP_NAMES[group]}`}
          name="Prop"
          rows={PROPS.filter((prop) => prop.group === group).map((prop) => ({ id: propId(prop.name), name: prop.name, type: prop.type, does: withCode(prop.does) }))}
        />
      ),
    })),
    {
      id: 'the-link-page',
      title: 'La página de un enlace',
      badge: 'Compartir',
      color: 'pink',
      lead: 'Lo que ve quien recibió un enlace, sin iniciar sesión: lo que puede leer, sus carpetas, un .zip de ellas; primero se pide la contraseña, si tiene.',
      body: (
        <>
          <Code lang="tsx" code={SHARED} file="app/shared/page.tsx" />
          <P>
            Haz que los enlaces del drive apunten a ella con <C>linkAddress</C>.
          </P>
        </>
      ),
    },
    {
      id: 'when-a-prop-changes',
      title: 'Cuando cambia una prop',
      badge: 'A saber',
      color: 'green',
      body: (
        <List
          items={[
            <>
              <C>language</C>, <C>theme</C>, <C>title</C> y los callbacks se aplican al cambiar, sin volver a empezar.
            </>,
            <>
              <C>base</C>, <C>client</C> o <C>headers</C> vuelven a crear el cliente del drive; lo que estaba subiendo sigue con el anterior.
            </>,
            <>
              Dentro de un <C>&lt;DriveProvider&gt;</C> tuyo, usa el cliente y las palabras de ese: lo que hace, lo ven tus hooks.
            </>,
          ]}
        />
      ),
    },
  ],
};

export const hooks: DocPage = {
  title: 'Headless: tu propia interfaz',
  description: 'Los hooks de @rebofiles/react uno a uno, el drive junto a tus propias piezas, y un drive entero hecho solo con los hooks.',
  source: SOURCE,
  lead: <>El componente está hecho con estos hooks y nada más: tómalos para un drive con tu marcado y tu aspecto, o para una pieza de uno junto al completo.</>,
  sections: [
    {
      id: 'the-hooks',
      title: 'Los hooks',
      badge: 'Referencia',
      color: 'green',
      body: <RefTable label="Hooks" name="Hook" rows={HOOKS.map((hook) => ({ id: hookId(hook.name), name: hook.name, does: withCode(`${hook.short} ${hook.gives}`) }))} />,
    },
    { id: 'driveprovider', title: 'DriveProvider', badge: 'Provider', color: 'purple', lead: 'El cliente y las palabras, para cada hook que tenga debajo.', body: <Code lang="tsx" code={PROVIDER} /> },
    {
      id: 'useentries',
      title: 'useEntries',
      badge: 'Leer',
      color: 'blue',
      lead: 'Una vista del drive, pedida de nuevo tras cada cambio hecho a través del provider.',
      body: <Code lang="tsx" code={ENTRIES} />,
    },
    {
      id: 'useactions',
      title: 'useActions',
      badge: 'Cambiar',
      color: 'yellow',
      lead: 'Lo que cambia el drive; cada acción avisa después a todos los hooks.',
      body: <Code lang="tsx" code={ACTIONS} />,
    },
    {
      id: 'useuploads',
      title: 'useUploads',
      badge: 'Subir',
      color: 'orange',
      lead: 'Archivos enviados de tres en tres, cada uno en partes, con su velocidad y el tiempo que le queda, y lo mismo de todos juntos.',
      body: <Code lang="tsx" code={UPLOADS} />,
    },
    {
      id: 'with-filedrive',
      title: 'Con <FileDrive>',
      badge: 'Juntos',
      color: 'pink',
      lead: 'Un drive dentro de tu provider lo usa: lo que se hace en el drive lo ven tus hooks, y lo que hacen tus hooks lo muestra el drive.',
      body: <Code lang="tsx" code={TOGETHER} />,
    },
    {
      id: 'a-whole-drive',
      title: 'Un drive entero',
      badge: 'Ejemplo',
      color: 'green',
      lead: 'Secciones, una ruta, carpetas, subidas con su progreso, detalles, renombrar, versiones, la papelera y la búsqueda: los hooks y nada más.',
      body: (
        <>
          <P>
            Es <a href={`${REPO}/blob/main/apps/playground/src/HooksDrive.tsx`}>apps/playground/src/HooksDrive.tsx</a> tal cual, en <C>/headless.html</C> del playground, y un test en Chrome lo recorre
            entero. <a href="/es/demo/#headless">La demo</a> tiene otro, con aspecto de suite creativa.
          </P>
          <Code lang="tsx" code={WHOLE} file="HooksDrive.tsx" />
        </>
      ),
    },
  ],
};

export const vanilla: DocPage = {
  title: 'Sin framework',
  description: 'mountDrive y mountSharedLink de @rebofiles/drive, para una página sin framework o con uno que no sea React; y las piezas que tiene debajo, por separado.',
  source: SOURCE,
  lead: (
    <>
      Lo que monta <C>&lt;FileDrive&gt;</C> es de <C>@rebofiles/drive</C>, que no necesita framework: Vue, Svelte, Angular o una página de HTML simple. Recibe las mismas opciones y se vuelve a dibujar
      cambiando solo lo distinto, así que el foco y el desplazamiento se quedan donde estaban.
    </>
  ),
  sections: [
    { id: 'mount-it', title: 'Móntalo', badge: 'Empezar', color: 'purple', body: <Code code={VANILLA} /> },
    {
      id: 'the-pieces',
      title: 'Las piezas que tiene debajo',
      badge: 'Piezas',
      color: 'blue',
      lead: 'Todas se exportan, para una interfaz propia sin React.',
      body: (
        <>
          <Table
            label="Piezas"
            columns={['Nombre', 'Qué es']}
            rows={[
              ['createDriveClient', 'Una función por cada ruta del servidor; subidas en partes que se reanudan.'],
              ['createUploads', 'La cola de subidas: tres a la vez, velocidad, tiempo restante, preguntar por lo que ya existe.'],
              ['lookInDrive', 'Lo que busca un archivo en el drive antes de subirlo.'],
              ['readDropped, readChosen', 'Los archivos de las carpetas soltadas o elegidas, con sus rutas.'],
              ['downloadZip, writeZip', 'Un .zip hecho en la página, a medida que llegan sus archivos.'],
              ['renditionsOf, placeholderOf', 'Las imágenes reducidas de una imagen, y su placeholder.'],
              ['textOf, hashOf', 'Lo que está escrito en un archivo, y su SHA-256.'],
              ['CSS, TEXTS, translator', 'El aspecto, limitado a .rf-drive, y las palabras.'],
            ]}
          />
          <Code code={QUEUE} />
        </>
      ),
    },
  ],
};

const VARS: [string, string][] = [
  ['--rf-brand', 'El color de lo elegido y de los botones principales; sale del color de marca de los ajustes.'],
  ['--rf-brand-hover, --rf-brand-light', 'Sus variantes más oscura y más clara.'],
  ['--rf-ink, --rf-ink-soft, --rf-muted', 'El texto, del más oscuro al más claro.'],
  ['--rf-bg, --rf-surface, --rf-hover', 'Los fondos.'],
  ['--rf-border, --rf-border-strong', 'Las líneas.'],
  ['--rf-danger', 'Lo que borra.'],
  ['--rf-k-<kind>, --rf-k-<kind>-fg', 'El mosaico de cada tipo de archivo: folder, docx, pdf, sheet, image, text, video, audio.'],
  ['--rf-fc-<colour>, --rf-fc-<colour>-fg', 'Los nueve colores que puede tener una carpeta.'],
  ['--rf-font, --rf-mono', 'Las fuentes.'],
  ['--rf-radius', 'Las esquinas.'],
];

export const styling: DocPage = {
  title: 'Estilos y temas',
  description: 'El aspecto del drive como propiedades personalizadas: claro y oscuro, el color de marca de los ajustes, una clase propia y los colores de carpeta.',
  source: SOURCE,
  lead: (
    <>
      Una sola hoja de estilos, limitada a <C>.rf-drive</C>, con cada color, radio y fuente como propiedad personalizada. Cada par de colores se lee a 4.5:1 o más, en claro y en oscuro.
    </>
  ),
  sections: [
    {
      id: 'light-and-dark',
      title: 'Claro y oscuro',
      badge: 'Tema',
      color: 'purple',
      body: (
        <P>
          <C>theme="dark"</C>, <C>"light"</C>, o <C>"auto"</C> según el sistema. Los ajustes del drive dan el suyo, y cada persona puede elegir el propio por encima; la prop queda entre ambos.
        </P>
      ),
    },
    {
      id: 'the-brand-colour',
      title: 'El color de marca',
      badge: 'Ajustes',
      color: 'green',
      body: (
        <P>Quien puede configurar el drive le da el color de la marca en sus ajustes; el drive genera sus variantes más oscura y más clara, y un texto encima que se lea bien, para ambos temas.</P>
      ),
    },
    {
      id: 'custom-properties',
      title: 'Propiedades personalizadas',
      badge: 'CSS',
      color: 'blue',
      body: (
        <>
          <Table label="Propiedades personalizadas" columns={['Propiedad', 'Qué colorea']} rows={VARS.map(([name, what]) => [name, what])} />
          <Code lang="tsx" code={THEMED} />
        </>
      ),
    },
    {
      id: 'your-own-look',
      title: 'Un aspecto propio',
      badge: 'Headless',
      color: 'yellow',
      body: (
        <P>
          Para un marcado y un aspecto totalmente tuyos, con Tailwind o lo que sea, constrúyelo con <a href={to('hooks')}>los hooks</a>.
        </P>
      ),
    },
  ],
};

const KEYS: [string, string][] = [
  ['↑ ↓, Inicio, Fin', 'Por la lista o la cuadrícula.'],
  ['Enter', 'Abrir: en una carpeta entra, un archivo se abre en el visor.'],
  ['Espacio, Mayús + ↑ ↓, ⌘/Ctrl + A', 'Elegir varios.'],
  ['F2', 'Renombrar.'],
  ['Supr, Retroceso', 'A la papelera.'],
  ['⌘/Ctrl + Z', 'Deshacer el último envío a la papelera, movimiento, cambio de nombre o color.'],
  ['Mayús + F10, la tecla de menú', 'El menú de lo elegido.'],
  ['← →', 'En el visor: el archivo anterior y el siguiente.'],
  ['Escape', 'Cerrar el menú, el diálogo o el visor.'],
];

export const accessibility: DocPage = {
  title: 'Teclado y accesibilidad',
  description: 'Cada acción desde el teclado, lo que se le dice a un lector de pantalla, y cómo se comprueba: axe en cada estado, en claro y en oscuro.',
  source: SOURCE,
  lead: (
    <>
      Todo lo que hace el ratón lo hace también el teclado, y a un lector de pantalla se le dice dónde está. axe revisa cada estado al que llegan los tests del navegador, según WCAG 2.2 AA, en ambos
      temas.
    </>
  ),
  sections: [
    { id: 'the-keys', title: 'Las teclas', badge: 'Teclado', color: 'purple', body: <Table label="Teclas" columns={['Tecla', 'Qué hace']} rows={KEYS.map(([key, does]) => [key, does])} /> },
    {
      id: 'what-a-screen-reader-hears',
      title: 'Lo que oye un lector de pantalla',
      badge: 'Lectores de pantalla',
      color: 'blue',
      body: (
        <List
          items={[
            'La lista es un listbox: cada entrada se anuncia con su propietario, fecha y tamaño, y cuántas hay elegidas.',
            'El aviso es un status que se lee, con su botón Deshacer al alcance del Tab.',
            'Los diálogos retienen el foco dentro y lo devuelven donde estaba al cerrarse.',
            'El panel de subidas es una región; cada archivo tiene una barra de progreso con su nombre, y un fallo es una alerta.',
            'Los colores de una carpeta son un grupo de botones de opción, cada uno con nombre.',
          ]}
        />
      ),
    },
    {
      id: 'how-it-is-checked',
      title: 'Cómo se comprueba',
      badge: 'Tests',
      color: 'green',
      body: (
        <P>
          <C>npm run test:browser</C> recorre el drive solo con el teclado y pasa axe en cada estado: vacío y con archivos, la lista y la cuadrícula, cada diálogo, la papelera, una búsqueda, el
          español al ancho de un móvil, un enlace sin sesión, y lo mismo en el tema oscuro, elegido y según el sistema.
        </P>
      ),
    },
  ],
};

export const languages: DocPage = {
  title: 'Idiomas',
  description: 'El drive en inglés, español o chino mandarín, palabras propias, y quién elige: los ajustes del drive, la aplicación y cada persona.',
  source: SOURCE,
  lead: <>Cada palabra del drive pasa por una única tabla de textos, en inglés, español y chino mandarín, con fechas y tamaños dichos como los dice cada idioma.</>,
  sections: [
    { id: 'choose-one', title: 'Elige uno', badge: 'Empezar', color: 'purple', body: <Code lang="tsx" code={SPANISH} /> },
    {
      id: 'who-chooses',
      title: 'Quién elige',
      badge: 'Ajustes',
      color: 'blue',
      body: (
        <P>
          Primero la elección de cada persona, desde los ajustes del drive; luego el <C>language</C> que da tu aplicación; luego el del drive, que fija quien puede configurarlo.
        </P>
      ),
    },
    {
      id: 'a-language-of-your-own',
      title: 'Un idioma propio',
      badge: 'Textos',
      color: 'yellow',
      body: (
        <>
          <P>
            <C>texts</C> recibe un objeto con las claves de <C>TEXTS.en</C>; TypeScript dice cuáles faltan. Los valores pueden llevar <C>{'{n}'}</C>, <C>{'{name}'}</C> y similares, que se rellenan
            como en los ingleses.
          </P>
          <Callout title="Los errores del servidor">
            llegan en inglés, con los nombres y números del caso. En español y chino el drive los dice por su código (<C>RequestError.code</C>), con sus palabras: <C>refusalText(error, language)</C>{' '}
            lo hace para una pantalla propia. Un código de tu aplicación, de un <C>Refused</C> propio, se dice tal como lo dijo tu servidor.
          </Callout>
          <Callout title="Rebodocs habla inglés y español.">
            En chino, el drive está en chino, y la barra de zoom y el editor de Rebodocs dentro de él siguen en inglés hasta que Rebodocs tenga su propio chino.
          </Callout>
        </>
      ),
    },
  ],
};
