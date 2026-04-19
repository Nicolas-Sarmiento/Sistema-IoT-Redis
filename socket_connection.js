const { io } = require("socket.io-client");

const socket = io("http://localhost:3000");

console.log("Intentando conectar al socket...");

// Para conectar
socket.on("connect", () => {
    console.log("✅ ¡Conectado exitosamente al servidor Socket.io!");
    console.log("Esperando datos del clima...");
});

//Escuchar eventos, así se extraen los nuevos datos del clima.
socket.on("new_weather_data", (data) => {
    console.log("\n¡Dato recibido por el socket!");
    console.log("-----------------------------------");
    console.log(data);
});

// Evento si ocurre un error
socket.on("connect_error", (err) => {
    console.log("Error de conexión:", err.message);
});

// Escuchar desconexión.
socket.on("disconnect", () => {
    console.log("Desconectado del servidor");
});