require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;

const app = express();

const USERS_FILE = './users.json';

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, '[]');
}

function getUsers() {
    return JSON.parse(fs.readFileSync(USERS_FILE));
}

function saveUsers(users) {
    fs.writeFileSync(
        USERS_FILE,
        JSON.stringify(users, null, 2)
    );
}

app.use(express.static(path.join(__dirname)));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: 'https://veriffy.onrender.com/auth/discord/callback',
    scope: ['identify', 'guilds']
},
(accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/auth/discord',
    passport.authenticate('discord')
);

app.get(
    '/auth/discord/callback',
    passport.authenticate('discord', {
        failureRedirect: '/'
    }),
    async (req, res) => {

        const ip =
            req.headers['x-forwarded-for'] ||
            req.socket.remoteAddress;

        let users = getUsers();

        const alreadyExists = users.find(
            u => u.discordId === req.user.id
        );

        if (!alreadyExists) {

            users.push({
                discordId: req.user.id,
                username: req.user.username,
                ip: ip,
                createdAt: new Date()
            });

            saveUsers(users);
        }

        const sameIpAccounts = users.filter(
            u => u.ip === ip
        );

        let html = `
        <html>
        <head>
            <title>Verify Complete</title>
            <link rel="stylesheet" href="/style.css">
        </head>
        <body>

        <div class="container">
            <div class="card">

            <h1>Zweryfikowano</h1>

            <h2>Powiązane konta:</h2>
        `;

        sameIpAccounts.forEach(acc => {
            html += `
                <div class="account">
                    ${acc.username}
                    (${acc.discordId})
                </div>
            `;
        });

        if (sameIpAccounts.length > 1) {
            html += `
                <div class="multi">
                    ⚠ Wykryto MULTI KONTA
                </div>
            `;
        }

        html += `
            </div>
        </div>

        </body>
        </html>
        `;

        res.send(html);
    }
);

app.get('/admin', (req, res) => {

    const users = getUsers();

    let html = `
    <html>
    <head>
        <title>Admin Panel</title>
        <link rel="stylesheet" href="/style.css">
    </head>
    <body>

    <div class="container">
        <div class="card">

        <h1>Wszystkie konta</h1>
    `;

    users.forEach(user => {

        const sameIp = users.filter(
            u => u.ip === user.ip
        );

        html += `
        <div class="account">
            <b>${user.username}</b><br>
            ID: ${user.discordId}<br>
            IP: ${user.ip}<br>
            Multi Accounts: ${sameIp.length}
        </div>
        `;
    });

    html += `
        </div>
    </div>

    </body>
    </html>
    `;

    res.send(html);
});

app.listen(3000, () => {
    console.log(
        'Server running on http://localhost:3000'
    );
});