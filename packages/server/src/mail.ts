// Reminders of a request for files, sent by mail: what each says, in the
// language of the drive, and a way to send it. Resend's, by its HTTP API with
// no SDK, or yours (SMTP with nodemailer, SES, Postmark): anything that takes
// { to, subject, text, html }.

import type * as core from '@rebofiles/core';

/** A mail, as any service sends one. */
export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type SendMail = (mail: Mail) => Promise<void> | void;

/** Of a request for files sent to someone and open: who, what is still missing, and the token of its link. */
export interface Reminder {
  email: string;
  folder: { id: core.EntryId; name: string; owner: string };
  link: core.Link;
  request: core.FileRequest;
  missing: core.RequestItem[];
  /** What goes in the address of the page of the link. */
  token: string;
  /** The name of the organisation, as the settings say it; null for none. */
  company: string | null;
  language: core.Language;
}

/** Mails sent by Resend (resend.com), with a key of its and an address of a domain checked there. */
export function resend(options: { apiKey: string; from: string; fetch?: typeof fetch }): SendMail {
  const send = options.fetch ?? fetch;
  return async (mail) => {
    const answer = await send('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${options.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: options.from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
    });
    if (!answer.ok) throw new Error(`Resend said ${answer.status}: ${(await answer.text()).slice(0, 300)}`);
  };
}

const WORDS = {
  en: {
    subject: (what: string) => `Reminder: ${what}`,
    hello: 'Hello,',
    still: (who: string | null) => `${who ?? 'We'} ${who ? 'is' : 'are'} still waiting for these documents:`,
    any: (who: string | null) => `${who ?? 'We'} ${who ? 'is' : 'are'} still waiting for your files.`,
    send: 'Send them here',
    until: (date: string) => `The link works until ${date}.`,
  },
  es: {
    subject: (what: string) => `Recordatorio: ${what}`,
    hello: 'Hola:',
    still: (who: string | null) => (who ? `${who} sigue esperando estos documentos:` : 'Seguimos esperando estos documentos:'),
    any: (who: string | null) => (who ? `${who} sigue esperando tus archivos.` : 'Seguimos esperando tus archivos.'),
    send: 'Envíalos aquí',
    until: (date: string) => `El enlace funciona hasta el ${date}.`,
  },
  zh: {
    subject: (what: string) => `提醒：${what}`,
    hello: '您好：',
    still: (who: string | null) => `${who ?? '我们'}仍在等待以下文件：`,
    any: (who: string | null) => `${who ?? '我们'}仍在等待您的文件。`,
    send: '在此发送',
    until: (date: string) => `链接有效期至 ${date}。`,
  },
} as const;

const escaped = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** What a reminder says, in its language: what is missing and the address to send it. */
export function reminderMail(reminder: Reminder, url: string): Mail {
  const words = WORDS[reminder.language] ?? WORDS.en;
  const who = reminder.company;
  const what = reminder.request.title ?? reminder.folder.name;
  const date = reminder.link.expires.slice(0, 10);
  const lead = reminder.missing.length ? words.still(who) : words.any(who);
  const text = [words.hello, '', lead, ...reminder.missing.map((item) => `- ${item.label}`), '', `${words.send}: ${url}`, words.until(date)].join('\n');
  const html = [
    `<p>${escaped(words.hello)}</p>`,
    `<p>${escaped(lead)}</p>`,
    reminder.missing.length ? `<ul>${reminder.missing.map((item) => `<li>${escaped(item.label)}</li>`).join('')}</ul>` : '',
    `<p><a href="${escaped(url)}">${escaped(words.send)}</a></p>`,
    `<p style="color:#6b6964">${escaped(words.until(date))}</p>`,
  ].join('');
  return { to: reminder.email, subject: words.subject(what), text, html };
}

/** The `reminders` of the server, by mail: each reminder written by `reminderMail` and sent by `mail`, to `url` of the token. */
export const mailReminders = (options: { mail: SendMail; url: (token: string) => string }) => ({
  send: (reminder: Reminder) => options.mail(reminderMail(reminder, options.url(reminder.token))),
});
