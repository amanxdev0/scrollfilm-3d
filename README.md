<div align="center">

# 🎬 SCROLLFILM

**A 3D film that plays as you scroll.**

A live WebGL "film" runs **under** the page as you scroll, and every word on top of it is **real HTML** — selectable, searchable, accessible. The page ends with a full **reverse-engineering breakdown** of how it was built, with live instruments (an X-ray layer toggle and a real FPS meter).

[![live demo](https://img.shields.io/badge/demo-live-brightgreen?style=flat-square)](https://amanxdev0.github.io/scrollfilm-3d/)
[![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![three.js](https://img.shields.io/badge/three.js-%5E0.160.0-black?style=flat-square)](https://threejs.org/)

[Live demo](https://amanxdev0.github.io/scrollfilm-3d/) · [Report a bug](https://github.com/amanxdev0/scrollfilm-3d/issues)

</div>

---

## The four acts

1. **Nebula drift** — particle starfield, slow push-in
2. **The planet** — wireframe icosahedron, orbital camera
3. **The tunnel** — a dive through glowing rings (the film-strip metaphor)
4. **Terrain + finale** — wireframe wave-terrain at dusk, crane pull-back, gold ring

## The technique (the whole trick)

1. **Fixed canvas, tall page.** The film is a `<canvas>` with `position: fixed`. The body is ~700vh tall — that height *is* the timeline.
2. **Scroll is the playhead.** `target = scrollY / (scrollHeight - innerHeight)` gives one number, 0 → 1. Camera path, color grade, fog and object visibility are all pure functions of it.
3. **Interpolation, not snapping.** Scroll events arrive janky (~20 Hz on a busy laptop). The render loop eases the *rendered* playhead toward the *target* every frame with frame-rate-independent damping:

   ```js
   const k = 1 - Math.exp(-dt * 5.5);
   smooth += (target - smooth) * k;
   ```

   Janky input in, buttery motion out — this is what holds 40+ fps on a normal laptop.
4. **Real HTML on top.** Chapters are ordinary sections; each fades in only while the playhead is inside its range. Film and words stay in sync because they read the same number.

## Performance design

- **One procedural scene** — additive point clouds, wireframes, no post-processing, no shadows, no video decode.
- **Adaptive resolution** — pixel ratio steps down if fps drops below ~34, back up past ~57.
- **Live FPS meter** in the HUD and the blueprint lab proves the frame rate on *your* machine.
- **`prefers-reduced-motion`** renders a single still frame and shows all text statically.
- Graceful **no-WebGL fallback**: the film hides, every word remains.

## Run it

Any static server works — no video files, no build step:

```bash
cd scrollfilm-3d
python3 -m http.server 8000
# → http://localhost:8000
```

Or deploy to **GitHub Pages**: repo Settings → Pages → Deploy from branch → `main` / root.

## Files

| File | What |
|---|---|
| `index.html` | Structure: fixed canvas, HUD film-player chrome, chapters, reverse-engineering blueprint |
| `css/style.css` | Dark cinematic theme, sticky chapters, X-ray mode, responsive |
| `js/film.js` | Three.js film (4 acts), scroll-interpolation engine, FPS meter, adaptive quality, lab controls |

## The Scroll Series

Part of Aman Singh's scroll-driven cinematic universe — real HTML floating over live 3D films, where scroll is the playhead:

- [SCROLLFILM](https://amanxdev0.github.io/scrollfilm-3d/) — the original cinematic WebGL film + full reverse-engineering breakdown
- [HELIOS](https://amanxdev0.github.io/helios/) — scroll from the Milky Way to Pluto
- [ABYSS](https://amanxdev0.github.io/ABYSS/) — descend through the five ocean zones to Challenger Deep
- [EVENT HORIZON](https://amanxdev0.github.io/event-horizon/) — dive into the heart of a black hole
- [RAMAYANA](https://amanxdev0.github.io/ramayana/) — a 3D flight through the Valmiki Ramayana

Built with the [scrollfilm engine](https://github.com/amanxdev0/scrollfilm) — make your own.

## License

MIT © Aman Singh — steal the loop, it's the point.
