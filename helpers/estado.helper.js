function calcularEstadoVisual(fechaReporte) {
  if (!fechaReporte) return 'offline';

  const ahora = Date.now();
  const fecha = new Date(fechaReporte).getTime();

  if (Number.isNaN(fecha)) return 'offline';

  const diffSegundos = (ahora - fecha) / 1000;

  if (diffSegundos <= 30) return 'online';
  return 'offline';
}

module.exports = { calcularEstadoVisual };