const { apiUrl } = require('./config');

class Api {
  constructor(device) {
    this.device = device;
  }

  async register() {
    const { id, name, type } = this.device;

    const body = {
      id,
      data: {
        meta: {
          name,
          type,
        },
      },
    };

    const response = await fetch(`${apiUrl.http}/device/`, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const { message } = await response.json();
      return { error: message };
    }

    return {};
  }

  async listen() {
    const body = { id: this.device.id };

    const response = await fetch(`${apiUrl.http}/device/listen/`, {
      method: 'PUT',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {

      return { error: data.message };
    }

    return {
      key: data.key,
      connection: new WebSocket(apiUrl.ws),
    };
  }

  async stop() {
    const body = { id: this.device.id };

    const response = await fetch(`${apiUrl.http}/device/stop/`, {
      method: 'PUT',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const { message } = await response.json();
      return { error: message };
    }

    return {};
  }

  async getController(id) {
    const response = await fetch(`${apiUrl.http}/controller/${id}/`);
    const data = await response.json();

    if (!response.ok) {
      return { error: data.message };
    }

    return data;
  }
}
module.exports = Api;