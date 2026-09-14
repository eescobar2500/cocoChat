// Fondo ambiental de la interfaz.
//
// Todo se dibuja con CSS y SVG: nada de imágenes rasterizadas, así se ve
// nítido en cualquier resolución (1080p, 4K, retina) y pesa unos pocos KB.
//
// Capas, de atrás hacia delante:
//   1. mesh: degradados radiales verdes muy tenues sobre el fondo casi negro
//   2. red neuronal SVG a baja opacidad
//   3. partículas lentas
// El contenido de la app va por encima, con su propio z-index.
//
// Es decorativo: aria-hidden lo saca del árbol de accesibilidad.

// Nodos de la red neuronal. Coordenadas en un viewBox de 1000x1000 para
// que escale con el contenedor. Se concentran en los laterales para no
// pasar por detrás del texto central.
const NODES = [
  [80, 180], [170, 120], [130, 300], [60, 420], [200, 380],
  [240, 520], [110, 620], [190, 720], [90, 820], [230, 880],
  [920, 150], [830, 220], [880, 350], [780, 300], [950, 450],
  [810, 520], [900, 640], [770, 700], [930, 780], [840, 880],
];

// Conexiones entre nodos (índices del array de arriba). Pocas y cortas:
// una malla densa se leería como ruido.
const LINKS = [
  [0, 1], [0, 2], [1, 2], [2, 3], [2, 4], [3, 4], [4, 5],
  [5, 6], [6, 7], [7, 8], [7, 9], [8, 9],
  [10, 11], [11, 12], [11, 13], [12, 14], [12, 15], [13, 15],
  [15, 16], [16, 17], [16, 18], [17, 19], [18, 19],
];

// Partículas: posición en %, tamaño, retardo y duración. Pocas y lentas
// a propósito — el movimiento debe percibirse como ambiente, no como
// una animación protagonista.
const PARTICLES = [
  { x: 12, y: 22, s: 3, delay: 0, dur: 26 },
  { x: 27, y: 68, s: 2, delay: 6, dur: 32 },
  { x: 44, y: 14, s: 2, delay: 12, dur: 29 },
  { x: 63, y: 78, s: 3, delay: 3, dur: 34 },
  { x: 78, y: 34, s: 2, delay: 9, dur: 28 },
  { x: 88, y: 62, s: 3, delay: 15, dur: 31 },
  { x: 55, y: 45, s: 2, delay: 18, dur: 36 },
  { x: 35, y: 88, s: 2, delay: 21, dur: 30 },
];

export function AIBackground() {
  return (
    <div className="ai-bg" aria-hidden="true">
      {/* Capa 1 + 2: el degradado de malla vive en el CSS de .ai-bg,
          como pseudo-elemento, para no añadir nodos al DOM. */}

      {/* Capa 3: red neuronal.
          preserveAspectRatio="none" deja que el SVG se estire con el
          contenedor: al ser formas abstractas, la deformación no se nota
          y así cubre cualquier proporción de pantalla. */}
      <svg
        className="ai-bg__net"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        focusable="false"
      >
        <g className="ai-bg__links">
          {LINKS.map(([a, b], i) => (
            <line
              key={i}
              x1={NODES[a][0]}
              y1={NODES[a][1]}
              x2={NODES[b][0]}
              y2={NODES[b][1]}
            />
          ))}
        </g>

        <g className="ai-bg__nodes">
          {NODES.map(([cx, cy], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={i % 4 === 0 ? 4 : 2.5}
              // Cada nodo late con su propio retardo: sin esto los 20
              // parpadearían a la vez y se notaría el truco.
              style={{ animationDelay: `${(i % 7) * 1.3}s` }}
            />
          ))}
        </g>
      </svg>

      {/* Capa 4: partículas */}
      <div className="ai-bg__particles">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="ai-bg__particle"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.s}px`,
              height: `${p.s}px`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
