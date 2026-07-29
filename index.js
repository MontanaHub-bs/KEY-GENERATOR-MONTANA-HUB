const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');

// Configuración de Express para el servidor web que revisa las keys desde Roblox
const app = express();
app.use(express.json());

// Base de datos temporal en memoria para almacenar las llaves activas
const activeKeys = new Map(); // Formato: "KEY-XXXX" -> timestamp de expiración

// 1. Ruta que consulta Roblox para verificar si una key es válida o expiró
app.post('/verify', (req, res) => {
    const { key } = req.body;

    if (!key) {
        return res.json({ success: false, message: "No key provided" });
    }

    const expirationTime = activeKeys.get(key);

    if (!expirationTime) {
        return res.json({ success: false, message: "Invalid key" });
    }

    // Verificar si la key ya expiró comparándola con el tiempo actual
    if (Date.now() > expirationTime) {
        activeKeys.delete(key); // Eliminar key expirada
        return res.json({ success: false, message: "Expired key" });
    }

    // Si todo es correcto
    return res.json({ success: true, message: "Key valid" });
});

// Iniciar servidor web en el puerto que asigna Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor web corriendo en el puerto ${PORT}`);
});

// 2. Configuración del Bot de Discord
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Definición del comando /genkey
const commands = [
    new SlashCommandBuilder()
        .setName('genkey')
        .setDescription('Genera una nueva key de acceso para Montana Hub')
        .addStringOption(option =>
            option.setName('tiempo')
                .setDescription('Duración de la key (ej: 1h para 1 hora, 1d para 1 día)')
                .setRequired(true)
        )
].map(command => command.toJSON());

// Registrar los comandos de barra en Discord al encender
client.once('ready', async () => {
    console.log(`¡Bot conectado exitosamente como ${client.user.tag}!`);

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        console.log('Registrando comandos de barra (/genkey)...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands },
        );
        console.log('¡Comandos registrados correctamente en Discord!');
    } catch (error) {
        console.error('Error al registrar los comandos:', error);
    }
});

// Manejar la ejecución del comando /genkey en el chat
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'genkey') {
        const tiempoInput = interaction.options.getString('tiempo');
        
        // Calcular los milisegundos según lo que pida el usuario
        let duracionMs = 0;
        let textoTiempo = "";

        if (tiempoInput.endsWith('h')) {
            const horas = parseInt(tiempoInput) || 1;
            duracionMs = horas * 60 * 60 * 1000;
            textoTiempo = `${horas} hora(s)`;
        } else if (tiempoInput.endsWith('d')) {
            const dias = parseInt(tiempoInput) || 1;
            duracionMs = dias * 24 * 60 * 60 * 1000;
            textoTiempo = `${dias} día(s)`;
        } else if (tiempoInput.endsWith('m')) {
            const minutos = parseInt(tiempoInput) || 1;
            duracionMs = minutos * 60 * 1000;
            textoTiempo = `${minutos} minuto(s)`;
        } else {
            return interaction.reply({ content: '❌ Formato de tiempo inválido. Usa por ejemplo: **1h** (horas), **1d** (días) o **30m** (minutos).', ephemeral: true });
        }

        // Crear una key única de Montana Hub
        const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const nuevaKey = `MONTANA-${randomCode}-${Math.floor(Math.random() * 8999 + 1000)}`;
        
        // Guardar la key en la base de datos con su tiempo de expiración exacto
        const expirationTime = Date.now() + duracionMs;
        activeKeys.set(nuevaKey, expirationTime);

        // Enviar la key de forma privada (ephemeral) al usuario que ejecutó el comando
        await interaction.reply({ 
            content: `✅ **¡Key generada con éxito para Montana Hub!**\n\n🔑 Tu Key: \`${nuevaKey}\`\n⏳ Duración: **${textoTiempo}**\n\n*Cópiala y pégala en el script de Roblox para ingresar.*`, 
            ephemeral: true 
        });
    }
});

// Iniciar sesión con el bot usando el token de las variables de entorno de Render
client.login(TOKEN);
