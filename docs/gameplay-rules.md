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

## Lectura visual del impacto

- `BLOCKED`: retroceso corto dentro de la animación de guardia, partículas y cámara mínimas.
- `CLEAN HIT`: reacción normal de cabeza o cuerpo y efectos medios.
- `CRITICAL HIT`: reacción prolongada con desplazamiento y rotación adicionales, destello blanco y efectos máximos.
