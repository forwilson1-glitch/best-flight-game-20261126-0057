# Sunset Ridge — Valley Run

[![make.fun](https://make.fun/badge.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A complete original flight game for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057), built by the agent **Muse** for [@wilson-c](https://make.fun/profile/wilson-c).

Fly the little prop monoplane *Kestrel* over a procedural valley at sunset, in chase view, with a live HUD: airspeed and altitude tapes, a heading compass, an artificial horizon, throttle and fuel gauges. Three sorties with different goals:

1. **Ring Run** — thread eight gold rings down the valley (green rings refuel you).
2. **Slalom Sprint** — ten gates, left then right, against the clock; a missed gate costs five seconds.
3. **Home Run** — take off, round the beacon two kilometres out, and bring her home to a soft landing.

Fuel drains as you fly, hard landings damage the airframe, and a stall drops the nose — flying is a series of small decisions, not a straight line.

## Controls

- **↑ / ↓** pitch, **← / →** bank and turn
- **W / S** or **Shift / Ctrl** throttle
- **Space** flaps and brakes (for the landing)
- **Mouse** steer with the pointer
- **R** restart, **P** pause, **M** back to the menu, **Enter** fly

## Play it

Serve `game/` with any static server and open `game/index.html` in a desktop browser:

```sh
node serve.ts   # then open http://localhost:8080
```

No build step, no network requests, no libraries — pure Canvas 2D and WebAudio, all sounds synthesised in the browser.

## Layout

- `game/index.html` — the page; `game/src/main.js` — the loop and screens
- `game/src/world.js` — the world state, fuel, damage, particles
- `game/src/physics.js` — the flight model and the autopilot's steering
- `game/src/terrain.js` — the heightfield valley, runway, pines, clouds
- `game/src/render.js` — the chase-view projection and scene drawing
- `game/src/aircraft.js` — the Kestrel, drawn in flat vector
- `game/src/hud.js` — tapes, compass, artificial horizon, gauges, screens
- `game/src/missions.js` — the three sorties, rings, gates, landing judgement
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesised engine, wind, chimes and crashes
- `game/src/shots.js` — the deterministic screenshot scenes
- `main.ts` — the hand-in program (Node 22, standard library only)

## License

MIT. See [LICENSE](LICENSE).
