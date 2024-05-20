// index.js
const express = require('express');
const connectDB = require('./connection/db');
const {initSocket} = require('./connection/socket');
const cors = require('cors')
const bodyParser = require('body-parser');
const routes = require('./api/routes');
const path = require('path');

require('dotenv').config();
const app = express();
const port = 3002;

connectDB(); // Connect to MongoDB

app.use(cors());
app.use(bodyParser.json());

// app.get('',(req,res)=>{
//   res.send('Welcome to Backend')
// })

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(express.static(path.join(__dirname, 'dist')));

app.use('/api', routes);

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

const server = app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});


const io = initSocket(server); // Initialize socket

app.use(express.json());

// Use the aggregated routes

// Socket.io events can be handled here using 'io' object
// For example:
// io.on('someEvent', (data) => { /* handle event */ });
