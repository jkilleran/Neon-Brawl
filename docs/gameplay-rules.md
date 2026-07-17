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

- Todo strike normal o bloqueado de pie aplica `0.40375 ×` su daño base, una reducción adicional del 5% respecto al balance anterior de `0.425 ×`.
- Los golpes críticos conservan la escala anterior de `0.425 ×`; después se aplica su multiplicador crítico de `1.75`. Por eso esta reducción no cambia el daño final de un crítico.
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

Un impacto puede convertirse en crítico por cualquiera de estas dos rutas, siempre que no choque con la guardia correcta.

### Crítico por movimiento

Se cumplen las dos condiciones:

1. El atacante inicia el strike prácticamente quieto (`≤ 38 px/s`).
2. El rival se mueve al recibirlo (`≥ 70 px/s`).

### Crítico por vulnerabilidad

- Se consulta únicamente la barra correspondiente al objetivo del strike: cabeza para golpes a la cabeza y cuerpo para golpes al cuerpo.
- El umbral depende del asalto: por debajo de `45%` en el round 1, `65%` en el round 2 y `75%` en el round 3.
- Al cruzar el umbral correspondiente antes del impacto, el golpe realiza una tirada de `1 / 3.5` (`2 / 7`, aproximadamente `28.57%`) aunque no se cumpla la condición de movimiento.
- Una barra de cuerpo baja no vuelve crítico un golpe a la cabeza, ni viceversa.
- El límite es estricto: una barra exactamente en `45%`, `65%` o `75%` todavía no activa la tirada de su round.

El crítico multiplica el daño resultante por `1.75`, aplica un stun de un segundo, aumenta el retroceso, las partículas, el hit-stop, el flash y el movimiento de cámara.

Cada crítico no bloqueado realiza después una sola tirada de knockdown con probabilidad `1 / 2.2` (`5 / 11`, aproximadamente `45.45%`). Si la tirada tiene éxito, una segunda selección reparte de forma uniforme las cinco variantes disponibles para la zona impactada. En modo práctica no interrumpe la sesión con un knockdown.

La cantidad de knockdowns se conserva únicamente como estadística y puntuación: no existe un límite y nunca produce un TKO automático. La pelea termina por daño cuando la salud de cabeza o cuerpo llega a cero.

## Distancia y contacto

- La separación mínima entre los centros de los peleadores es `168 px`; el motor corrige cualquier acercamiento menor para evitar superposición visual.
- Todos los strikes conectan con su zona anatómica si el rival está a `178 px` o menos durante los frames activos.
- A partir de `179 px` el strike falla y recibe la penalización de stamina por ineficiencia.
- La asistencia solo decide si existe contacto; el número y los efectos se colocan en la superficie exacta de cabeza o cuerpo.

## Knockdown y knockout

- `headKnockdown`: impacto de cabeza, pérdida de balance, caída, recuperación y vuelta a guardia.
- `headKnockdownForward`: giro de cabeza, tropiezo hacia delante, manos/rodilla, recuperación y guardia.
- `headKnockdownSeated`: rotación por impacto, caída sentada/lateral, apoyo, recuperación y guardia.
- `headKnockdownShoulderRoll`: caída en espiral sobre hombro/cadera, rodamiento, tres apoyos y recuperación.
- `headKnockdownKneeDrop`: reacción retardada, caída vertical a una rodilla, apoyo de palma y recuperación.
- `bodyKnockdown`: reacción a costillas/abdomen, caída protegiendo el cuerpo y recuperación.
- `bodyKnockdownKneel`: impacto al plexo, caída sobre ambas rodillas, apoyo y recuperación.
- `bodyKnockdownSeated`: pérdida de aire, retroceso, caída sentada, apoyo y recuperación.
- `bodyKnockdownElbowFold`: pliegue compacto al hígado, caída sobre codo/cadera y recuperación.
- `bodyKnockdownThreePoint`: golpe al plexo, paso inestable, caída a rodilla/pie/palma y recuperación.
- `headKnockout`: colapso por golpe de cabeza y pose final inmóvil.
- `headKnockoutProne`: colapso frontal por golpe de cabeza y final boca abajo inmóvil.
- `headKnockoutSide`: giro, caída lateral directa y final inmóvil sobre el costado.
- `headKnockoutKneeCollapse`: pausa retardada, caída sobre ambas rodillas, vuelco lateral y final inmóvil.
- `bodyKnockout`: colapso plegado por golpe corporal, pose final inmóvil y resultado `BODY K.O.`.
- `bodyKnockoutProne`: caída de rodillas por golpe corporal, colapso frontal plegado y final inmóvil.
- `bodyKnockoutSupine`: retroceso, caída sentada y final completamente boca arriba.
- `bodyKnockoutSeatedSlump`: caída sentada protegiendo el hígado y desplome lateral final.
- Cada knockdown selecciona uniformemente una de cinco variantes de su zona. Cada knockout selecciona uniformemente una de cuatro variantes de su zona.
- El banner de resultado se retrasa `1.15 s` para dejar visible la caída; la pantalla final aparece después de completar la secuencia.

## Lectura visual del impacto

- `BLOCKED`: retroceso corto dentro de la animación de guardia, partículas y cámara mínimas.
- `CLEAN HIT`: reacción normal de cabeza o cuerpo y efectos medios.
- `CRITICAL HIT`: reacción prolongada con desplazamiento y rotación adicionales, destello blanco y efectos máximos.
