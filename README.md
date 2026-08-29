# Cossert v0.1 — Tic Tac Toe

A real browser project written around the original **Cossert** `.cos` language.

## Files

Keep all four files in the repository root:

- `index.html`
- `interpreter.js`
- `game.cos`
- `README.md`

## Run

On macOS:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Or upload the four root files to GitHub and enable GitHub Pages.

## Important

The Tic-Tac-Toe rules are written in `game.cos`. `index.html` only provides a console UI and `interpreter.js` executes Cossert.

This demo exercises:

- `YO HOWSURDOIN 0.1`
- `OKALFINEBYE`
- `GET ... LETITB`
- `"x" CHANGETO-> ...`
- `SPITOUT(...)`
- `YO USER DILE(...)`
- `HMM WATIF(...)`
- `GOAROUND ... TIMES:`
- `SKIPTIS`
- `FRGETABTIT`
- `ELLO ... YOUR NOW DOIN {...}`
- `FINALANSER(...)`
- `HAV A LIST "name" LIKE [...]`
- `TAKITOUT{list}[id]`
- `UREPLACEIT{list}[id] W/value`
- `YO COMBINE ... W/...`
- `IWANNACOMENT:` / `COMENT FINISH`

Cossert intentionally has no `else if`.
