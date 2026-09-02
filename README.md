# TimeBridge

Find meeting and calling times that respect everyone's local schedule.

TimeBridge combines a simple time converter, live world clocks, a visual
24-hour chart, a fair meeting planner, and a sourced time knowledge base. It
runs entirely in the browser: no account, backend, analytics, or uploaded
personal data.

## Features

- Five focused views: Home, Calculator, World Clock, Visual Chart, and Learn
- Plain-language “I’m here; what time is it there?” conversion
- Live EST/EDT, CST/CDT, MST/MDT, and PST/PDT labels based on the actual date
- Addable world clocks with local date, UTC offset, abbreviation, and day phase
- A synchronized chart of the next 24 hours across selected locations
- Current local time and UTC offset for every location
- Personal availability windows, including overnight schedules
- A visual 24-hour comparison anchored to the first location
- Meeting-length filtering for 30-, 60-, 90-, and 120-minute calls
- Fair-time ranking across the next 1, 7, or 14 days
- Weekly fairness rotations for 4, 8, or 12 recurring meetings
- Daylight-saving-aware calculations using the browser's `Intl` API
- Shareable plans encoded in the URL
- Responsive, keyboard-friendly interface
- Dependency-free production code

## How fair-time ranking works

TimeBridge first rejects any start time that cannot fit the full meeting inside
every person's availability. It then ranks the remaining options by maximizing
the smallest buffer between the meeting and anyone's availability boundary.
That max-min approach avoids improving one person's time by pushing somebody
else against the beginning or end of their day. Ties favor options closest to
the centers of everyone's schedules, followed by the earlier date.

For recurring meetings, TimeBridge carries each participant's inconvenience
forward from week to week. Every new choice minimizes the highest projected
cumulative burden, then the gap between participants. This naturally rotates
early and late calls when schedules allow it.

## Run locally

TimeBridge requires Node.js 20 or newer.

```sh
npm run dev
```

Open <http://127.0.0.1:4173>.

## Verify a change

```sh
npm run check
npm test
npm run build
```

## Deploy on Netlify

Import this repository into Netlify. The included `netlify.toml` supplies the
build command, publish directory, Node version, security headers, and fallback.
No environment variables are required.

## Project documents

- [Product brief](docs/PRODUCT.md)
- [Roadmap](docs/ROADMAP.md)
- [Knowledge-base sources](docs/KNOWLEDGE_SOURCES.md)
- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## License

[MIT](LICENSE)
