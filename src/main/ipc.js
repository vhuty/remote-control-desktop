const { ipcMain, Notification } = require('electron');

const executor = require('./commands');

class Ipc {
  static init = (mb) => {
    ipcMain.handle('toggle:window', (_event, arg) => {
      arg.hide ? mb.hideWindow() : mb.showWindow();
    });

    ipcMain.handle('execute:command', async (_event, arg) => {
      return executor.validate(arg.command);
    });

    ipcMain.handle('notification:show', (_event, arg) => {
      if (!Notification.isSupported()) {
        return false;
      }

      const notification = new Notification({
        title: 'RemoteControl',
        body: arg.message,
      });

      notification.show();

      return true;
    });

    ipcMain.handle('cleanup', async (_event, arg) => {
      console.log(arg.success);

      process.exit(0);
    });
  }
}

module.exports = Ipc;