function normalizarTexto(valor) {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  return texto.length ? texto : null;
}

function obtenerServiceTag(data) {
  return normalizarTexto(
    data?.serviceTag ||
    data?.service_tag ||
    data?.serialNumber ||
    data?.serial_number ||
    data?.serial ||
    data?.deviceId ||
    data?.idDispositivo ||
    data?.sistema?.idDispositivo
  );
}

function obtenerHostname(data) {
  return normalizarTexto(data?.hostname || data?.nombreEquipo || data?.deviceName);
}

function obtenerUsuario(data) {
  return normalizarTexto(
    data?.usuario ||
    data?.user ||
    data?.username ||
    data?.usuarioWindows ||
    data?.sistema?.usuario
  );
}

function obtenerIP(data) {
  return normalizarTexto(data?.ip || data?.direccionIP);
}

function obtenerMAC(data) {
  return normalizarTexto(data?.mac || data?.direccionMAC);
}

function obtenerPlataforma(data) {
  return normalizarTexto(data?.plataforma || data?.platform || data?.osPlatform);
}

function obtenerTipoSistema(data) {
  return normalizarTexto(data?.tipo_sistema || data?.tipoSistema || data?.arquitectura);
}

function obtenerCpuModelo(data) {
  return normalizarTexto(data?.cpu_modelo || data?.cpuModel || data?.cpu?.modelo);
}

function obtenerCpuNucleos(data) {
  return Number.isFinite(Number(data?.cpu_nucleos))
    ? Number(data.cpu_nucleos)
    : Number.isFinite(Number(data?.cpuCores))
      ? Number(data.cpuCores)
      : Number.isFinite(Number(data?.cpu?.nucleos))
        ? Number(data.cpu.nucleos)
        : null;
}

function obtenerCpuVelocidad(data) {
  return Number.isFinite(Number(data?.cpu_velocidad_mhz))
    ? Number(data.cpu_velocidad_mhz)
    : Number.isFinite(Number(data?.cpuSpeedMHz))
      ? Number(data.cpuSpeedMHz)
      : Number.isFinite(Number(data?.cpu?.velocidad_mhz))
        ? Number(data.cpu.velocidad_mhz)
        : null;
}

function obtenerDecimal(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const num = Number(valor);
  return Number.isFinite(num) ? num : null;
}

module.exports = {
  normalizarTexto,
  obtenerServiceTag,
  obtenerHostname,
  obtenerUsuario,
  obtenerIP,
  obtenerMAC,
  obtenerPlataforma,
  obtenerTipoSistema,
  obtenerCpuModelo,
  obtenerCpuNucleos,
  obtenerCpuVelocidad,
  obtenerDecimal
};