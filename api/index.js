const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const authRoutes = require('../routes/auth');
const userRoutes = require('../routes/user');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Роуты
app.use('/auth', authRoutes);
app.use('/user', userRoutes);

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));