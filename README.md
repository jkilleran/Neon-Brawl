# Neon Brawl MMA

Prototipo de combate MMA super light para navegador. Conserva la estética neon del proyecto original, pero lleva el combate hacia una simulación ligera de striking: distancia, stamina, daño a cabeza y cuerpo, guardias, jabs, patadas y puntuación por asaltos.

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
| Jab izquierdo | `F` | `K` |
| Jab derecho | `G` | `L` |
| Patada al cuerpo | `R` | `O` |
| Patada a la cabeza | `T` | `P` |
| Evasión | `Espacio` | `/` |
| Pausa | `Esc` | `Esc` |

Los derribos y el control en el suelo están temporalmente desactivados. Su implementación permanece en el motor detrás de `FEATURES.takedowns` para recuperarla cuando las animaciones de grappling estén listas.

## Sistemas incluidos

- Daño independiente de cabeza y cuerpo
- Stamina que afecta velocidad, potencia y defensa
- Guardia alta y baja contextual
- Jab izquierdo y jab derecho con trayectorias independientes
- Patadas al cuerpo y cabeza con alcance y timing diferentes
- Seis frames reales para cada golpe y ocho para desplazamiento/guardias
- Colisiones anatómicas de cabeza y cuerpo con impacto en el punto exacto
- Evasión con ventana breve de invulnerabilidad
- Lógica de derribos y ground-and-pound preservada, pero desactivada
- Knockdowns y finalizaciones por KO/TKO
- Tres asaltos con puntuación 10-9 y decisión
- Rival controlado por computadora
- Seis sprite sheets transparentes con 40 frames de animación

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
