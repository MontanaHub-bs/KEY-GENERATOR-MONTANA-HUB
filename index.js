const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    PermissionFlagsBits 
} = require('discord.js');
const express = require('express');
require('dotenv').config();

// ==========================================
// 1. SERVIDOR WEB (Verificación para Roblox)
// ==========================================
const app = express();
app.use(express.json());

const keysDB = new Map();

app.post('/verify', (req, res) => {
    const { key } = req.body;

    if (!key || !keysDB.has(key)) {
        return res.status(200).json({ success: false, message: "Error: Key incorrecta o no existe" });
    }

    const keyData = keysDB.get(key);
    
    // Validar si expiró
    if (keyData.expiraEn !== 'Nunca' && Date.now() > keyData.expiraEn) {
        keysDB.delete(key);
        return res.status(200).json({ success: false, message: "Error: La key ha expirado" });
    }

    return res.status(200).json({ success: true, message: "Key válida" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[SERVER] Activo en el puerto ${PORT}`);
});

// ==========================================
// 2. BOT DE DISCORD (/genkey)
// ==========================================
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const commands = [
    new SlashCommandBuilder()
        .setName('genkey')
        .setDescription('Genera una key de acceso.')
        .addStringOption(option =>
            option.setName('time')
                .setDescription('Selecciona la duración')
                .setRequired(true)
                .addChoices(
                    { name: '1 Hora (1h)', value: '1h' },
                    { name: '1 Día (1d)', value: '1d' },
                    { name: 'Permanente (perm)', value: 'perm' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
    console.log(`[BOT] Conectado como ${client.user.tag} (24/7)`);
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('[BOT] Comandos Slash registrados correctamente.');
    } catch (error) {
        console.error('[BOT ERROR]:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'genkey') return;

    const seleccion = interaction.options.getString('time');
    const uniqueKey = `MONTANA-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    let tiempoTexto = '';
    let expiraEn = null;
    const ahora = Date.now();

    if (seleccion === '1h') {
        tiempoTexto = '1 Hora';
        expiraEn = ahora + (60 * 60 * 1000);
    } else if (seleccion === '1d') {
        tiempoTexto = '1 Día';
        expiraEn = ahora + (24 * 60 * 60 * 1000);
    } else if (seleccion === 'perm') {
        tiempoTexto = 'Permanente';
        expiraEn = 'Nunca';
    }

    keysDB.set(uniqueKey, { expiraEn });

    const embed = new EmbedBuilder()
        .setColor(0xE32323)
        .setTitle('🔑 Key Generada - Montana Hub')
        .addFields(
            { name: 'Llave (Copia esto)', value: `\`\`\`${uniqueKey}\`\`\`` },
            { name: 'Duración', value: tiempoTexto, inline: true },
            { name: 'Generada por', value: interaction.user.tag, inline: true }
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
});

client.login(process.env.DISCORD_TOKEN);
