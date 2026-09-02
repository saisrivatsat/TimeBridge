# TimeBridge

Find meeting and calling times that respect everyone's local schedule.

TimeBridge compares a calendar day across up to six IANA time zones, highlights
continuous overlaps, and produces a shareable plan. It runs entirely in the
browser: no account, backend, analytics, or uploaded personal data.

## Features

- Current local time and UTC offset for every location
- Personal availability windows, including overnight schedules
- A visual 24-hour comparison anchored to the first location
- Daylight-saving-aware calculations using the browser's `Intl` API
- Shareable plans encoded in the URL
- Responsive, keyboard-friendly interface
- Dependency-free production code

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
- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## License

[MIT](LICENSE)
