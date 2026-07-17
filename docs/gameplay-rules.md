# Reglas de gameplay

Este documento registra el balance táctico de Neon Brawl. Los valores ejecutables viven en `GAMEPLAY_RULES`, dentro de `game.js`.

## Asaltos

- Tres asaltos.
- Cada asalto dura 180 segundos (`3:00`).
- La decisión mantiene el sistema 10-9 existente.

## Modo práctica

- `PRACTICE LAB` no tiene límite de tiempo ni termina por KO/TKO.
- Cada impacto muestra su daño final con dos decimales sobre el punto de contacto.
- Los números identifican también impactos `BLOCK` y `CRIT`.
- Al agotarse la salud de cabeza o cuerpo, el dummy recupera automáticamente salud y stamina después de una pausa breve.

## Daño y coste de ataques

- Todo strike de pie aplica `0.5 ×` su daño base.
- Los strikes al cuerpo aplican además `0.85 ×`, un 15% menos que los strikes equivalentes a la cabeza.
- Un strike que conecta limpio o crítico consume `1.0 ×` su coste base de stamina.
- Un strike fallado, evadido o bloqueado consume `1.5 ×` en total: `1.0 ×` al lanzarlo y `0.5 ×` como penalización por ineficiencia.
- El daño final todavía considera distancia, stamina actual, límite de stamina y situación de counter.

## Stamina en dos capas

La misma barra representa dos valores:

- Tramo brillante: stamina inmediata disponible.
- Tramo tenue: límite máximo al que puede recuperarse la stamina inmediata.
- Zona oscura: stamina perdida a largo plazo.

Cada strike reduce ligeramente el límite. Lanzar golpes por debajo del 35% de la reserva acelera la pérdida y vaciarla añade una penalización inmediata. El límite nunca baja de 35%. Entre asaltos se recuperan cuatro puntos del límite; no se restaura automáticamente a 100.

## Golpe crítico

Un impacto es crítico cuando se cumplen todas estas condiciones:

1. El atacante inicia el strike prácticamente quieto (`≤ 38 px/s`).
2. El rival se mueve al recibirlo (`≥ 70 px/s`).
3. El golpe no coincide con la guardia correcta.

El crítico multiplica el daño resultante por `1.75`, aplica un stun de un segundo, aumenta el retroceso, las partículas, el hit-stop, el flash y el movimiento de cámara.

Cada crítico no bloqueado realiza una sola tirada de knockdown con probabilidad `0.20`, equivalente a **1 entre 5**. La tirada aplica tanto a golpes de cabeza como de cuerpo y selecciona la animación correspondiente. En modo práctica no interrumpe la sesión con un knockdown.

## Distancia y contacto

- La separación mínima entre los centros de los peleadores es `168 px`; el motor corrige cualquier acercamiento menor para evitar superposición visual.
- Todos los strikes conectan con su zona anatómica si el rival está a `178 px` o menos durante los frames activos.
- A partir de `179 px` el strike falla y recibe la penalización de stamina por ineficiencia.
- La asistencia solo decide si existe contacto; el número y los efectos se colocan en la superficie exacta de cabeza o cuerpo.

## Knockdown y knockout

- `headKnockdown`: impacto de cabeza, pérdida de balance, caída, recuperación y vuelta a guardia.
- `bodyKnockdown`: reacción a costillas/abdomen, caída protegiendo el cuerpo y recuperación.
- `headKnockout`: colapso por golpe de cabeza y pose final inmóvil.
- `bodyKnockout`: colapso plegado por golpe corporal, pose final inmóvil y resultado `BODY K.O.`.
- El banner de resultado se retrasa `1.15 s` para dejar visible la caída; la pantalla final aparece después de completar la secuencia.

## Lectura visual del impacto

- `BLOCKED`: retroceso corto dentro de la animación de guardia, partículas y cámara mínimas.
- `CLEAN HIT`: reacción normal de cabeza o cuerpo y efectos medios.
- `CRITICAL HIT`: reacción prolongada con desplazamiento y rotación adicionales, destello blanco y efectos máximos.
