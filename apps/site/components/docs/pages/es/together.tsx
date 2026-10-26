// En equipo: un asistente de IA trabajando en el drive, con los permisos de su persona.

import { C, Callout, Code, type DocPage, List, P, RefTable } from '../../ui';
import { toolsIn } from '../../routesI18n';
import { CLAUDE, DocumentTools, HTTP, STDIO, toolId } from '../together';

export const assistants: DocPage = {
  title: 'Asistentes de IA (MCP)',
  description: 'Un servidor MCP para Claude y otros asistentes: por HTTP en tu aplicación o por stdio, cada herramienta, lo que puede tocar un asistente, y Word con Rebodocs.',
  source: 'apps/site/components/docs/pages/es/together.tsx',
  lead: (
    <>
      <C>@rebofiles/mcp</C> da a un asistente el drive como herramientas: listar, buscar, leer, escribir texto, renombrar, mover, colorear y mandar a la papelera. Cada una se pide a las rutas del
      drive con los permisos de la persona, así que <C>authorize</C> también se consulta para el asistente.
    </>
  ),
  sections: [
    {
      id: 'over-http',
      title: 'En tu aplicación, por HTTP',
      badge: 'HTTP',
      color: 'blue',
      lead: 'Junto a la ruta del drive: reenvía la autorización y la cookie de cada petición al drive, así que basta con un token de la persona.',
      body: (
        <>
          <Code code={HTTP} />
          <Code lang="bash" code={CLAUDE} />
          <P>
            <C>headers</C> indica con qué se pregunta al drive si no; <C>fetch</C> da el propio handler del drive, para preguntarle en el mismo proceso; <C>origins</C>, los orígenes desde los que un
            navegador puede llamarlo además del suyo.
          </P>
        </>
      ),
    },
    {
      id: 'over-stdio',
      title: 'En tu ordenador, por stdio',
      badge: 'stdio',
      color: 'green',
      lead: 'Para Claude Desktop y otros clientes que arrancan un comando.',
      body: <Code lang="json" code={STDIO} />,
    },
    {
      id: 'what-it-may-touch',
      title: 'Lo que puede tocar un asistente',
      badge: 'Seguridad',
      color: 'yellow',
      body: (
        <List
          items={[
            'Solo lo que puede su persona: cada herramienta pasa por las rutas del drive, identify y authorize.',
            'Nada definitivo: puede mandar a la papelera, no borrar; no puede compartir. Lo que hace se puede deshacer desde la papelera o las versiones.',
            'Lo que el servidor rechaza vuelve al modelo en palabras, para que haga otra cosa.',
          ]}
        />
      ),
    },
    {
      id: 'every-tool',
      title: 'Todas las herramientas',
      badge: 'Herramientas',
      color: 'purple',
      lead: 'Lo que hace cada una, traducido. Al asistente se las describe en inglés, que todos los modelos leen.',
      body: (
        <RefTable
          label="Herramientas del drive"
          name="Herramienta"
          rows={toolsIn('es').map((tool) => ({ id: toolId(tool.name), name: tool.name, type: tool.annotations.readOnlyHint ? 'lee' : 'escribe', does: tool.description }))}
        />
      ),
    },
    {
      id: 'word-documents',
      title: 'Documentos de Word, con Rebodocs',
      badge: 'Rebodocs',
      color: 'pink',
      lead: 'Con @rebodocs/mcp instalado, los .docx del drive se leen y editan con las propias herramientas de Rebodocs, cada cambio guardado como una versión.',
      body: (
        <>
          <DocumentTools none="Rebodocs no está instalado donde se construyó este sitio." label="Herramientas de Rebodocs en el drive" name="Herramienta" />
          <Callout title="Un guardado hecho mientras tanto">por otra persona se detecta preguntando al drive justo antes de escribir, y no se sobrescribe.</Callout>
        </>
      ),
    },
  ],
};
