const express = require('express');
const routes = express.Router();
const db = require('../db');

// POST: Registrar un nuevo viaje
routes.post('/Registrar-Viajes', (req, res) => {
  const { id_cliente, destino, latitud_cliente, longitud_cliente } = req.body;

  const sql = `
    INSERT INTO viajes (id_cliente, destino, latitud_cliente, longitud_cliente, id_conductor)
    VALUES (?, ?, ?, ?, 0)
  `;

  const params = [id_cliente, destino, latitud_cliente, longitud_cliente];

  db.run(sql, params, function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al registrar el viaje' });
    }

    res.status(201).json({
      message: 'Viaje registrado exitosamente',
      id_viaje: this.lastID,
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

// PUT: Actualizar un viaje (asignar conductor y coordenadas)
routes.put('/Actualizar-Viajes', (req, res) => {
  const { id_conductor, latitud_conductor, longitud_conductor, id_cliente } = req.body;

  const sql = `
    UPDATE viajes
    SET id_conductor = ?, latitud_conductor = ?, longitud_conductor = ?
    WHERE id_conductor = 0 AND id_cliente = ?
  `;

  const params = [id_conductor, latitud_conductor, longitud_conductor, id_cliente];

  db.run(sql, params, function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al actualizar el viaje' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Viaje no encontrado o ya tiene conductor' });
    }

    res.status(200).json({ message: 'Viaje actualizado exitosamente' });
  });
});

module.exports = routes;
