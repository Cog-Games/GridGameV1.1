# Mobile 2P3G Grid World

This adds a standalone cell-phone-friendly version of the two-player/three-goal grid-world game.

## What it does

- Uses a smaller 9 × 9 map.
- Pairs two players automatically through Socket.IO.
- Runs four 2P3G rounds.
- Shows two initial blue goals; a third green goal appears when both players move toward the same initial goal.
- Uses large touch-screen arrow buttons, with keyboard arrows/WASD still available for desktop testing.
- Ends with three post-game questions.
- Saves trial logs, summaries, and survey responses as JSONL files in `data/`.

## Run locally

```bash
npm install
npm run mobile
```

Then open this page on two phones or two browser windows:

```text
http://localhost:4000/mobile
```

For phone testing from another device on the same Wi-Fi, replace `localhost` with your computer's local IP address, for example:

```text
http://192.168.1.23:4000/mobile
```

## Output files

The mobile server writes:

- `data/mobile-2p3g-trials.jsonl`
- `data/mobile-2p3g-summaries.jsonl`
- `data/mobile-2p3g-surveys.jsonl`

Each line is one JSON record, so it is easy to import into R/Python.

## Files added

- `server-mobile.js` — standalone mobile Socket.IO server.
- `mobile_2p3g.html` — mobile UI.
- `js/mobile2p3g.js` — touch-control client logic.
