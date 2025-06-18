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

    const tarifa_base = 150; // puedes ajustar este valor
    const costo_neutro = parseFloat((distancia * tarifa_base).toFixed(2));
    const costo_iva = parseFloat((costo_neutro * 0.16).toFixed(2));
    console.log(`📌 Distancia calculada: ${distancia} km, Costo neutro: ${costo_neutro}, Costo IVA: ${costo_iva}`);
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
      WHERE id_conductor IS NULL AND id_cliente = ?
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
    
    console.log(`📌 Punto numero 1`);
        // 5. Obtener el ID del viaje actualizado
    const [viajeActualizado] = await db.promise().query(
      'SELECT id_viaje FROM viaje WHERE id_cliente = ? AND id_conductor = ? ORDER BY id_viaje DESC LIMIT 1',
      [id_cliente, id_conductor]
    );
    const id_viaje = viajeActualizado[0]?.id_viaje;

    if (!id_viaje) {
      return res.status(500).json({ error: 'No se pudo recuperar el ID del viaje actualizado' });
    }
    console.log(`📌 Punto numero 2`);
    // 6. Buscar el último reporte activo
    const [ultimoReporte] = await db.promise().query(
      'SELECT * FROM reporte_ventas ORDER BY id_reporte DESC LIMIT 1'
    );

    let id_reporte;
    console.log(`📌 Punto numero 3`);
    if (ultimoReporte.length === 0 || ultimoReporte[0].numero_servicios_completados >= 170) {
      // Crear nuevo reporte
      console.log(`📌 Punto numero 4`);
      const fecha_generacion = new Date();
      const [insertReporte] = await db.promise().query(
        `INSERT INTO reporte_ventas (
          fecha_generacion, total_ingreso, numero_servicios_completados, 
          promedio_ingresos, margen_ganancia, comision_conductores, 
          costos_operativos, horas_pico
        ) VALUES (?, 0, 0, 0, 0, 0, 0, 0)`,
        [fecha_generacion]
      );
      id_reporte = insertReporte.insertId;
    } else {
      id_reporte = ultimoReporte[0].id_reporte;

      // Actualizar reporte existente
      console.log(`📌 Punto numero 5`);

      const ingresoAnterior = parseFloat(ultimoReporte[0].total_ingreso) || 0;
      const total_ingreso = parseFloat((ingresoAnterior + costo_iva).toFixed(2));

      const serviciosCompletados = parseInt(ultimoReporte[0].numero_servicios_completados) || 0;
      const numero_servicios_completados = serviciosCompletados + 1;

      const promedio_ingresos = parseFloat((total_ingreso / numero_servicios_completados).toFixed(2));
      const margen_ganancia = parseFloat((total_ingreso * 0.20).toFixed(2)); // ejemplo: 20%
      const comision_conductores = parseFloat((total_ingreso * 0.50).toFixed(2)); // ejemplo: 50%
      const costos_operativos = parseFloat((total_ingreso * 0.30).toFixed(2)); // ejemplo: 30%

      console.log(`📌 Punto numero 6`);

      await db.promise().query(
        `UPDATE reporte_ventas SET 
          total_ingreso = ?, 
          numero_servicios_completados = ?, 
          promedio_ingresos = ?, 
          margen_ganancia = ?, 
          comision_conductores = ?, 
          costos_operativos = ? 
        WHERE id_reporte = ?`,
        [total_ingreso, numero_servicios_completados, promedio_ingresos, margen_ganancia, comision_conductores, costos_operativos, id_reporte]
      );
    }
    console.log(`📌 Punto numero 7`);
    // 7. Insertar nueva venta
    const fechaVenta = new Date();
    await db.promise().query(
      `INSERT INTO venta (tipo, fecha, id_viaje, id_reporte) VALUES (?, ?, ?, ?)`,
      ['servicio', fechaVenta, id_viaje, id_reporte]
    );

    console.log(`📌 Punto numero 8`);
    res.status(200).json({
      message: 'Viaje actualizado exitosamente',
      id_conductor,
      id_grua,
      costo_neutro,
      costo_iva
    });

  } catch (error) {
    console.log(`📌 Punto de error`);
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el viaje' });
  }
});


module.exports = routes;
