import { describe, expect, it } from 'vitest';
import { accepts, readRequest, renamed } from '../src';

describe('a request for files', () => {
  it('is read as given, checked, with what is not said left out', () => {
    expect(readRequest({ title: ' Northwind ', items: ['Contract', { id: 'id', label: 'ID' }], askName: true, maxSize: '1000', accept: ['application/pdf', 'IMAGE/*'] })).toEqual({
      title: 'Northwind',
      items: [
        { id: 'd1', label: 'Contract' },
        { id: 'id', label: 'ID' },
      ],
      askName: true,
      maxSize: 1000,
      accept: ['application/pdf', 'image/*'],
    });
    expect(readRequest(undefined)).toEqual({});
    expect(() => readRequest({ accept: ['pdf'] })).toThrow('types');
    expect(() => readRequest({ email: 'no email' })).toThrow('not an email');
    expect(() => readRequest({ items: [''] })).toThrow('has a name');
    expect(() => readRequest({ fields: { 'a b': 'x' } })).toThrow('field');
  });

  it('takes what it says, by type or by ending', () => {
    const request = readRequest({ accept: ['application/pdf', 'image/*', '.docx'] });
    expect(accepts(request, 'a.pdf', 'application/pdf')).toBe(true);
    expect(accepts(request, 'photo.heic', 'image/heic')).toBe(true);
    expect(accepts(request, 'Letter.DOCX', 'application/octet-stream')).toBe(true);
    expect(accepts(request, 'notes.txt', 'text/plain')).toBe(false);
    expect(accepts({}, 'anything.bin', 'application/octet-stream')).toBe(true);
  });

  it('names what comes by its pattern, its ending kept and nothing a name may not have', () => {
    const request = readRequest({ rename: '{item} - {name} ({date})' });
    expect(renamed(request, { name: 'scan.PDF', item: 'Contract', from: 'Carla', at: '2026-10-27T10:00:00Z' })).toBe('Contract - Carla (2026-10-27).PDF');
    expect(renamed(request, { name: 'scan.pdf', item: 'A/B', from: 'C:D', at: '2026-10-27T10:00:00Z' })).toBe('A-B - C-D (2026-10-27).pdf');
    expect(renamed(readRequest({ rename: '{item} - {name}' }), { name: 'photo.jpg', at: '2026-10-27T10:00:00Z' })).toBe('photo.jpg');
    expect(renamed({}, { name: 'kept.pdf', at: '' })).toBe('kept.pdf');
  });
});
