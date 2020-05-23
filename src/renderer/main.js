const { ipcRenderer } = require('electron');
const QRCode = require('qrcode');
const rtc = require('./rtc');

const Api = require('./api');

Vue.device = Vue.prototype.$device = window.$device;
Vue.api = Vue.prototype.$api = new Api(window.$device);
Vue.ipc = Vue.prototype.$ipc = ipcRenderer;

this.app = new Vue({
  el: '#app',
  data: {
    key: null,
    connection: null,
    onLine: navigator.onLine
  },
  methods: {
    // For the testing purposes
    async execute(command) {
      const { error, payload } = await this.$ipc.invoke(
        'execute:command',
        { command }
      );

      if(error) {
        return console.error(error);
      }
      
      console.log(payload);
    },
    async listen() {
      const { error, key, connection } = await this.$api.listen();

      if (error) {
        // Use dialog
        return alert(error);
      }

      this.key = key;

      this.$nextTick(() => {
        QRCode.toCanvas(this.$refs.qr, key, {
          width: 250,
        });
      });

      this.connection = connection;

      connection.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        const { source, data, status, signal } = message;
        const controller = await this.$api.getController(source);

        if (controller) {
          if (status) {
            this.$ipc.invoke('notification:show', {
              message: `${controller.name} is ${status}`,
            });
          }

          if (data) {
            const { error, payload } = await this.$ipc.invoke(
              'execute:command',
              { command: data }
            );

            const response = {
              payload,
            };

            if (error) {
              await this.$ipc.invoke('notification:show', {
                message: `${controller.name}: ${data}`,
              });

              response.payload = 'Message sent';
            }

            connection.send(JSON.stringify(response));
          }

          if (signal) {
            this.peer.signal(signal);
          }
        }
      };

      connection.onerror = () => {
        // Error dialog
      };

      (async function handlePeer() {
        this.peer = await rtc.getPeer();

        this.peer.on('signal', (signal) => {
          const data = JSON.stringify({
            source: this.$device.id,
            signal,
          });

          this.connection.send(data);
        });

        this.peer.on('close', async () => {
          /* Reinitialize RTC connection peer */
          if (this.connection.readyState === WebSocket.OPEN) {
            await handlePeer.call(this);

            const message = JSON.stringify({
              source: this.$device.id,
              status: 'ready',
            });

            this.connection.send(message);
          }
        });

        this.peer.on('error', (err) => {
          /* App has been closed by user */
          if (err.code === 'ERR_CONNECTION_FAILURE') {
            return;
          }

          alert(err.message);
        });
      }.call(this));
    },
    async stop() {
      const { error } = await this.$api.stop();

      if (error) {
        return alert(error);
      }

      this.key = null;

      if (this.connection) {
        this.connection.close();
      }

      if (this.peer) {
        this.peer.destroy();
      }
    },
    async copyAccessKey() {
      try {
        await navigator.clipboard.writeText(this.key);
      } catch (err) {
        // Use dialog
        alert(error);
      }
    }
  },
  async created() {
    if (!localStorage.registered) {
      const { error } = await this.$api.register();
      if (!error) {
        localStorage.registered = true;
      }
    }

    this.$ipc.on('cleanup', async () => {
      const result = {
        success: true,
      };

      try {
        await this.stop();
      } catch {
        result.success = false;
      }

      this.$ipc.invoke('cleanup', result);
    });
  },
  async mounted() {
    window.addEventListener('offline', () => {
      this.$refs.btnListen.disabled = true;

      this.$ipc.invoke('notification:show', {
        message: `Oops... Check your internet connection`,
      });
    });
    window.addEventListener('online', () => {
      this.$refs.btnListen.disabled = false;
    });
  },
});
