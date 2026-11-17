// Keyboard + mouse state. The game is keyboard-driven (WASD/arrows, E, Space,
// Shift, M, P/Esc); the mouse only aims the pistol.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false },
    // Edge-triggered presses, consumed once per frame by the game loop.
    pressed: new Set(),
  };

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    KeyE: 'enter', Enter: 'confirm',
    Space: 'fire', ShiftLeft: 'sprint', ShiftRight: 'sprint',
    KeyM: 'mute', KeyP: 'pause', Escape: 'pause',
    KeyR: 'respawn',
  };

  window.addEventListener('keydown', (event) => {
    const action = KEYMAP[event.code];
    if (!action) return;
    if (event.code === 'Space') event.preventDefault();
    if (!event.repeat) {
      input.keys.add(action);
      input.pressed.add(action);
    }
  });
  window.addEventListener('keyup', (event) => {
    const action = KEYMAP[event.code];
    if (action) input.keys.delete(action);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
  });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = event.clientX - rect.left;
    input.mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      input.mouse.down = true;
      input.mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) input.mouse.down = false;
  });
  // Keep the canvas focused so keys work right after a click.
  canvas.addEventListener('click', () => canvas.focus());

  input.endFrame = function endFrame() {
    input.pressed.clear();
    input.mouse.clicked = false;
  };

  input.isDown = function isDown(action) {
    return input.keys.has(action);
  };
  input.wasPressed = function wasPressed(action) {
    return input.pressed.has(action);
  };

  return input;
}
