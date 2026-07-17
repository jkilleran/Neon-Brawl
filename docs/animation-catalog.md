# Catálogo de animaciones

Este catálogo es la referencia para arte, lógica y pruebas. Los metadatos consumidos por el juego viven en `animation-manifest.js`.

## Convención de producción

- Cada movimiento de ataque tiene **exactamente 10 frames** y su propio PNG.
- Todas las fuentes atacan hacia la **derecha de la pantalla**.
- El motor refleja la hoja completa cuando el rival está a la izquierda; no se mantienen copias duplicadas para P1/P2.
- La dirección se bloquea al iniciar el ataque, de modo que un cruce de posiciones no puede invertir el golpe a mitad de la animación.
- Las hojas de ataque usan una cuadrícula `4 × 3`: frames 1–10 en orden de lectura y dos celdas transparentes reservadas.
- Contacto: frame **6** para puños y ataques al cuerpo; frame **4** para las dos patadas altas, según su pose visual real.

## Fases por frame

| Frame | Etiqueta | Función |
| ---: | --- | --- |
| 1 | `guard` | Guardia inicial |
| 2 | `anticipation` | Anticipación |
| 3 | `load` | Carga de peso o nivel |
| 4 | `extension-1` | Primera extensión |
| 5 | `extension-2` | Extensión previa al impacto |
| 6 | `contact` | Contacto visual y colisión |
| 7 | `recoil-1` | Primer retroceso |
| 8 | `recoil-2` | Segundo retroceso |
| 9 | `recovery` | Recuperación |
| 10 | `guard-return` | Regreso a guardia |

## Ataques registrados

| ID de lógica | Nombre visible | Extremidad | Objetivo | Contacto | P1 | P2 | Archivo |
| --- | --- | --- | --- | ---: | --- | --- | --- |
| `leftPunchHead` | LEFT PUNCH // HEAD | mano izquierda | cabeza | 6 | `U` | `N` | `left-punch-head-v3.png` |
| `rightPunchHead` | RIGHT PUNCH // HEAD | mano derecha | cabeza | 6 | `I` | `M` | `right-punch-head-v3.png` |
| `leftPunchBody` | LEFT PUNCH // BODY | mano izquierda | cuerpo | 6 | `Space + U` | `Space + N` | `left-punch-body-v3.png` |
| `rightPunchBody` | RIGHT PUNCH // BODY | mano derecha | cuerpo | 6 | `Space + I` | `Space + M` | `right-punch-body-v3.png` |
| `leftKickHead` | LEFT KICK // HEAD | pierna izquierda | cabeza | 4 | `J` | `,` | `left-kick-head-v3.png` |
| `rightKickHead` | RIGHT KICK // HEAD | pierna derecha | cabeza | 4 | `K` | `.` | `right-kick-head-v3.png` |
| `leftKickBody` | LEFT KICK // BODY | pierna izquierda | cuerpo | 6 | `Space + J` | `Space + ,` | `left-kick-body-v3.png` |
| `rightKickBody` | RIGHT KICK // BODY | pierna derecha | cuerpo | 6 | `Space + K` | `Space + .` | `right-kick-body-v3.png` |

Ruta común: `public/assets/animations/strikes/`.

## Animaciones no ofensivas conservadas

| ID | Hoja | Segmentos |
| --- | --- | --- |
| `hitReactions` | `anim-hit-reactions-v2.png` | cabeza 0–9, cuerpo 10–19 |
| `footwork` | `anim-footwork-v2.png` | avance 0–9, retroceso 10–19 |
| `guards` | `anim-guards-v2.png` | alta 0–9, baja 10–19 |
| `legacy` | `fighter-mma-sprites.png` | lógica de derribos preservada y desactivada |

## Verificación

`npm run check` valida que no falte ningún archivo, que cada ataque tenga diez etiquetas, que cada hoja tenga dimensiones divisibles por su cuadrícula y que los PNG conserven transparencia.
