// The least a screen needs without a framework: `h` makes elements, and
// `morph` makes the page what a new rendering says by changing what differs,
// in place. What stays is the same element, so what has the focus keeps it,
// a selection in a field stays, and a picture is not loaded again. Children
// with a `key` are matched by it; the others by their place.

type Handler = (event: Event) => void;

export type Child = Node | string | number | false | null | undefined | Child[];

export interface Props {
  /** What matches this element in the next rendering, among its siblings. */
  key?: string;
  /** Called once it is in the page, not when it is only changed: to open a dialog, or to give the focus. */
  mount?: (element: HTMLElement) => void;
  class?: string;
  style?: string;
  [name: string]: unknown;
}

interface Made {
  __key?: string;
  __on?: Record<string, Handler>;
  __mount?: (element: HTMLElement) => void;
  __value?: unknown;
}

const SVG = 'http://www.w3.org/2000/svg';

/** One listener per event and element, which calls whatever handler the last rendering gave. */
function listen(element: Element & Made, event: string, handler: Handler | undefined) {
  element.__on ??= {};
  if (!(event in element.__on)) element.addEventListener(event, (e) => element.__on?.[event]?.(e));
  element.__on[event] = handler as Handler;
}

function apply(element: Element & Made, props: Props) {
  for (const [name, value] of Object.entries(props)) {
    if (name === 'key') element.__key = value as string;
    else if (name === 'mount') element.__mount = value as Made['__mount'];
    else if (name.startsWith('on') && typeof value === 'function') listen(element, name.slice(2).toLowerCase(), value as Handler);
    else if (name === 'value') element.__value = value;
    else if (name === 'class') element.setAttribute('class', String(value));
    // aria-* and data-* say "true" and "false"; other attributes are there or not.
    else if (value === undefined || value === null || (value === false && !/^(aria|data)-/.test(name))) continue;
    else element.setAttribute(name, value === true && !/^(aria|data)-/.test(name) ? '' : String(value));
  }
}

function append(parent: Node, children: Child[]) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function h(tag: string, props: Props | null = null, ...children: Child[]): HTMLElement {
  const element = document.createElement(tag) as HTMLElement & Made;
  if (props) apply(element, props);
  append(element, children);
  if ('__value' in element) (element as unknown as HTMLInputElement).value = String(element.__value ?? '');
  return element;
}

/** An element of SVG, as icons are drawn. */
export function s(tag: string, attributes: Record<string, string | number>, ...children: Child[]): SVGElement {
  const element = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  append(element, children);
  return element;
}

/** Whatever is new in the page, its `mount` called once it is there. */
function mounted(node: Node) {
  if (!(node instanceof Element)) return;
  for (const element of [node, ...node.querySelectorAll('*')] as (Element & Made)[]) element.__mount?.(element as HTMLElement);
}

const keyOf = (node: Node) => (node as Node & Made).__key;
const same = (a: Node, b: Node) => a.nodeType === b.nodeType && a.nodeName === b.nodeName && keyOf(a) === keyOf(b);

/** `from`, in the page, made what `to` says: its attributes, its handlers, its value and its children. */
export function morph(from: Node, to: Node): void {
  if (from.nodeType === Node.TEXT_NODE) {
    if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
    return;
  }
  if (!(from instanceof Element) || !(to instanceof Element)) return;
  const old = from as Element & Made;
  const next = to as Element & Made;

  // `open` of a dialog is the browser's, set by showModal and taken by close: not the rendering's to take away.
  for (const { name } of [...old.attributes]) if (!next.hasAttribute(name) && !(name === 'open' && old.nodeName === 'DIALOG')) old.removeAttribute(name);
  for (const { name, value } of [...next.attributes]) if (old.getAttribute(name) !== value) old.setAttribute(name, value);
  for (const [event, handler] of Object.entries(next.__on ?? {})) listen(old, event, handler);
  for (const event of Object.keys(old.__on ?? {})) if (!next.__on || !(event in next.__on)) old.__on![event] = undefined as unknown as Handler;
  old.__mount = next.__mount;

  // A style element is the stylesheet: the same text every time, not walked.
  if (old.nodeName !== 'STYLE') morphChildren(old, next);

  // After the children, so a select has its options before its value is set.
  if ('__value' in next) {
    old.__value = next.__value;
    const field = old as unknown as HTMLInputElement;
    const value = String(next.__value ?? '');
    if (field.value !== value) field.value = value;
  }
}

function morphChildren(parent: Element, next: Element) {
  const olds = [...parent.childNodes];
  const keyed = new Map<string, Node>();
  for (const node of olds) if (keyOf(node) !== undefined) keyed.set(keyOf(node)!, node);
  const used = new Set<Node>();
  let at = 0;
  const wanted = [...next.childNodes];
  // What each new one becomes, first: an old one of its key, or the next old one without a key, of the same kind.
  const matches = wanted.map((want) => {
    let match: Node | undefined;
    if (keyOf(want) !== undefined) match = keyed.get(keyOf(want)!);
    else {
      while (at < olds.length && (used.has(olds[at]) || keyOf(olds[at]) !== undefined)) at++;
      if (at < olds.length && same(olds[at], want)) match = olds[at++];
    }
    if (!match || !same(match, want) || used.has(match)) return undefined;
    used.add(match);
    return match;
  });
  // What goes is taken out before anything is put in its place, so what stays seldom moves: a node moved loses the focus.
  for (const node of olds) if (!used.has(node)) node.parentNode === parent && parent.removeChild(node);
  wanted.forEach((want, i) => {
    const match = matches[i];
    if (match) {
      morph(match, want);
      if (parent.childNodes[i] !== match) parent.insertBefore(match, parent.childNodes[i] ?? null);
    } else {
      parent.insertBefore(want, parent.childNodes[i] ?? null);
      mounted(want);
    }
  });
}

/** The first rendering in its element: its `mount`s called, as for anything new. */
export function first(container: Element, tree: Node) {
  container.replaceChildren(tree);
  mounted(tree);
}
