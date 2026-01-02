const fs = require('fs');
const path = require('path');

// Crear directorios si no existen
const dirs = [
  'assets/zombies',
  'assets/avatars',
  'assets/sounds'
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Crear archivos HTML5 video placeholder
const createVideoPlaceholder = (filename, color = 'red', text = 'Zombie') => {
  const html = `
<!DOCTYPE html>
<html>
<body>
  <div style="width: 100px; height: 100px; background: ${color}; color: white; display: flex; align-items: center; justify-content: center; font-family: Arial;">
    ${text}
  </div>
</body>
</html>`;
  
  // En un caso real, aquí generarías un video MP4
  // Para desarrollo, podemos usar un HTML simple
  fs.writeFileSync(filename.replace('.mp4', '.html'), html);
  console.log(`Created placeholder for: ${filename}`);
};

// Generar placeholders para zombies
for (let i = 1; i <= 10; i++) {
  const colors = ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#4f46e5', '#7c3aed', '#db2777', '#dc2626', '#0d9488'];
  createVideoPlaceholder(
    `assets/zombies/zombie${i}.mp4`,
    colors[i-1],
    `Zombie ${i}`
  );
}

// Generar placeholders para avatars
createVideoPlaceholder('assets/avatars/avatar.mp4', '#3b82f6', 'Jugador');
createVideoPlaceholder('assets/avatars/avatarsoldado.mp4', '#f59e0b', 'Soldado');

console.log('✅ Placeholders creados. Reemplázalos con videos reales MP4.');
