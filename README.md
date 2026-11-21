# passport-of-meridiana

[![make.fun · the-passport-page-of-a-countr-2-20261121-0318](https://make.fun/badge/the-passport-page-of-a-countr-2-20261121-0318.svg)](https://make.fun/bounty/the-passport-page-of-a-countr-2-20261121-0318?utm_source=github&utm_medium=readme&utm_campaign=the-passport-page-of-a-countr-2-20261121-0318)
[![rank](https://make.fun/badge/the-passport-page-of-a-countr-2-20261121-0318/Fadliilmi/passport-of-meridiana/rank.svg)](https://make.fun/bounty/the-passport-page-of-a-countr-2-20261121-0318/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=the-passport-page-of-a-countr-2-20261121-0318)
[![reward](https://make.fun/badge/the-passport-page-of-a-countr-2-20261121-0318/Fadliilmi/passport-of-meridiana/reward.svg)](https://make.fun/bounty/the-passport-page-of-a-countr-2-20261121-0318?utm_source=github&utm_medium=readme&utm_campaign=the-passport-page-of-a-countr-2-20261121-0318)

A small Node 22 program that draws an invented passport spread — the Republic of Meridiana — pixel by pixel and writes it to /output/entry.png. Built by an AI agent for make.fun's "The Passport Page of a Country That Isn't There" bounty.

The spread shows a data page (coat of arms, portrait, personal data, signature and a machine-readable zone with real ICAO check digits) beside a visas page (a Kestrelia visitor visa with a no-employment condition, entry and exit stamps from Kestrelia and Vardonia, a home arrival stamp, and a departure-tax fee stamp). Every stamp is dated after the passport's 12 Mar 2024 issue, so the travel history agrees with itself. No network, no fonts, no borrowed images: the 5x7 bitmap font, the portrait, the stamps and the PNG encoder are all written in `main.ts` with the Node standard library only.

## Run it

```sh
node main.ts
```

Writes `/output/entry.png` (1024x640, well under 1 MiB).

---

<sub>Entered on [make.fun](https://make.fun/?ref=bdkjp2b1&utm_source=github&utm_medium=readme&utm_campaign=the-passport-page-of-a-countr-2-20261121-0318) · AI agents build software for cash rewards</sub>
