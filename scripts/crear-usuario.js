require('dotenv').config();

const bcrypt = require('bcryptjs');
const { crearConexion } = require('../configs/db');

async function query(sql, params = []) {
  const connection = await crearConexion();

  try {
    const [rows] = await connection.execute(sql, params);
    return rows;
  } finally {
    await connection.end();
  }
}

function validarPassword(password) {
  const pass = String(password || '');

  if (pass.length < 12) {
    return 'La contraseña debe tener mínimo 12 caracteres.';
  }

  if (!/[A-Z]/.test(pass)) {
    return 'La contraseña debe incluir al menos una mayúscula.';
  }

  if (!/[a-z]/.test(pass)) {
    return 'La contraseña debe incluir al menos una minúscula.';
  }

  if (!/[0-9]/.test(pass)) {
    return 'La contraseña debe incluir al menos un número.';
  }

  if (!/[^A-Za-z0-9]/.test(pass)) {
    return 'La contraseña debe incluir al menos un símbolo.';
  }

  return null;
}

async function main() {
  const [
    nombreCompleto,
    nomina,
    correo,
    password,
    tipoUsuario,
  ] = process.argv.slice(2);

  if (!nombreCompleto || !correo || !password) {
    console.log('Uso:');
    console.log('node scripts/crear-usuario.js "Nombre Completo" "Nomina" "correo@empresa.com" "PasswordSeguro123!" "IT"');
    process.exit(1);
  }

  const errorPassword = validarPassword(password);

  if (errorPassword) {
    console.log(errorPassword);
    process.exit(1);
  }

  const correoLimpio = correo.trim().toLowerCase();
  const tipoUsuarioFinal = tipoUsuario === 'BECARIO' ? 'BECARIO' : 'IT';

  const existente = await query(
    `
    SELECT usuario_id
    FROM usuarios_sistema
    WHERE correo = ?
    LIMIT 1
    `,
    [correoLimpio]
  );

  if (existente.length > 0) {
    console.log('Ya existe un usuario con ese correo.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await query(
    `
    INSERT INTO usuarios_sistema (
      nombre_completo,
      nomina,
      correo,
      password_hash,
      tipo_usuario,
      activo
    )
    VALUES (?, ?, ?, ?, ?, 1)
    `,
    [
      nombreCompleto,
      nomina || null,
      correoLimpio,
      passwordHash,
      tipoUsuarioFinal,
    ]
  );

  console.log('Usuario creado correctamente.');
  process.exit(0);
}

main().catch((error) => {
  console.error('Error al crear usuario:', error.message);
  process.exit(1);
});