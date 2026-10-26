// Referencia: los paquetes, todo lo que exporta React, el cliente, las rutas y lo
// comprobado. Lo medido (tests, límites, hoja de ruta) va en inglés, como ROADMAP.md.

import { PUBLISHED, VERSION } from '@/lib/home';
import { REPO, docHref } from '@/lib/site';
import { InstallCommand } from '../../frame/InstallCommand';
import { referenceIn } from '../../referenceI18n';
import { CHECKED, LIMITS, MEASURED, NOT_CHECKED, TESTS } from '../../status/data';
import { C, Callout, Code, type DocPage, List, P, RefTable, Table, withCode } from '../../ui';
import { hookId, propId } from '../app';
import { CLIENT_CODE, GROUPS, Milestones, RouteTable, Rows, clientId, packageId } from '../reference';

const to = (slug: string) => docHref('es', slug);
const { CLIENT, HOOKS, PACKAGE_DOCS, PROPS } = referenceIn('es');
const SOURCE = 'apps/site/components/docs/pages/es/reference.tsx';
const GROUP_NAMES: Record<(typeof GROUPS)[number], string> = {
  Reading: 'Leer',
  Changing: 'Cambiar',
  Uploads: 'Subidas',
  Sharing: 'Compartir',
  Files: 'Archivos',
  Settings: 'Ajustes',
  Live: 'En vivo',
  Comments: 'Comentarios',
  Keeping: 'Conservar',
};
const ROUTE_WORDS: [string, string, string, string] = ['Rutas', 'Rutas de un enlace', 'Ruta', 'Qué hace'];
const IN_ENGLISH = <Callout title="En inglés:">lo medido y la hoja de ruta se escriben una vez, en inglés, como en ROADMAP.md.</Callout>;

export const packages: DocPage = {
  title: 'Paquetes',
  description: 'Seis paquetes, cada uno para una cosa, en la misma versión: cuál instalar, dónde corre cada uno, qué da cada uno, y las aplicaciones del repositorio.',
  source: SOURCE,
  lead: <>Todos los paquetes están en la misma versión, {VERSION}, y cambian juntos. Ninguno tiene más dependencias que core y, donde se dice, Rebodocs como dependencia opcional.</>,
  sections: [
    {
      id: 'which-one',
      title: '¿Cuál instalo?',
      badge: 'Empieza aquí',
      color: 'blue',
      body: (
        <List
          items={[
            <>
              Una aplicación de React: <C>@rebofiles/react</C> para la página, <C>@rebofiles/server</C> para la ruta.
            </>,
            <>
              Una página sin React: <C>@rebofiles/drive</C>, y el servidor.
            </>,
            <>
              Cambiar un drive en un job propio: <C>@rebofiles/core</C>.
            </>,
            <>
              Un asistente: <C>@rebofiles/mcp</C>, junto al servidor.
            </>,
          ]}
        />
      ),
    },
    ...PACKAGE_DOCS.map((pkg) => ({
      id: packageId(pkg.name),
      title: pkg.name,
      badge: pkg.comes ? `Llega en ${pkg.comes}` : pkg.runs,
      color: pkg.comes ? ('orange' as const) : ('purple' as const),
      lead: pkg.what,
      body: pkg.comes ? null : (
        <>
          {PUBLISHED && (
            <div className="mt-5">
              <InstallCommand command={pkg.install} />
            </div>
          )}
          <P>
            {pkg.gives.map((name, i) => (
              <span key={name}>
                {i > 0 && ', '}
                <C>{name}</C>
              </span>
            ))}
            {' · '}
            <a href={`${REPO}/tree/main/packages/${pkg.name.replace('@rebofiles/', '')}#readme`}>su README</a>
          </P>
        </>
      ),
    })),
    {
      id: 'the-applications',
      title: 'Las aplicaciones',
      badge: 'Apps',
      color: 'green',
      body: (
        <P>
          <a href={to('demos')}>Demos para ejecutar</a>: el playground, la demo, un bucket real, el escritorio y este sitio, cada uno una carpeta de <C>apps/</C>.
        </P>
      ),
    },
  ],
};

