const { app, Menu, Tray } = require('electron');
const { menubar } = require('menubar');
const path = require('path');

const Ipc = require('./ipc');

const renderer = `file://${path.resolve(
  __dirname,
  '../renderer',
  'index.html'
)}`;

app.on('ready', () => {
  const mb = menubar({
    index: renderer,
    tray: new Tray(path.resolve(__dirname, 'assets', 'icon.png')),
    browserWindow: {
      width: 370,
      height: 460,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        preload: path.resolve(__dirname, 'preload.js'),
      },
    },
  });

  mb.on('ready', async () => {
    console.log('Electron main - ready');

    /* Initialize Electron ipcMain handlers */
    Ipc.init(mb);
  });
});
