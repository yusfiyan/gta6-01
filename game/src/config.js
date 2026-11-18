// Marisol Bay — configuration: canvas, city layout, palette, car models, missions.
// Everything here is original work for this entry; no asset or name is borrowed
// from any commercial game.
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const WORLD_W = 3600;
export const WORLD_H = 2700;
export const ROAD_W = 120;
export const SIDEWALK = 26;
export const CITY_SEED = 1337;
export const STEP = 1 / 60;

// Vertical road centre lines (x) and horizontal road centre lines (y).
export const ROADS_V = [350, 800, 1250, 1700, 2150, 2600, 3050];
export const ROADS_H = [350, 800, 1250, 1700, 2150];
export const WATER_X = 3420; // east edge: sea starts here
export const SAND_X = 3250; // beach sand starts here

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#6f9c4e',
  road: '#3a3f4a',
  roadLine: '#e8d44d',
  sidewalk: '#b9b3a4',
  sand: '#e6cf9a',
  water: '#2e7fb8',
  waterDeep: '#1f5f92',
  plaza: '#c9c2b2',
  park: '#5d9448',
  buildingRoof: '#8a6f5c',
  night: 'rgba(10, 12, 30, 0.0)',
};

export const BUILDING_COLORS = [
  '#c98f5f', '#b5764f', '#9fb3c8', '#c8b18a', '#a88f6a', '#7f9c8a',
  '#c27a6b', '#8d9db6', '#d1b48c', '#6b7f9e', '#b98a6d', '#94a89a',
];

export const CAR_MODELS = {
  sedan: { name: 'Sedán', len: 46, wid: 22, accel: 260, top: 330, grip: 3.2, color: '#5b7fa6' },
  taxi: { name: 'Taxi', len: 46, wid: 22, accel: 250, top: 320, grip: 3.2, color: '#e8b93a' },
  comet: { name: 'Comet GT', len: 48, wid: 22, accel: 420, top: 520, grip: 4.6, color: '#c22f3d' },
  truck: { name: 'Camión', len: 62, wid: 26, accel: 170, top: 240, grip: 2.4, color: '#7d8a96' },
  van: { name: 'Furgón', len: 54, wid: 24, accel: 200, top: 270, grip: 2.6, color: '#a8a29a' },
  police: { name: 'Patrulla', len: 48, wid: 22, accel: 380, top: 470, grip: 4.2, color: '#1d3f8f' },
  muscle: { name: 'Búfalo', len: 50, wid: 23, accel: 330, top: 420, grip: 3.8, color: '#3d8f5a' },
};

export const PED_COLORS = ['#d94f4f', '#4f7dd9', '#e8b93a', '#7dd94f', '#b06fd9', '#e87d3a', '#3ad9c2', '#d94fa8'];

// Landmark spots (world coordinates), used by missions and the minimap.
export const LANDMARKS = {
  garage: { x: 1250, y: 2150, label: "Taller de Vera" },
  safehouse: { x: 2600, y: 350, label: 'Piso franco' },
  bank: { x: 1700, y: 1250, label: 'Banco de la Bahía' },
  hospital: { x: 800, y: 800, label: 'Hospital' },
  docks: { x: 700, y: 2450, label: 'Muelle' },
  hotel: { x: 3050, y: 800, label: 'Hotel Miramar' },
  plaza: { x: 1700, y: 1250, label: 'Plaza Mayor' },
  beach: { x: 3330, y: 1700, label: 'Playa' },
  port: { x: 700, y: 2450, label: 'Puerto' },
};

// Story + missions. The arc: Milo Cruz, a getaway driver in debt to the fixer
// Vera Solano, works off the debt job by job until the big score.
export const MISSIONS = [
  {
    id: 'meet-vera',
    name: 'Conoce a Vera',
    brief: 'Vera Solano te espera en su taller. Ve a pie o en coche: el marcador amarillo te guía.',
    objective: 'Llega al taller de Vera',
    reward: 0,
  },
  {
    id: 'first-run',
    name: 'Primer encargo',
    brief: 'Lleva el paquete al muelle en 100 segundos. Vera no paga por retrasos.',
    objective: 'Entrega el paquete en el muelle (100 s)',
    reward: 300,
    timeLimit: 100,
  },
  {
    id: 'wheels-up',
    name: 'Ruedas arriba',
    brief: 'Un Comet GT rojo espera en el Hotel Miramar. Róbalo y tráelo al taller. La policía no lo verá con buenos ojos.',
    objective: 'Roba el Comet GT y llévalo al taller',
    reward: 500,
  },
  {
    id: 'dockside-heat',
    name: 'Calor en el muelle',
    brief: 'Los Tide Kings controlan el muelle. A pie, acaba con 5 de ellos. Cúbrete entre los contenedores.',
    objective: 'Elimina a 5 Tide Kings (0/5)',
    reward: 800,
  },
  {
    id: 'hot-pursuit',
    name: 'Persecución caliente',
    brief: 'La policía te tiene fichado: 3 estrellas. Aguanta 60 segundos sin que te atrapen y llega al piso franco.',
    objective: 'Pierde a la policía y llega al piso franco',
    reward: 1000,
  },
  {
    id: 'marisol-score',
    name: 'El gran golpe',
    brief: 'El Banco de la Bahía. Entra a pie, coge el dinero de la cámara (E) y escapa con 4 estrellas hasta el piso franco. Esto salda tu deuda.',
    objective: 'Roba la cámara del banco y escapa',
    reward: 5000,
  },
];

export const SAVE_KEY = 'marisol-bay-save-v1';
export const STORY_INTRO = 'Marisol Bay, 2026. Milo Cruz debe $40.000 a Vera Solano. Seis trabajos. Una última oportunidad.';
