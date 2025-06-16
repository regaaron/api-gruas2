const express = require('express');
const routes = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');

routes.get('/ver-conductores', (req, res) => {
    const sql = `
        SELECT 
            u.id_usuario, u.nombre, u.apellido, u.direccion, 
            u.telefono, u.email, u.password,
            uc.latitud, uc.longitud, uc.activo, uc.atendido,
            s.espera, s.aceptada, s.id_cliente
        FROM usuarios u
        LEFT JOIN ubicaciones uc ON u.id_usuario = uc.id_usuario
        LEFT JOIN solicitudes s ON u.id_usuario = s.id_conductor
        WHERE u.tipo_usuario = 'conductor'
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching conductores:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        const conductores = results.map(conductor => ({
            id_usuario: conductor.id_usuario,
            nombre: conductor.nombre,
            apellido: conductor.apellido,
            direccion: conductor.direccion,
            telefono: conductor.telefono,
            email: conductor.email,
            password: conductor.password,
            ubicacion: {
                latitud: conductor.latitud,
                longitud: conductor.longitud,
                activo: conductor.activo === 1,
                atendido: conductor.atendido === 1
            },
            solicitud: conductor.id_cliente !== null ? {
                espera: conductor.espera === 1,
                usuario: conductor.id_cliente
            } : {
                espera: false,
                usuario: 0
            },
            aceptada: conductor.aceptada === 1
        }));

        res.json(conductores);
    });
});


routes.post('/Registrar-Conductor', async (req, res) => {
    const { nombre, apellido, direccion, telefono, email, password } = req.body;

    if (!nombre || !apellido || !direccion || !telefono || !email || !password) {
        return res.status(400).json({ message: 'Todos los campos son requeridos' });
    }

    // Verifica si ya existe
    const checkSql = 'SELECT id_usuario FROM usuarios WHERE email = ?';
    db.query(checkSql, [email], async (err, results) => {
        if (err) return res.status(500).json({ message: 'Error en el servidor' });
        if (results.length > 0) return res.status(400).json({ message: 'El conductor ya existe' });

        try {
            const hashedPassword = await bcrypt.hash(password, 10); // 🔐 Aquí se encripta la contraseña

            const insertSql = `
                INSERT INTO usuarios (nombre, apellido, direccion, telefono, email, password, tipo_usuario)
                VALUES (?, ?, ?, ?, ?, ?, 'conductor')
            `;
            db.query(insertSql, [nombre, apellido, direccion, telefono, email, hashedPassword], (err) => {
                if (err) return res.status(500).json({ message: 'Error al registrar conductor' });
                res.status(201).json({ message: 'Conductor registrado con éxito' });
            });

        } catch (err) {
            console.error('Error en bcrypt:', err);
            res.status(500).json({ message: 'Error en el servidor' });
        }
    });
});

// Actualizar conductor
routes.put('/actualizar-conductor/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, direccion, telefono, email, password } = req.body;

  if (!nombre || !apellido || !direccion || !telefono || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }

  try {
    // Verificar si la contraseña ya está encriptada
    const hashRegex = /^\$2[aby]\$/;

    let nuevaPassword = password;

    if (!hashRegex.test(password)) {
      // Solo encripta si no lo está
      nuevaPassword = await bcrypt.hash(password, 10);
    }

    const sql = `
      UPDATE usuarios 
      SET nombre = ?, apellido = ?, direccion = ?, telefono = ?, email = ?, password = ?
      WHERE id_usuario = ? AND tipo_usuario = 'conductor'
    `;

    db.query(sql, [nombre, apellido, direccion, telefono, email, nuevaPassword, id], (err, result) => {
      if (err) {
        console.error('Error al actualizar conductor:', err);
        return res.status(500).json({ error: 'Error al actualizar el conductor' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Conductor no encontrado' });
      }

      res.status(200).json({ message: 'Conductor actualizado correctamente' });
    });
  } catch (error) {
    console.error('Error al procesar la actualización:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

routes.put('/actualizar-ubicacion/conductores/:id', async (req, res) => {
    const { id } = req.params;
    const { latitud, longitud, activo, atendido, espera, usuario } = req.body;
    //console.log("Datos recibidos:", { latitud, longitud, activo, atendido, espera, usuario });
    // Validar campos requeridos
    if (latitud === undefined || longitud === undefined || activo === undefined || atendido === undefined) {
        return res.status(400).json({ error: "'latitud', 'longitud', 'activo' y 'atendido' son campos obligatorios" });
    }


    try {
        // Verificar que el conductor exista
        const [conductor] = await db.promise().query(
            'SELECT id_usuario FROM usuarios WHERE id_usuario = ? AND tipo_usuario = "conductor"',
            [id]
        );
        
        if (conductor.length === 0) {
            return res.status(404).json({ error: 'Conductor no encontrado' });
        }

        // Convertir booleanos a 1/0 si es necesario
        const activoNum = typeof activo === 'boolean' ? (activo ? 1 : 0) : activo;
        const atendidoNum = typeof atendido === 'boolean' ? (atendido ? 1 : 0) : atendido;
        const esperaNum = typeof espera === 'boolean' ? (espera ? 1 : 0) : espera;

        // Actualizar ubicación
        await db.promise().query(
            `UPDATE ubicaciones
             SET latitud = ?, longitud = ?, activo = ?, atendido = ? 
             WHERE id_usuario = ?`,
            [latitud, longitud, activoNum, atendidoNum, usuario]
        );

        // Actualizar solicitud si se proporciona
        if (espera !== undefined || usuario !== undefined) {
            await db.promise().query(
                `UPDATE solicitudes
                 SET id_conductor = ?, espera = ? 
                 WHERE id_cliente = ?`,
                [id, esperaNum, usuario]
            );
        }

        res.status(200).json({
            message: 'Datos del conductor actualizados exitosamente',
            conductorId: id
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar el conductor' });
    }
});


// Actualizar estado de aceptación
routes.put('/actualizar-aceptada/conductores/:id', async (req, res) => {
    const { id } = req.params;
    const { aceptada } = req.body;
    
    const aceptanum = typeof aceptada === 'boolean' ? (aceptada ? 1 : 0) : aceptada;

    if (aceptada === undefined) {
        return res.status(400).json({ error: "'aceptada' es un campo obligatorio" });
    }

    try {
        const [result] = await db.promise().query(
            'UPDATE solicitudes SET aceptada = ? WHERE id_conductor = ?',
            [aceptanum, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Conductor no encontrado' });
        }

        res.status(200).json({
            message: 'Campo "aceptada" actualizado exitosamente',
            conductorId: id
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar el conductor' });
    }
});

module.exports = routes;