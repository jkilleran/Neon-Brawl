# Neon Brawl

Juego de pelea 2D para navegador, hecho con HTML, CSS, JavaScript y Canvas. Incluye combate contra la computadora y un modo local para dos jugadores usando el mismo teclado.

## Ejecutarlo en Visual Studio Code

1. Abre esta carpeta en Visual Studio Code.
2. Abre la terminal integrada (`Terminal > New Terminal`).
3. Ejecuta:

```bash
npm install
npm run dev
```

4. Abre la dirección que muestre la terminal, normalmente `http://localhost:5173`.

También puedes utilizar la extensión **Live Server** y abrir `index.html` con ella.

## Controles

| Acción | Jugador 1 | Jugador 2 |
| --- | --- | --- |
| Mover | `A` / `D` | `←` / `→` |
| Saltar | `W` | `↑` |
| Cubrirse | `S` | `↓` |
| Ataque | `F` | `K` |
| Especial | `G` | `L` |
| Pausa | `Esc` | `Esc` |

El ataque especial consume 40 puntos de energía. Gana el primer luchador que consiga dos rondas.

## Comandos útiles

```bash
npm run check
npm run build
```

## Tecnología

- Canvas 2D sin motores externos
- Web Audio API para efectos generados en tiempo real
- Vite para desarrollo local

## Licencia

MIT
