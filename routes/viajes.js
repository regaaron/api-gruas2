const express = require('express');
const routes = express.Router();
const db = require('../db');
const haversine = require('haversine-distance'); // Instálalo si no lo tienes: npm install haversine-distance

// POST: Registrar un nuevo viaje
routes.post('/Registrar-viaje', (req, res) => {
    const {
        id_cliente,
        id_conductor,
        id_grua,
        latitud_cliente,
        longitud_cliente,
        latitud_conductor,
        longitud_conductor,
        modelo_del_auto,
        placas_cliente,
        comentarios,
        costo_neutro,
        costo_iva
    } = req.body;

    // Validación de campos obligatorios
    if (!id_cliente || !latitud_cliente || !longitud_cliente || !modelo_del_auto || !placas_cliente) {
        return res.status(400).json({
            error: 'Faltan campos obligatorios: id_cliente, coordenadas, modelo y placas son requeridos'
        });
    }

    const sql = `
        INSERT INTO viaje (
            id_cliente,
            id_conductor,
            id_grua,
            latitud_cliente,
            longitud_cliente,
            latitud_conductor,
            longitud_conductor,
            modelo_del_auto,
            placas_cliente,
            comentarios,
            costo_neutro,
            costo_iva
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
        id_cliente,
        id_conductor,
        id_grua,
        latitud_cliente,
        longitud_cliente,
        latitud_conductor,
        longitud_conductor,
        modelo_del_auto,
        placas_cliente,
        comentarios,
        costo_neutro,
        costo_iva
    ];

    db.query(sql, params, function(err, result){
        if (err) {
            console.error('Error al registrar viaje:', err);
            return res.status(500).json({ 
                error: 'Error al registrar el viaje',
                detalles: err.message 
            });
        }

        res.status(201).json({
            success: true,
            message: 'Viaje registrado exitosamente',
            id_viaje: result.insertId,
            datos: {
                id_cliente,
                modelo_del_auto
            }
        });
    });
});

// GET: Obtener todos los viajes
routes.get('/ver-viajes', (req, res) => {
  const sql = 'SELECT * FROM viaje';
 

  db.query(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener los viajes' });
    }

    res.status(200).json(rows);
  });
});


routes.put('/Actualizar-Viajes', async (req, res) => {
  const { id_conductor, latitud_conductor, longitud_conductor, id_cliente } = req.body;

  try {
    // 1. Obtener id_grua del conductor
    const conductorQuery = await db.promise().query(
      'SELECT id_grua FROM gruas WHERE id_conductor = ?',
      [id_conductor]
    );
    if (conductorQuery[0].length === 0) {
      return res.status(404).json({ error: 'Conductor no encontrado' });
    }
    const id_grua = conductorQuery[0][0].id_grua;

    // 2. Obtener latitud y longitud del cliente
    const clienteQuery = await db.promise().query(
      'SELECT latitud, longitud FROM ubicaciones WHERE id_usuario = ?',
      [id_cliente]
    );
    if (clienteQuery[0].length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    const { latitud: latitud_cliente, longitud: longitud_cliente } = clienteQuery[0][0];

    // 3. Calcular distancia usando haversine
    const distancia = haversine(
      { lat: latitud_conductor, lon: longitud_conductor },
      { lat: latitud_cliente, lon: longitud_cliente }
    ) / 1000; // en kilómetros

    const tarifa_base = 10; // puedes ajustar este valor
    const costo_neutro = parseFloat((distancia * tarifa_base).toFixed(2));
    const costo_iva = parseFloat((costo_neutro * 1.16).toFixed(2));

    // 4. Actualizar el viaje
    const sql = `
      UPDATE viaje
      SET 
        id_conductor = ?, 
        id_grua = ?, 
        latitud_conductor = ?, 
        longitud_conductor = ?, 
        costo_neutro = ?, 
        costo_iva = ?
      WHERE id_conductor = 0 AND id_cliente = ?
    `;
    const params = [
      id_conductor,
      id_grua,
      latitud_conductor,
      longitud_conductor,
      costo_neutro,
      costo_iva,
      id_cliente
    ];

    const [updateResult] = await db.promise().query(sql, params);

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Viaje no encontrado o ya tiene conductor' });
    }

    res.status(200).json({
      message: 'Viaje actualizado exitosamente',
      id_conductor,
      id_grua,
      costo_neutro,
      costo_iva
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el viaje' });
  }
});


module.exports = routes;
