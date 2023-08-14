@echo off

IF NOT EXIST node_modules (
    echo Installing dependencies...
    npm install
)

pm2 start index.js --name AresBuyBot --watch