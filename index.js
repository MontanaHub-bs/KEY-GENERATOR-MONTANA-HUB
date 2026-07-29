const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');

const app = express();
app.use(express.json());

const activeKeys = new Map();

app.post('/verify', (req, res) => {
    const { key } = req.body;

    if (!key) {
        return res.json({ success: false, message: "No key provided" });
    }

    const expirationTime = activeKeys.get(key);

    if (!expirationTime) {
        return res.json({ success: false, message: "Invalid key" });
    }

    if (Date.now() > expirationTime) {
        activeKeys.delete(key);
        return res.json({ success: false, message: "Expired key" });
    }

    return res.json({ success: true, message: "Key valid" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor web corriendo en el puerto ${PORT}`);
});

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

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

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'genkey') {
        const tiempoInput = interaction.options.getString('tiempo');
        
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

        const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const nuevaKey = `MONTANA-${randomCode}-${Math.floor(Math.random() * 8999 + 1000)}`;
        
        const expirationTime = Date.now() + duracionMs;
        activeKeys.set(nuevaKey, expirationTime);

        await interaction.reply({ 
            content: `✅ **¡Key generada con éxito para Montana Hub!**\n\n🔑 Tu Key: \`${nuevaKey}\`\n⏳ Duración: **${textoTiempo}**\n\n*Cópiala y pégala en el script de Roblox para ingresar.*`, 
            ephemeral: true 
        });
    }
});

client.login(TOKEN);
