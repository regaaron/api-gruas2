const express = require('express');
const axios = require('axios'); 
const routes = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');

// Obtener todos los clientes básicos
routes.get('/usuarios', (req, res) => {
    db.query('SELECT id_usuario,nombre,apellido,direccion,telefono,email FROM usuarios WHERE tipo_usuario = "cliente"', (err, results) => {
        if (err) {
            console.error('Error fetching clients:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(results);
    });
});

// Obtener clientes con información de ubicación
routes.get('/ver-clientes', (req, res) => {
    const sql = `
      SELECT u.*, uc.latitud, uc.longitud, uc.activo, uc.atendido, uc.id_conductor
      FROM usuarios u
      LEFT JOIN ubicaciones uc ON u.id_usuario = uc.id_usuario
      WHERE u.tipo_usuario = 'cliente'
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching clients with location:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        // Transformamos los resultados para anidar ubicación
        const clientes = results.map(cliente => ({
            id_usuario: cliente.id_usuario,
            nombre: cliente.nombre,
            apellido: cliente.apellido,
            direccion: cliente.direccion,
            telefono: cliente.telefono,
            email: cliente.email,
            password: cliente.password,  // Mantener la contraseña en el objeto (no recomendable para producción)
            ubicacion: {  // ← Objeto anidado
                latitud: cliente.latitud,
                longitud: cliente.longitud,
                activo: cliente.activo === 1,  // Conversión a boolean
                atendido: cliente.atendido === 1,
                id_conductor: cliente.id_conductor
            }
        }));

        res.json(clientes);
    });
});

// Registrar nuevo cliente
routes.post('/Registrar-Cliente', async (req, res) => {
    try {
        const { nombre, apellido, direccion, telefono, email, latitud, longitud } = req.body;

        // Validación básica
        if (!nombre || !email) {
            return res.status(400).json({ error: 'Nombre y email son obligatorios' });
        }

        // Insertar usuario
        const sqlUsuario = `
            INSERT INTO usuarios (nombre, apellido, direccion, telefono, email, tipo_usuario)
            VALUES (?, ?, ?, ?, ?, 'cliente')
        `;
        
        db.query(sqlUsuario, [nombre, apellido, direccion, telefono, email], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ 
                    error: 'Error al registrar el cliente',
                    details: err.message 
                });
            }

            const idUsuario = result.insertId;

            // Insertar ubicación solo si se proporcionan coordenadas
            if (latitud && longitud) {
                const sqlUbicacion = `
                    INSERT INTO ubicaciones 
                    (id_usuario, latitud, longitud, activo, atendido, id_conductor)
                    VALUES (?, ?, ?, FALSE, FALSE, NULL)
                `;
                
                db.query(sqlUbicacion, [idUsuario, latitud, longitud], (err) => {
                    if (err) {
                        console.error(err);
                        // No fallar completamente, solo registrar el error
                        console.log('Ubicación no registrada pero cliente creado');
                    }

                    res.status(201).json({
                        message: 'Cliente registrado exitosamente',
                        cliente: { id_usuario: idUsuario, ...req.body }
                    });
                });
            } else {
                res.status(201).json({
                    message: 'Cliente registrado sin ubicación inicial',
                    cliente: { id_usuario: idUsuario, ...req.body }
                });
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});


routes.post('/gestionar-solicitud', (req, res) => {
    const { id_cliente, id_conductor, espera = false, aceptada = false } = req.body;
    const conductor = id_conductor === 0 ? null : id_conductor;

    if (!id_cliente) {
        return res.status(400).json({ error: 'Se requiere id_cliente' });
    }
    db.query('SELECT * FROM solicitudes WHERE id_cliente = ?', [id_cliente], (err, existingRows) => {
        if (err) {
            console.error('[ERROR gestionar-solicitud]:', err);
            return res.status(500).json({ error: 'Error al consultar solicitudes', details: err.message });
        }

        if (existingRows.length > 0) {
            db.query(`
                UPDATE solicitudes SET 
                    id_conductor = ?,
                    espera = ?,
                    fecha_hora = NOW()
                WHERE id_cliente = ?`,
                [conductor, espera, id_cliente],
                (err) => {
                    if (err) {
                        console.error('[ERROR gestionar-solicitud - update]:', err);
                        return res.status(500).json({ error: 'Error al actualizar solicitud', details: err.message });
                    }

                    res.json({
                        success: true,
                        message: 'Solicitud actualizada',
                        operation: 'update'
                    });
                }
            );
        } else {
            db.query(`
                INSERT INTO solicitudes (
                    id_cliente, id_conductor, espera, aceptada, fecha_hora
                ) VALUES (?, ?, ?, ?, NOW())`,
                [id_cliente, conductor, espera, aceptada],
                (err) => {
                    if (err) {
                        console.error('[ERROR gestionar-solicitud - insert]:', err);
                        return res.status(500).json({ error: 'Error al insertar solicitud', details: err.message });
                    }

                    res.status(201).json({
                        success: true,
                        message: 'Solicitud creada',
                        operation: 'insert',
                        id_cliente
                    });
                }
            );
        }
    });
});


routes.put('/actualizar-ubicacion/clientes/:id', (req, res) => {
    const { id } = req.params;
    const { latitud, longitud, activo, atendido, conductor } = req.body;

    if (latitud === undefined && longitud === undefined && activo === undefined && atendido === undefined) {
        return res.status(400).json({ error: 'Debe proporcionar al menos un campo para actualizar' });
    }
    console.log('📌Intentando actualizar ubicación del cliente:', id , latitud, longitud);
    const sql = `
        UPDATE ubicaciones SET
            latitud = COALESCE(?, latitud),
            longitud = COALESCE(?, longitud),
            activo = COALESCE(?, activo),
            atendido = COALESCE(?, atendido)
        WHERE id_usuario = ?
    `;
    const values = [
        latitud,
        longitud,
        typeof activo === 'boolean' ? (activo ? 1 : 0) : undefined,
        typeof atendido === 'boolean' ? (atendido ? 1 : 0) : undefined,
        id
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error en actualización:', err);
            return res.status(500).json({ error: 'Error en el servidor', details: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        // Si activo = true, se llama a gestionar-solicitud
        if (activo === true) {
            axios.post('http://localhost:3000/api/clientes/gestionar-solicitud', {
                id_cliente: id,
                id_conductor: conductor
            }, { timeout: 3000 })
            .then(response => {
                return res.status(200).json({
                    message: 'Ubicación actualizada y solicitud gestionada',
                    ubicacionUpdated: true,
                    solicitudGestionada: response.data
                });
            })
            .catch(solicitudError => {
                console.error('Error gestionando solicitud:', solicitudError);
                return res.status(200).json({
                    message: 'Ubicación actualizada pero falló gestión de solicitud',
                    ubicacionUpdated: true,
                    solicitudError: solicitudError.response?.data || solicitudError.message
                });
            });
        } else {
            return res.status(200).json({
                message: 'Ubicación actualizada exitosamente',
                ubicacionUpdated: true
            });
        }
    });
});



// Actualizar estado de aceptación
routes.put('/actualizar-activo/clientes/:id', async (req, res) => {
    const { id } = req.params;
    const { activo } = req.body;
    
    const aceptanum = typeof activo === 'boolean' ? (activo ? 1 : 0) : activo;

    if (activo === undefined) {
        return res.status(400).json({ error: "'activo' es un campo obligatorio" });
    }

    try {
        const [result] = await db.promise().query(
            'UPDATE ubicaciones SET activo = ? WHERE id_usuario = ?',
            [aceptanum, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Conductor no encontrado' });
        }

        res.status(200).json({
            message: 'Campo "activo" actualizado exitosamente',
            conductorId: id
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar el conductor' });
    }
});

// Sistema de login (mantenido igual)
routes.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    const sql = 'SELECT * FROM usuarios WHERE email = ? AND tipo_usuario = "admin"';
    db.query(sql, [email], async (err, results) => {
        if (err) return res.status(500).json({ error: 'Error en el servidor' });
        if (results.length === 0) return res.status(401).json({ error: 'Usuario no encontrado asegurate ser admin' });

        const user = results[0];

        const hashRegex = /^\$2[aby]\$/;

        if (hashRegex.test(user.password)) {
            const match = await bcrypt.compare(password, user.password);
            if (!match) return res.status(401).json({ error: 'Contraseña incorrecta' });
        } else {
            if (password !== user.password) return res.status(401).json({ error: 'Contraseña incorrecta' });

            const newHashedPassword = await bcrypt.hash(password, 10);
            db.query('UPDATE usuarios SET password = ? WHERE id_usuario = ?', [newHashedPassword, user.id_usuario]);
        }

        res.json({
            id_usuario: user.id_usuario,
            nombre: user.nombre,
            email: user.email,
            tipo_usuario: user.tipo_usuario
        });
    });
});

module.exports = routes;