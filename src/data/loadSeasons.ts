// Static data access. JSON is bundled at build time — the game never fetches at runtime.
// Covers every season the wheel can land on (1984–2026). Adding a season = drop its JSON
// in data/seasons, add one import + one SEASONS entry here, and widen an ERA_PACK.

import type { SeasonData } from '@/types';
import s1984 from '../../data/seasons/1984.json';
import s1985 from '../../data/seasons/1985.json';
import s1986 from '../../data/seasons/1986.json';
import s1987 from '../../data/seasons/1987.json';
import s1988 from '../../data/seasons/1988.json';
import s1989 from '../../data/seasons/1989.json';
import s1990 from '../../data/seasons/1990.json';
import s1991 from '../../data/seasons/1991.json';
import s1992 from '../../data/seasons/1992.json';
import s1993 from '../../data/seasons/1993.json';
import s1994 from '../../data/seasons/1994.json';
import s1995 from '../../data/seasons/1995.json';
import s1996 from '../../data/seasons/1996.json';
import s1997 from '../../data/seasons/1997.json';
import s1998 from '../../data/seasons/1998.json';
import s1999 from '../../data/seasons/1999.json';
import s2000 from '../../data/seasons/2000.json';
import s2001 from '../../data/seasons/2001.json';
import s2002 from '../../data/seasons/2002.json';
import s2003 from '../../data/seasons/2003.json';
import s2004 from '../../data/seasons/2004.json';
import s2005 from '../../data/seasons/2005.json';
import s2006 from '../../data/seasons/2006.json';
import s2007 from '../../data/seasons/2007.json';
import s2008 from '../../data/seasons/2008.json';
import s2009 from '../../data/seasons/2009.json';
import s2010 from '../../data/seasons/2010.json';
import s2011 from '../../data/seasons/2011.json';
import s2012 from '../../data/seasons/2012.json';
import s2013 from '../../data/seasons/2013.json';
import s2014 from '../../data/seasons/2014.json';
import s2015 from '../../data/seasons/2015.json';
import s2016 from '../../data/seasons/2016.json';
import s2017 from '../../data/seasons/2017.json';
import s2018 from '../../data/seasons/2018.json';
import s2019 from '../../data/seasons/2019.json';
import s2020 from '../../data/seasons/2020.json';
import s2021 from '../../data/seasons/2021.json';
import s2022 from '../../data/seasons/2022.json';
import s2023 from '../../data/seasons/2023.json';
import s2024 from '../../data/seasons/2024.json';
import s2025 from '../../data/seasons/2025.json';
import s2026 from '../../data/seasons/2026.json';

const SEASONS: Record<number, SeasonData> = {
  1984: s1984 as SeasonData,
  1985: s1985 as SeasonData,
  1986: s1986 as SeasonData,
  1987: s1987 as SeasonData,
  1988: s1988 as SeasonData,
  1989: s1989 as SeasonData,
  1990: s1990 as SeasonData,
  1991: s1991 as SeasonData,
  1992: s1992 as SeasonData,
  1993: s1993 as SeasonData,
  1994: s1994 as SeasonData,
  1995: s1995 as SeasonData,
  1996: s1996 as SeasonData,
  1997: s1997 as SeasonData,
  1998: s1998 as SeasonData,
  1999: s1999 as SeasonData,
  2000: s2000 as SeasonData,
  2001: s2001 as SeasonData,
  2002: s2002 as SeasonData,
  2003: s2003 as SeasonData,
  2004: s2004 as SeasonData,
  2005: s2005 as SeasonData,
  2006: s2006 as SeasonData,
  2007: s2007 as SeasonData,
  2008: s2008 as SeasonData,
  2009: s2009 as SeasonData,
  2010: s2010 as SeasonData,
  2011: s2011 as SeasonData,
  2012: s2012 as SeasonData,
  2013: s2013 as SeasonData,
  2014: s2014 as SeasonData,
  2015: s2015 as SeasonData,
  2016: s2016 as SeasonData,
  2017: s2017 as SeasonData,
  2018: s2018 as SeasonData,
  2019: s2019 as SeasonData,
  2020: s2020 as SeasonData,
  2021: s2021 as SeasonData,
  2022: s2022 as SeasonData,
  2023: s2023 as SeasonData,
  2024: s2024 as SeasonData,
  2025: s2025 as SeasonData,
  2026: s2026 as SeasonData,
};

export function getSeason(year: number): SeasonData {
  const data = SEASONS[year];
  if (!data) throw new Error(`No season data for ${year}`);
  return data;
}
