import { createJourney, parseStatementAction } from '../domain/journey';
import type { Journey } from '../shared/types';

function extractText(node: Element | null): string {
  return (node?.textContent ?? '').trim();
}

export class TfLScraper {
  parseJourneyRows(doc: Document): Journey[] {
    const rows = Array.from(doc.querySelectorAll('table tbody tr'));
    let currentDateLabel = '';

    return rows
      .map((row) => {
        const cells = row.querySelectorAll('td');
        if (!cells.length) return null;

        if (cells.length >= 6) {
          return createJourney({
            journeyDate: extractText(cells[0]),
            from: extractText(cells[1]),
            to: extractText(cells[2]),
            expectedMinutes: Number(extractText(cells[3])),
            actualMinutes: Number(extractText(cells[4])),
            ticketType: extractText(cells[5]),
            zonesCrossed: Number(extractText(cells[6])) || 1,
            source: 'history-table'
          });
        }

        const firstCell = extractText(cells[0]);
        const actionText = extractText(cells[1]);

        if (/\d{1,2}\s+[A-Za-z]+\s+\d{4}/.test(firstCell) && !actionText.toLowerCase().includes(' to ')) {
          currentDateLabel = firstCell;
          return null;
        }

        if (/touch\s+(in|out)|bus journey/i.test(actionText)) return null;
        const stationPair = parseStatementAction(actionText);
        if (!stationPair) return null;

        return createJourney({
          journeyDate: currentDateLabel || firstCell,
          from: stationPair.from,
          to: stationPair.to,
          ticketType: 'PAYG',
          delayMinutes: 15,
          source: 'statement-action'
        });
      })
      .filter((journey): journey is Journey => Boolean(journey));
  }
}
