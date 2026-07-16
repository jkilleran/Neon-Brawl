# Neon Brawl MMA

Prototipo de combate MMA super light para navegador. Conserva la estética neon del proyecto original, pero cambia el combate arcade por un sistema inspirado en las decisiones tácticas de un juego de MMA: distancia, stamina, daño a cabeza y cuerpo, guardias, patadas, derribos y puntuación por asaltos.

## Ejecutarlo en Visual Studio Code

```bash
git clone https://github.com/jkilleran/Neon-Brawl.git
cd Neon-Brawl
npm install
npm run dev
```

Abre la dirección que muestre la terminal, normalmente `http://localhost:5173`.

## Controles

| Acción | Jugador 1 | Jugador 2 |
| --- | --- | --- |
| Moverse | `A` / `D` | `←` / `→` |
| Guardia alta | `W` | `↑` |
| Guardia baja | `S` | `↓` |
| Jab | `F` | `K` |
| Cross | `G` | `L` |
| Patada al cuerpo | `R` | `O` |
| Patada a la cabeza | `T` | `P` |
| Derribo | `E` | `I` |
| Evasión | `Espacio` | `/` |
| Pausa | `Esc` | `Esc` |

Durante el control en el suelo, el atacante utiliza sus botones de puño para lanzar ground-and-pound. El defensor usa guardia alta para bloquear y evasión para acelerar el regreso a la pelea de pie.

## Sistemas incluidos

- Daño independiente de cabeza y cuerpo
- Stamina que afecta velocidad, potencia y defensa
- Guardia alta y baja contextual
- Cinco acciones ofensivas con alcance y tiempo diferentes
- Evasión con ventana breve de invulnerabilidad
- Derribos, defensa de derribo y ground-and-pound
- Knockdowns y finalizaciones por KO/TKO
- Tres asaltos con puntuación 10-9 y decisión
- Rival controlado por computadora
- Sprite de personaje con ocho poses y fondo transparente

## Validación

```bash
npm run check
npm test
npm run build
```

## Tecnología

- Canvas 2D
- Web Audio API
- JavaScript sin motor externo
- Vite para desarrollo local

## Licencia

MIT
