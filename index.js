const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');

const app = express();
app.use(express.json());

const activeKeys = new Map();

app.post('/verify', (req, res) => {
    const { key } = req.body;
    if (!key) return res.json({ success: false, message: "No key provided" });
    const expirationTime = activeKeys.get(key);
    if (!expirationTime || Date.now() > expirationTime) {
        if (expirationTime) activeKeys.delete(key);
        return res.json({ success: false, message: "Invalid or expired key" });
    }
    return res.json({ success: true, message: "Key valid" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor web en puerto ${PORT}`));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const commands = [
    new SlashCommandBuilder()
        .setName('genkey')
        .setDescription('Genera una key para Montana Hub')
        .addStringOption(option =>
            option.setName('tiempo')
                .setDescription('Duración (ej: 1h, 1d, 30m)')
                .setRequired(true)
        )
].map(cmd => cmd.toJSON());

client.once('ready', async () => {
    console.log(`¡Conectado como ${client.user.tag}!`);
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        console.log('Actualizando comandos globales...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('¡Comandos globales registrados con éxito!');
    } catch (error) {
        console.error('Error registrando comandos:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'genkey') {
        const tiempoInput = interaction.options.getString('tiempo');
        let ms = 0, texto = "";
        
        if (tiempoInput.endsWith('h')) {
            ms = parseInt(tiempoInput) * 3600000; texto = `${parseInt(tiempoInput)} hora(s)`;
        } else if (tiempoInput.endsWith('d')) {
            ms = parseInt(tiempoInput) * 86400000; texto = `${parseInt(tiempoInput)} día(s)`;
        } else if (tiempoInput.endsWith('m')) {
            ms = parseInt(tiempoInput) * 60000; texto = `${parseInt(tiempoInput)} minuto(s)`;
        } else {
            return interaction.reply({ content: '❌ Usa un formato válido como 1h, 1d o 30m.', ephemeral: true });
        }

        const key = `MONTANA-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Math.floor(Math.random() * 8999 + 1000)}`;
        activeKeys.set(key, Date.now() + ms);

        await interaction.reply({ content: `✅ Key generada: \`${key}\` (${texto})`, ephemeral: true });
    }
});

client.login(TOKEN);