const EXPORTS: [string, string][] = [
  ['FileDrive', 'El drive completo.'],
  ['SharedLink', 'Lo que ve quien recibió un enlace, sin iniciar sesión.'],
  ['createMemoryClient', 'El drive guardado en la página, con el cliente de las rutas del servidor.'],
  ['createDriveClient, createLinkClient', 'Los clientes, de @rebofiles/drive.'],
  ['RequestError', 'Lo que el servidor rechazó: su estado, su código y su mensaje.'],
  ['TEXTS, formatSize, formatDate, formatDuration, kindOf', 'Las palabras, y lo que se dice de un archivo.'],
  ['@rebofiles/react/rebodocs', 'previewDocx, viewDocx, thumbDocx, pictureOfDocx, textOfDocx: documentos de Word con el motor de Rebodocs.'],
];

export const components: DocPage = {
  title: 'Componentes y hooks',
  description: 'Todo lo que exporta @rebofiles/react: dos componentes, siete hooks, cada prop de <FileDrive>, y las funciones de al lado.',
  source: SOURCE,
  lead: <>Lo que necesita una aplicación de React está en este único paquete; lo que comparte con el drive sin framework también se exporta desde él.</>,
  sections: [
    { id: 'exports', title: 'Exportaciones', badge: 'Todo', color: 'blue', body: <Table label="Exportaciones" columns={['Nombre', 'Qué es']} rows={EXPORTS.map(([name, what]) => [name, what])} /> },
    {
      id: 'hooks',
      title: 'Hooks',
      badge: 'Hooks',
      color: 'green',
      body: <RefTable label="Hooks" name="Hook" rows={HOOKS.map((hook) => ({ id: `ref-${hookId(hook.name)}`, name: hook.name, does: withCode(`${hook.short} ${hook.gives}`) }))} />,
    },
    {
      id: 'props',
      title: 'Cada prop de <FileDrive>',
      badge: 'Props',
      color: 'yellow',
      body: (
        <>
          <RefTable label="Props de FileDrive" name="Prop" rows={PROPS.map((prop) => ({ id: `ref-${propId(prop.name)}`, name: prop.name, type: prop.type, does: withCode(prop.does) }))} />
          <P>
            Según para qué sirven, con ejemplos: <a href={to('react')}>Componente de React</a>.
          </P>
        </>
      ),
    },
  ],
};

export const client: DocPage = {
  title: 'API del cliente',
  description: 'createDriveClient: una función por cada ruta del servidor, según para qué sirve, y los rechazos que lanza.',
  source: SOURCE,
  lead: (
    <>
      El cliente sobre el que están hechos el drive y los hooks; <C>createMemoryClient</C> responde igual, desde la página. Un rechazo del servidor se lanza como un <C>RequestError</C> con su{' '}
      <C>status</C> y su <C>code</C>: <C>name-taken</C>, <C>in-trash</C>, <C>over-quota</C>, <C>forbidden</C>…
    </>
  ),
  sections: [
    { id: 'make-one', title: 'Crea uno', badge: 'Empezar', color: 'purple', body: <Code code={CLIENT_CODE} /> },
    ...GROUPS.map((group) => ({
      id: `client-${group.toLowerCase()}`,
      title: GROUP_NAMES[group],
      badge: 'Métodos',
      color: 'blue' as const,
      body: (
        <RefTable
          label={`Cliente: ${GROUP_NAMES[group]}`}
          name="Método"
          rows={CLIENT.filter((method) => method.group === group).map((method) => ({ id: clientId(method.name), name: method.signature, does: withCode(method.does) }))}
        />
      ),
    })),
  ],
};

