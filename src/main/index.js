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
    tray: getCustomTray(),
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

function getCustomTray() {
  const image = path.resolve(__dirname, 'assets', 'icon.png');
  const tray = new Tray(image);

  tray.setContextMenu(new Menu());

  return tray;
}
