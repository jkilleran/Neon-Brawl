# Catálogo de animaciones

Este catálogo es la referencia para arte, lógica y pruebas. Los metadatos consumidos por el juego viven en `animation-manifest.js`.

## Convención de producción

- Cada movimiento de ataque tiene **exactamente 10 frames** y su propio PNG.
- Todas las fuentes atacan hacia la **derecha de la pantalla**.
- El motor refleja la hoja completa cuando el rival está a la izquierda; no se mantienen copias duplicadas para P1/P2.
- La dirección se bloquea al iniciar el ataque, de modo que un cruce de posiciones no puede invertir el golpe a mitad de la animación.
- Las hojas de ataque usan una cuadrícula `4 × 3`: frames 1–10 en orden de lectura y dos celdas transparentes reservadas.
- Cada celda conserva un margen alfa mínimo de 6 px; el validador rechaza piezas que invadan una celda vecina.
- En patadas, la pierna de apoyo se fija en el manifiesto y debe permanecer plantada desde carga hasta retroceso.
- Contacto: frame **6** para puños y para las dos patadas derechas corregidas; la patada alta izquierda conserva contacto en el frame **4**.

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
| `leftPunchBody` | LEFT PUNCH // BODY | mano izquierda | cuerpo | 6 | `Space + U` | `Space + N` | `left-punch-body-v4.png` |
| `rightPunchBody` | RIGHT PUNCH // BODY | mano derecha | cuerpo | 6 | `Space + I` | `Space + M` | `right-punch-body-v4.png` |
| `leftKickHead` | LEFT KICK // HEAD | pierna izquierda | cabeza | 4 | `J` | `,` | `left-kick-head-v3.png` |
| `rightKickHead` | RIGHT KICK // HEAD | pierna derecha | cabeza | 6 | `K` | `.` | `right-kick-head-v4.png` |
| `leftKickBody` | LEFT KICK // BODY | pierna izquierda | cuerpo | 6 | `Space + J` | `Space + ,` | `left-kick-body-v3.png` |
| `rightKickBody` | RIGHT KICK // BODY | pierna derecha | cuerpo | 6 | `Space + K` | `Space + .` | `right-kick-body-v4.png` |

Ruta común: `public/assets/animations/strikes/`.

## Invariantes biomecánicas

| Movimiento | Pierna de golpe | Pierna de apoyo | Frames críticos |
| --- | --- | --- | --- |
| `leftKickHead` | izquierda | derecha | 3–7 |
| `rightKickHead` | derecha | izquierda | 3–8 |
| `leftKickBody` | izquierda | derecha | 3–7 |
| `rightKickBody` | derecha | izquierda | 3–8 |

En `rightKickHead` y `rightKickBody`, el frame 6 conserva explícitamente el pie izquierdo plantado. La pierna derecha sale de la cámara de los frames 3–4, impacta en 6 y vuelve a cámara en 7–8; no puede intercambiarse con la pierna de apoyo.

## Animaciones no ofensivas conservadas

| ID | Hoja | Segmentos |
| --- | --- | --- |
| `hitReactions` | `animations/support/hit-reactions-v3.png` | cabeza 0–9, cuerpo 10–19 |
| `footwork` | `animations/support/footwork-v3.png` | avance 0–9, retroceso 10–19 |
| `guards` | `animations/support/guards-v3.png` | alta 0–9, baja 10–19 |
| `legacy` | `fighter-mma-sprites.png` | lógica de derribos preservada y desactivada |

## Verificación

`npm run check` valida archivos, etiquetas, dimensiones, transparencia, celdas reservadas vacías y un margen alfa mínimo por frame. `node scripts/normalize-support-sheets.cjs` reconstruye las hojas de soporte desde sus fuentes v2 sin que pies o brazos crucen los límites de celda.
