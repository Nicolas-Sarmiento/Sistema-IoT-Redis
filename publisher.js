const redis = require( 'redis' );
const axios = require ( 'axios' );

const publisher = redis.createClient({ 
    url: 'redis://127.0.0.1:6379'
});

publisher.on('error', (err) => console.log('Redis client error:', err));

const sensors = [
    { id: 'sensor_bogota', lat: 4.6097, lon: -74.0817 },
    { id: 'sensor_medellin', lat: 6.2518, lon: -75.5636 },
    { id: 'sensor_cali', lat: 3.4372, lon: -76.5225 }
];


async function publishData() {
    console.log( '---[Publishing Data] ---');
    for ( const sensor of sensors ) {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${sensor.lat}&longitude=${sensor.lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m`;
            const response = await axios.get(url);
            const data = response.data.current;

            const payload = {
                sensorId: sensor.id,
                lat: sensor.lat,
                lon: sensor.lon,
                timestamp: new Date().toISOString(),
                temperature: data.temperature_2m,
                humidity: data.relative_humidity_2m,
                pressure: data.surface_pressure,
                windspeed: data.wind_speed_10m
            };

            await publisher.publish('weather-cast', JSON.stringify(payload));
            console.log(`[PUBLISH] Data published from sensor ${sensor.id}`);

        }catch(error) {
            console.error(`Error, sensor id ${sensor.id}: `, error.message);
        }
    }
}

async function run() {
    await publisher.connect();
    console.log( "[CONNECTED] Publishers has been connected to Redis.");

    await publishData();
    setInterval( publishData, 10000 );
}

run();