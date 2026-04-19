const express = require( 'express' );
const http = require( 'http' );
const { Server } = require( 'socket.io' );
const redis = require( 'redis' );

const PORT = 3000;

const app = express();
const server = http.createServer( app );
const io = new Server( server, { cors: { origin: '*' }});

// 1. Agregamos una ruta HTTP para poder validar con http://localhost:3000/
app.get('/', (req, res) => {
    res.json({ status: "Servidor backend funcionando correctamente" });
});

// 2. Corregimos la IP de Redis a la estándar (127.0.0.1)
const suscriber = redis.createClient({
    url: 'redis://127.0.0.1:6379'
});

suscriber.on('error', (err) => console.log('Redis client error:', err));

async function start() {
    try {
        await suscriber.connect();
        console.log('[CONNECTED] Suscriber has been connected to redis.');

        await suscriber.subscribe('weather-cast', (msg) => {
            const data = JSON.parse(msg);
            console.log( `[SUSCRIBER] data collected from: ${data.sensorId}`);

            io.emit('new_weather_data', data);
        });
    } catch (error) {
        console.error('[ERROR CRÍTICO] No se pudo conectar a Redis. Asegúrate de que Docker esté corriendo.', error);
    }
}

start();

server.listen( PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`); 
});