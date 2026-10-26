// Lo que un equipo pide pronto a un drive, en español: comentarios; el
// servidor contando qué se hace, qué falló y cuánto puede pedir cada uno; y lo
// que se conserva, se retiene o se entrega entero de una persona.

import { docHref } from '@/lib/site';
import { C, Callout, Code, type DocPage, List, P, Table } from '../../ui';
import { COMMENTS_HOOK, EXPORT_CODE, HOOKS_CODE, LIMITS_CODE, ON_COMMENT, REDIS_CODE, RETENTION_CODE } from '../team';

const hrefOf = (slug: string) => docHref('es', slug);

export const comments: DocPage = {
  title: 'Comentarios',
  description: 'Lo que la gente dice de un archivo o carpeta: hilos con respuestas, resueltos al terminar, @ para nombrar a alguien, en el drive, los hooks y el asistente.',
  source: 'packages/core/src/comments.ts',
  lead: (
    <>
      Quien puede comentar (un comentarista, un editor, el dueño) dice algo de un archivo o carpeta en sus detalles, en <strong>Comentarios</strong>; quien puede leerlo lo lee. Una respuesta va bajo
      el comentario que empieza su hilo, y un hilo se resuelve cuando se atiende.
    </>
  ),
  sections: [
    {
      id: 'in-the-drive',
      title: 'En el drive',
      badge: 'Detalles',
      color: 'blue',
      body: (
        <List
          items={[
            <>
              La pestaña <strong>Comentarios</strong> de los detalles: cada hilo, sus respuestas debajo, quién dijo qué y cuándo, “editado” si cambió.
            </>,
            <>
              <strong>Responder</strong>, <strong>Resolver</strong> o <strong>Reabrir</strong> un hilo; <strong>Editar</strong> y <strong>Borrar</strong> los propios. El dueño puede borrar cualquiera.
            </>,
            <>⌘Enter o Ctrl+Enter envía lo escrito; Escape deja una edición. Lo que dice otra persona llega en el momento, por los eventos.</>,
            <>
              Cada comentario está en la actividad de aquello en que está (<C>commented</C>), y se va con ello cuando se borra para siempre.
            </>,
          ]}
        />
      ),
    },
    { id: 'in-your-own-screen', title: 'En una pantalla propia', badge: 'Hooks', color: 'purple', body: <Code code={COMMENTS_HOOK} lang="tsx" /> },
    {
      id: 'telling-who-is-named',
      title: 'Avisar a quien se nombra',
      badge: 'Servidor',
      color: 'green',
      lead: 'A quien un comentario nombra con @ (`@bea`, `@ana.lopez`) está en `mentions`: avisarle es cosa de tu aplicación, como onShare.',
      body: <Code code={ON_COMMENT} />,
    },
    {
      id: 'for-the-assistant',
      title: 'Para el asistente',
      badge: 'MCP',
      color: 'orange',
      body: (
        <P>
          <C>list_comments</C> los lee y <C>add_comment</C> dice uno, o una respuesta con <C>replyTo</C>, en nombre de la persona para quien trabaja el asistente y con sus permisos: “añade una nota al
          contrato de que el cliente firmó”. Ver <a href={hrefOf('assistants')}>Asistentes de IA</a>.
        </P>
      ),
    },
  ],
};

