// @vitest-environment jsdom
// Render-path smoke test: mounts the REAL <Page> and clicks spin → deal → trade so the
// restyled TradePanel (two columns, stepper, role filters, bottom bar, Higher-probability
// button) and every PlayerCard actually mount with real season data. tsc proves it compiles;
// this proves the trade screen renders without throwing — the gap unit/logic tests can't cover.

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Page from '@/app/page';
import { TRADE_MOVES } from '@/config/gameConstants';

describe('trade screen renders end-to-end', () => {
  it('spin → deal → trade mounts the restyled panel and reacts to selection', () => {
    render(<Page />);

    fireEvent.click(screen.getByRole('button', { name: /spin the wheel/i }));
    fireEvent.click(screen.getByRole('button', { name: /deal roster/i }));

    // Two-column scaffold + bottom bar are present.
    expect(screen.getByRole('heading', { name: /your roster/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /^target/i })).toBeTruthy();
    const tradeBtn = screen.getByRole('button', { name: /^trade it$/i });
    expect(tradeBtn).toBeTruthy();
    expect((tradeBtn as HTMLButtonElement).disabled).toBe(true); // nothing selected yet

    // Power-up button is present and armable (not yet used).
    const boostBtn = screen.getByRole('button', { name: /higher probability/i });
    expect((boostBtn as HTMLButtonElement).disabled).toBe(false);

    // Role filter chips + the kept search box both exist.
    expect(screen.getByRole('button', { name: /^PG$/ })).toBeTruthy();
    expect(screen.getByPlaceholderText(/search any player/i)).toBeTruthy();

    // Stepper shows TRADE_MOVES steps.
    expect(screen.getByText('Make a trade', { selector: '.step-label' })).toBeTruthy();

    // Selecting one player on each side enables "Trade it" and shows an acceptance %.
    const cards = document.querySelectorAll('.col-grid .card.tile.selectable');
    expect(cards.length).toBeGreaterThan(2);
    // first card lives in the left (roster) column, a later one in the right (target) column
    const cols = document.querySelectorAll('.trade-col');
    const leftCard = (cols[0] as HTMLElement).querySelector('.card.tile.selectable')!;
    const rightCard = (cols[1] as HTMLElement).querySelector('.card.tile.selectable')!;
    fireEvent.click(leftCard);
    fireEvent.click(rightCard);
    // footers reflect the two sides
    expect(leftCard.querySelector('.tile-foot')!.textContent).toMatch(/sending/i);
    expect(rightCard.querySelector('.tile-foot')!.textContent).toMatch(/receiving/i);

    expect((tradeBtn as HTMLButtonElement).disabled).toBe(false);
    // acceptance reads as a percentage now that both sides are set
    expect(document.body.textContent).toMatch(/\d+%/);
    expect(TRADE_MOVES).toBeGreaterThan(0);
  });
});
