const { initializeApp } = require('firebase-admin/app');

initializeApp();

exports.assistantChat = require('./assistant').assistantChat;
