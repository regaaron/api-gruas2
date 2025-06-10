const express = require('express');
const routes = express.Router();
const db = require('../db'); // Import the database connection

routes.get('/ver-gruas',(reqs,res)=>{
    db.query('SELECT id_grua,modelo,numero_serie,placa,tipo_grua FROM gruas',(err, results)=>{
        if (err) {
            console.error('Error fetching gruas:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(results);
    });
})

module.exports = routes;