export const observe: DocPage = {
  title: 'Ganchos, registros y límites',
  description: 'El servidor contando a tu aplicación qué se hace (onChange), qué falló (logger) y cuánto tarda cada ruta (OpenTelemetry), y cuánto puede pedir cada uno.',
  source: 'packages/server/src/observe.ts',
  lead: (
    <>
      Lo que el servidor dice de sí mismo, y lo que deja hacer a cada uno con qué frecuencia. Cada cosa es una opción de <C>createDriveHandler</C>, y cada fallo tuyo se registra, no es el de la
      petición.
    </>
  ),
  sections: [
    {
      id: 'what-is-done',
      title: 'Qué se hace, qué falló, cuánto tardó',
      badge: 'Ganchos',
      color: 'blue',
      body: (
        <>
          <Code code={HOOKS_CODE} />
          <List
            items={[
              <>
                A <C>onChange</C> se le dice cada cosa hecha, como la dice la actividad (<C>created</C>, <C>uploaded</C>, <C>version</C>, <C>renamed</C>, <C>moved</C>, <C>trashed</C>, <C>restored</C>,{' '}
                <C>deleted</C>, <C>shared</C>, <C>commented</C>, <C>held</C>…), con la entrada como queda, null si se borró.
              </>,
              <>
                <C>logger</C> es donde el servidor escribe lo que no respondió: una actividad no guardada, un gancho que falló, un archivo que no se pudo revisar. <C>console</C> si no se da.
              </>,
              <>
                A <C>onRequest</C> se le dice cada ruta como la dice la lista (<C>GET /entries/:id</C>), su estado, su tiempo y quién preguntó. <C>openTelemetry(meter)</C> lo hace el histograma{' '}
                <C>http.server.request.duration</C> y un contador de los 5xx.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: 'how-much-each-may-ask',
      title: 'Cuánto puede pedir cada uno',
      badge: 'Límites',
      color: 'yellow',
      body: (
        <>
          <Table
            label="Los límites si no se dice otra cosa"
            columns={['Tipo', 'Por', 'Si no se dice']}
            code={[0]}
            rows={[
              ['uploads', 'persona', '1000 por minuto'],
              ['zip', 'persona, y enlace', '30 por minuto'],
              ['searchText', 'persona', '120 por minuto'],
              ['linkPassword', 'enlace y dirección', '10 erróneas en 15 minutos, después ni la correcta'],
              ['links', 'enlace', '600 por minuto'],
              ['requests', 'persona', 'ninguno'],
            ]}
          />
          <Code code={LIMITS_CODE} />
          <P>
            Pasado uno, la respuesta es un <C>429 rate-limited</C> con <C>Retry-After</C>, y el drive lo dice en el idioma de cada persona. <C>limits: false</C> para ninguno.
          </P>
        </>
      ),
    },
    {
      id: 'more-than-one-process',
      title: 'Más de un proceso',
      badge: 'Redis',
      color: 'pink',
      lead: 'Las cuentas se guardan en el proceso, salvo que un `limiter` tuyo las guarde para todos: unas líneas sobre Redis.',
      body: <Code code={REDIS_CODE} file="limiter.ts" />,
    },
  ],
};

export const keeping: DocPage = {
  title: 'Retención, bloqueos y exportación',
  description: 'Conserva archivos un mínimo de días, pon una carpeta en retención legal para que nada se borre, y entrega a una persona todo lo suyo en un .zip, como pide el RGPD.',
  source: 'packages/core/src/ops.ts',
  lead: (
    <>Tres cosas que una empresa pide antes de guardar sus archivos en un drive: que nada se vaya antes de tiempo, que lo que necesita un caso se quede, y que una persona pueda llevarse lo suyo.</>
  ),
  sections: [
    {
      id: 'a-minimum-of-days',
      title: 'Un mínimo de días',
      badge: 'Retención',
      color: 'blue',
      body: (
        <>
          <P>
            <C>retentionDays</C> de los ajustes del drive (<strong>Ajustes → Almacenamiento</strong>, para quien puede configurar): nada creado hace menos días se borra para siempre, ni por alguien ni
            por la papelera al vaciarse sola. Puede ir a la papelera y volver; vaciarla lo deja ahí, y borrarlo dice <C>409 retained</C>.
          </P>
          <Code code={RETENTION_CODE} />
        </>
      ),
    },
    {
      id: 'a-legal-hold',
      title: 'Una retención legal',
      badge: 'Retención',
      color: 'pink',
      body: (
        <List
          items={[
            <>
              <strong>Poner en retención</strong>, en los detalles, para quien puede configurar: ni eso ni nada dentro puede ir a la papelera ni borrarse, por nadie, hasta que se quite. Si se intenta,
              la respuesta es <C>409 on-hold</C>.
            </>,
            'Pueden llegar versiones nuevas: las anteriores se quedan, como siempre.',
            <>
              Los detalles dicen quién la puso y por qué; la actividad tiene <C>held</C> y <C>released</C>, y se le dicen a <C>onChange</C>.
            </>,
          ]}
        />
      ),
    },
    {
      id: 'everything-of-a-person',
      title: 'Todo lo de una persona',
      badge: 'Exportar',
      color: 'green',
      body: (
        <>
          <P>
            <strong>Ajustes → Idioma → Descargar mis datos</strong> hace un .zip de lo que uno posee, en sus lugares, y un <C>rebofiles-export.json</C> al lado: cada entrada suya, lo compartido con
            ella, sus comentarios, lo que hizo, sus ajustes. <C>GET /export</C> da lo mismo; <C>?user=</C> el de otra persona, para quien puede configurar.
          </P>
          <Code code={EXPORT_CODE} />
          <Callout title="De otra persona,">
            la exportación da lo que posee e hizo, como lo guarda el drive; sus bytes los lee del almacenamiento tu servidor, porque <C>byRoles</C> no deja descargarlos a nadie más que a ella.
          </Callout>
        </>
      ),
    },
  ],
};
