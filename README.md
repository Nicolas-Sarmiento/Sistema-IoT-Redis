# Simulación de Sistema IoT 

Sistema de monitoreo en tiempo real de un sistema IoT simulado con datos de una API pública.

## Integrantes:
- Kimberly Natalia Figueroa Zapata.
- Edwin David Martinez Gomez.
- Andres Felipe Luna Becerra.
- Nicolas Sarmiento Vargas


# Ejecución

Clonar el repositorio

``` 
git clone https://github.com/Nicolas-Sarmiento/Sistema-IoT-Redis.git
``` 

Luego crear el proyecto de node e instalar las dependencias.

``` 
npm init -y
``` 

``` 
npm install redis axios express socket.io
``` 
Crear la base de datos de redis utilizando docker

``` 
docker run --name redis-iot-grupo1 -p 6379:6379 -d redis
``` 
>[!WARNING]
> Si ya existe la imagen, puede borrarla antes de ejecutar el comando anterior o simplemente ejecutar el contenedor con el siguiente comando:

``` 
docker start redis-iot-grupo1
``` 

Luego, solo queda encender los servicios, primero el servicio del publisher:

``` 
node publisher.js
``` 

Luego el servicio del suscriber:

``` 
node suscriber.js
```

Finalmente, el servicio del front-end:

``` aquí el comando 
``` 


## Descripción de los datos API

Se tiene la siguiente estructura de datos por cada sensor.
```
{
    sensorId: {string},
    lat: {float},
    lon: {float},
    timestamp: {timestamp},
    temperature: {float},
    humidity: {float},
    pressure: {float},
    windspeed: {float}
}
```
Cada campo tiene la siguiente descripción:
- sensorId: identficador del sensor.
- lat: latitud de la posición sensor. 
- lon: longitud de la posición del sensor.
- timestamp: tiempo en el cual se ingresó la medición.
- temperatura: valor de la temperatura en grados celsius.
- humidity: humedad relativa en porcentaje.
- pressure: presión atmosférica medida en Hectopascales (hPa).
- windspeed: velocidad del viento medida en km/h.

Valores tomados a 2 metros sobre el suelo y a 10 metros sobre el suelo para el viento, con la finalidad de simular una torre o estación meteorológica.
