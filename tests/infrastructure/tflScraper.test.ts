import { describe, expect, it } from 'vitest';
import { TfLScraper } from '../../src/infrastructure/tflScraper';

function historyRow({
  date = '2025-01-10',
  from = 'A',
  to = 'B',
  expected = '20',
  actual = '40',
  ticket = 'PAYG',
  zones = '2'
} = {}) {
  return `<tr><td>${date}</td><td>${from}</td><td>${to}</td><td>${expected}</td><td>${actual}</td><td>${ticket}</td><td>${zones}</td></tr>`;
}

describe('TfLScraper', () => {
  it('returns empty list for empty page', () => {
    document.body.innerHTML = '<div>No table</div>';
    expect(new TfLScraper().parseJourneyRows(document)).toEqual([]);
  });

  it('parses history table rows with numeric coercion', () => {
    document.body.innerHTML = `<table><tbody>${historyRow()}</tbody></table>`;

    const journeys = new TfLScraper().parseJourneyRows(document);
    expect(journeys).toHaveLength(1);
    expect(journeys[0].delayMinutes).toBe(20);
    expect(journeys[0].zonesCrossed).toBe(2);
  });

  it('handles malformed DOM rows and skips unusable entries', () => {
    document.body.innerHTML = `
      <table><tbody>
        <tr><td></td></tr>
        <tr><td>Bad</td><td>No station pair</td></tr>
        ${historyRow({ from: '', to: '' })}
      </tbody></table>
    `;

    const journeys = new TfLScraper().parseJourneyRows(document);
    expect(journeys).toHaveLength(1);
    expect(journeys[0].from).toBe('');
  });

  it('parses statement-action rows and ignores touch/bus events', () => {
    document.body.innerHTML = `
      <table><tbody>
        <tr><td>10 January 2025</td><td>Statement heading</td></tr>
        <tr><td>08:00 - 08:20</td><td>Paddington to Baker Street</td><td></td><td></td></tr>
        <tr><td>08:30 - 08:35</td><td>Touch in at station</td><td></td><td></td></tr>
        <tr><td>09:00 - 09:20</td><td>Bus Journey</td><td></td><td></td></tr>
      </tbody></table>
    `;

    const journeys = new TfLScraper().parseJourneyRows(document);
    expect(journeys).toHaveLength(1);
    expect(journeys[0].source).toBe('statement-action');
    expect(journeys[0].delayMinutes).toBe(15);
  });

  it('survives unexpected HTML structure changes without throwing', () => {
    document.body.innerHTML = '<table><tbody><tr><th>Header only</th></tr><tr></tr></tbody></table>';

    expect(() => new TfLScraper().parseJourneyRows(document)).not.toThrow();
    expect(new TfLScraper().parseJourneyRows(document)).toEqual([]);
  });

  it('handles large pages (200+ journeys) deterministically', () => {
    const rows = Array.from({ length: 220 }, (_, i) =>
      historyRow({ date: `2025-01-${String((i % 27) + 1).padStart(2, '0')}`, from: `A${i}`, to: `B${i}` })
    ).join('');
    document.body.innerHTML = `<table><tbody>${rows}</tbody></table>`;

    const journeys = new TfLScraper().parseJourneyRows(document);
    expect(journeys).toHaveLength(220);
    expect(journeys[219].from).toBe('A219');
  });

  it('handles partial journey rows with missing selectors by skipping safely', () => {
    document.body.innerHTML = '<table><tbody><tr><td>2025-01-10</td><td>A</td></tr></tbody></table>';

    const journeys = new TfLScraper().parseJourneyRows(document);
    expect(journeys).toEqual([]);
  });
});
