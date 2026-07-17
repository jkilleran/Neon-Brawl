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
| Retroceder / avanzar | `A` / `D` | `←` / `→` |
| Guardia alta | `W` | `↑` |
| Guardia baja | `S` | `↓` |
| Puño izquierdo | `U` | `N` |
| Puño derecho | `I` | `M` |
| Patada izquierda | `J` | `,` |
| Patada derecha | `K` | `.` |
| Modificador al cuerpo | Mantener `Espacio` + golpe | Mantener `Espacio` + golpe |
| Pausa | `Esc` | `Esc` |

Sin modificador, los cuatro golpes apuntan a la cabeza. Mantén `Espacio` al presionar cualquiera de ellos para cambiar su trayectoria y animación hacia el cuerpo.

Los derribos y el control en el suelo están temporalmente desactivados. Su implementación permanece en el motor detrás de `FEATURES.takedowns` para recuperarla cuando las animaciones de grappling estén listas.

## Sistemas incluidos

- Daño independiente de cabeza y cuerpo
- Stamina que afecta velocidad, potencia y defensa
- Guardia alta y baja contextual
- Ocho variantes de ataque: puño/patada izquierda y derecha a cabeza o cuerpo
- Diez frames por variante, con contacto, recuperación y retorno a guardia
- Veinte frames de desplazamiento y veinte de guardias alta/baja
- Diez frames de reacción al golpe para cabeza y diez para cuerpo
- Colisiones anatómicas de cabeza y cuerpo con impacto en el punto exacto
- Controles completos visibles desde el menú de pausa
- Lógica de derribos y ground-and-pound preservada, pero desactivada
- Knockdowns y finalizaciones por KO/TKO
- Tres asaltos con puntuación 10-9 y decisión
- Rival controlado por computadora
- Ocho hojas de ataque independientes con diez frames etiquetados por movimiento
- Dirección canónica y espejo determinista para que ambos luchadores golpeen hacia el rival
- Jab izquierdo al cuerpo y cross derecho al cuerpo con siluetas y rotaciones diferenciadas
- Modelos v5 aprobados para patada derecha alta, patada derecha al cuerpo y puño izquierdo al cuerpo
- Extremidad atacante bloqueada por movimiento para impedir cambios de mano o pierna entre frames
- Celdas alfa aisladas para impedir pies, brazos o fragmentos flotantes entre frames
- Catálogo modular en [`docs/animation-catalog.md`](docs/animation-catalog.md)

## Validación

```bash
npm run check
npm test
npm run build
```

## Actualizaciones por ZIP

Las entregas locales se distribuyen como un ZIP que contiene uno o más parches Git numerados. Después de descargarlo, se descomprime en `~/Downloads`, se aplican en orden sobre `agent/mma-light-gameplay-v2` con `git am --3way`, se ejecutan las pruebas y se sube la misma rama. Este flujo no crea pull requests ni modifica `main`.

## Tecnología

- Canvas 2D
- Web Audio API
- JavaScript sin motor externo
- Vite para desarrollo local

## Licencia

MIT
