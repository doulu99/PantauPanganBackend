// swagger.js
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Food Price Monitor API',
      version: '1.0.0',
      description: 'API documentation for Food Price Monitor',
    },
    servers: [
      {
        url: 'http://localhost:5000/api', // sesuaikan dengan base API kamu
      },
    ],
  },
  // Tentukan file mana yang berisi anotasi swagger
  apis: ['./routes/*.js'], // nanti bisa tambahkan anotasi di route
};

const specs = swaggerJsdoc(options);

module.exports = { swaggerUi, specs };
