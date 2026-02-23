import { describe, expect, it } from 'vitest';
import { TfLScraper } from '../../src/infrastructure/tflScraper';

describe('TfLScraper', () => {
  it('parses history table rows', () => {
    document.body.innerHTML = `
      <table><tbody>
        <tr>
          <td>2025-01-10</td><td>A</td><td>B</td><td>20</td><td>40</td><td>PAYG</td><td>2</td>
        </tr>
      </tbody></table>
    `;

    const scraper = new TfLScraper();
    const journeys = scraper.parseJourneyRows(document);
    expect(journeys).toHaveLength(1);
    expect(journeys[0].delayMinutes).toBe(20);
  });
});
