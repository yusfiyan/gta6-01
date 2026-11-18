// Keyboard + mouse input, shared by the player controller and the menus.
export const keys = Object.create(null);
export const mouse = { x: 0, y: 0, down: false, clicked: false, worldX: 0, worldY: 0 };

let canvas = null;

export function bindInput(canvasEl) {
  canvas = canvasEl;
  window.addEventListener('keydown', (event) => {
    keys[event.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => { keys[event.code] = false; });
  window.addEventListener('blur', () => {
    for (const code of Object.keys(keys)) keys[code] = false;
    mouse.down = false;
  });
  canvasEl.addEventListener('mousemove', (event) => {
    const rect = canvasEl.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * (canvasEl.width / rect.width);
    mouse.y = (event.clientY - rect.top) * (canvasEl.height / rect.height);
  });
  canvasEl.addEventListener('mousedown', (event) => {
    if (event.button === 0) { mouse.down = true; mouse.clicked = true; }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvasEl.addEventListener('contextmenu', (event) => event.preventDefault());
}

export function pressed(code) {
  return !!keys[code];
}

export function axis() {
  // Returns {x, y} in -1..1 from WASD or arrow keys.
  let x = 0; let y = 0;
  if (keys.KeyA || keys.ArrowLeft) x -= 1;
  if (keys.KeyD || keys.ArrowRight) x += 1;
  if (keys.KeyW || keys.ArrowUp) y -= 1;
  if (keys.KeyS || keys.ArrowDown) y += 1;
  return { x, y };
}

export function consumeClick() {
  const was = mouse.clicked;
  mouse.clicked = false;
  return was;
}

export function justPressed(code) {
  if (!keys[code]) return false;
  keys[code] = false;
  return true;
}
