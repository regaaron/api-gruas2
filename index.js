const express = require('express');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 3000;
const cors = require('cors');
app.use(cors());

const clientesRoutes = require('./routes/clientes');

app.use(express.json());
app.use('/api/clientes', clientesRoutes);
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);

});