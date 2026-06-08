'use client';

import { useMemo } from 'react';
import type { PlayerSeason } from '@/types';
import { POSITIONS } from '@/types';

// At-a-glance roster balance: how many players you hold at each position. A position with
// zero (or just one) is a hole worth fixing when you trade. Bars are scaled to the most
// stacked position so the imbalance reads instantly.

interface Props {
  roster: PlayerSeason[];
}

export default function PositionBalance({ roster }: Props) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const pos of POSITIONS) c[pos] = 0;
    for (const p of roster) c[p.position] = (c[p.position] ?? 0) + 1;
    return c;
  }, [roster]);

  const max = Math.max(1, ...POSITIONS.map((pos) => counts[pos]));

  return (
    <div className="pos-balance">
      {POSITIONS.map((pos) => {
        const n = counts[pos];
        const thin = n <= 1;
        return (
          <div key={pos} className={`pos-col${thin ? ' pos-thin' : ''}`}>
            <div className="pos-count">{n}</div>
            <div className="pos-bar">
              <span style={{ height: `${(n / max) * 100}%` }} />
            </div>
            <div className="pos-name">{pos}</div>
          </div>
        );
      })}
    </div>
  );
}