export const routesPage: DocPage = {
  title: 'Rutas HTTP',
  description: 'Todas las rutas de @rebofiles/server, tal como las guarda el código: las de alguien con sesión, y las de un enlace.',
  source: 'packages/server/src/api.ts',
  lead: (
    <>
      Bajo la <C>base</C> del handler, <C>/api/files</C> en estas páginas. Se leen del comentario del principio de <C>packages/server/src/api.ts</C> al construir este sitio, así que están todas las
      del código; lo que hace cada una va traducido aquí. Los cuerpos son JSON; un rechazo es <C>&#123; error, message &#125;</C> con su estado: el <C>message</C> en inglés, y el drive lo dice en el
      idioma de cada persona por su <C>error</C>.
    </>
  ),
  sections: [
    {
      id: 'signed-in',
      title: 'De alguien con sesión',
      badge: 'Sesión',
      color: 'blue',
      lead: 'Cada una pregunta a identify quién pregunta y a authorize si puede.',
      body: <RouteTable through="session" words={ROUTE_WORDS} locale="es" />,
    },
    {
      id: 'through-a-link',
      title: 'A través de un enlace',
      badge: 'Enlaces',
      color: 'pink',
      lead: 'No preguntan a ninguno: el enlace es el permiso. Un enlace con contraseña la pide en cada una.',
      body: <RouteTable through="link" words={ROUTE_WORDS} locale="es" />,
    },
  ],
};

export const status: DocPage = {
  title: 'Estado y hoja de ruta',
  description: 'Qué está comprobado, con los tests de cada paquete; qué no; los límites conocidos; y la hoja de ruta.',
  source: SOURCE,
  lead: (
    <>
      Versión {VERSION}, {PUBLISHED ? 'en npm' : 'aún no en npm'}. Los números son lo que dieron los comandos el {MEASURED}, no lo que alguien recuerda; lo mismo está en{' '}
      <a href={`${REPO}/blob/main/ROADMAP.md`}>ROADMAP.md</a>.
    </>
  ),
  sections: [
    {
      id: 'what-is-checked',
      title: 'Qué está comprobado',
      badge: 'Tests',
      color: 'green',
      lead: `${TESTS.reduce((sum, row) => sum + row.count, 0)} tests, todos pasando, con npm test y, en Chrome, npm run test:browser.`,
      body: (
        <>
          {IN_ENGLISH}
          <div className="mt-5 max-w-[920px] overflow-hidden rounded-[14px] border border-border">
            {TESTS.map((row) => (
              <div key={row.where} className="grid grid-cols-[1fr_auto] gap-x-5 gap-y-1 border-t border-border px-4.5 py-3.5 first:border-t-0">
                <p className="m-0 font-code text-[14px] font-medium text-ink">{row.where}</p>
                <p className="row-span-2 m-0 self-center font-display text-[28px] font-extrabold tracking-[-0.03em] text-brand">{row.count}</p>
                <p className="m-0 text-[15px] text-ink-soft" lang="en">
                  {row.what}
                </p>
              </div>
            ))}
          </div>
        </>
      ),
    },
    {
      id: 'checked-by-hand',
      title: 'Comprobado a mano',
      badge: 'A mano',
      color: 'blue',
      body: (
        <div lang="en">
          <Rows rows={CHECKED} />
        </div>
      ),
    },
    {
      id: 'what-is-not',
      title: 'Qué no',
      badge: 'Aún no',
      color: 'pink',
      body: (
        <div lang="en">
          <Rows rows={NOT_CHECKED} />
        </div>
      ),
    },
    {
      id: 'known-limits',
      title: 'Límites conocidos',
      badge: 'Límites',
      color: 'yellow',
      body: (
        <div className="mt-5 grid max-w-[920px] gap-3 sm:grid-cols-2" lang="en">
          {LIMITS.map((group) => (
            <div key={group.area} className="rounded-[14px] border border-border p-4.5">
              <p className="m-0 font-semibold text-ink">{group.area}</p>
              <ul className="m-0 mt-2 list-disc space-y-1.5 pl-5 text-[15px] text-ink-soft">
                {group.items.map((item) => (
                  <li key={item}>{withCode(item)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'roadmap',
      title: 'Hoja de ruta',
      badge: 'Siguiente',
      color: 'purple',
      lead: 'En el orden en que se construye. Cada versión va a npm cuando su último punto está hecho, y no antes.',
      body: (
        <div lang="en">
          <Milestones of={(done, all) => `${done} de ${all}`} notYet="(aún no)" />
        </div>
      ),
    },
    { id: 'license', title: 'Licencia', badge: 'MIT', color: 'orange', body: <P>MIT. Cualquiera puede usarlo para lo que sea, también comercialmente, sin garantía.</P> },
  ],
};
