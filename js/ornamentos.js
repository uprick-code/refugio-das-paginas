// Ilustrações desenhadas em código: flores de traço fino, folhas, dente-de-leão e vasinhos.
export function flor(x, y, r, fill, stroke, rot = 0) {
  let p = "";
  for (let i = 0; i < 5; i++) {
    const a = rot + i * 72;
    p += `<ellipse cx="${x}" cy="${y - r * 0.62}" rx="${r * 0.42}" ry="${r * 0.62}" transform="rotate(${a} ${x} ${y})" fill="${fill}" stroke="${stroke}" stroke-width="1.1"/>`;
  }
  return p + `<circle cx="${x}" cy="${y}" r="${r * 0.26}" fill="var(--gold)"/>`;
}

export function folha(x, y, len, ang, fill, stroke) {
  return `<g transform="rotate(${ang} ${x} ${y})"><path d="M${x} ${y} q ${len * 0.5} ${-len * 0.32} ${len} 0 q ${-len * 0.5} ${len * 0.32} ${-len} 0z" fill="${fill}" stroke="${stroke}" stroke-width="1"/><path d="M${x} ${y} h ${len * 0.92}" stroke="${stroke}" stroke-width=".7"/></g>`;
}

const F = ["var(--sage-soft)", "var(--sage)"];
export const canto = `
  <path d="M0 40 C 60 50, 110 30, 175 70 M30 0 C 40 60, 30 110, 60 170" fill="none" stroke="var(--sage)" stroke-width="1.2"/>
  ${folha(70, 46, 34, -20, ...F)}${folha(120, 48, 30, 25, ...F)}${folha(36, 80, 30, 95, ...F)}${folha(42, 130, 28, 60, ...F)}
  ${flor(48, 46, 30, "var(--rose-soft)", "var(--rose-ink)", 8)}
  ${flor(150, 64, 18, "var(--rose-soft)", "var(--rose-ink)", 30)}
  ${flor(50, 150, 16, "var(--rose-soft)", "var(--rose-ink)", -12)}`;

export function denteDeLeao() {
  let s = `<path d="M45 108 C 46 85, 43 62, 45 40" stroke="var(--ink-soft)" stroke-width="1.2" fill="none"/>`;
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2, x = 45 + Math.cos(a) * 22, y = 32 + Math.sin(a) * 22;
    s += `<line x1="45" y1="32" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--ink-soft)" stroke-width=".7"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.4" fill="var(--ink-soft)"/>`;
  }
  [[78, 14], [84, 6], [72, 4]].forEach(([x, y]) => {
    s += `<line x1="${x - 4}" y1="${y + 4}" x2="${x}" y2="${y}" stroke="var(--ink-soft)" stroke-width=".7"/><circle cx="${x}" cy="${y}" r="1.3" fill="var(--ink-soft)"/>`;
  });
  return s;
}

export function planta(cls) {
  return `<svg class="planta ${cls}" width="50" height="70" viewBox="0 0 50 70" aria-hidden="true">
    <path d="M12 46 h26 l-4 22 h-18z" fill="var(--wood)" opacity=".85"/>
    ${folha(25, 46, 22, -60, ...F)}${folha(25, 46, 24, -120, ...F)}${folha(25, 46, 20, -90, ...F)}${folha(25, 42, 16, -30, ...F)}${folha(25, 42, 16, -150, ...F)}</svg>`;
}

export function enfeitarRosto() {
  document.querySelectorAll(".corner").forEach(el => el.innerHTML = canto);
  document.querySelectorAll(".dente").forEach(el => el.innerHTML = denteDeLeao());
}
