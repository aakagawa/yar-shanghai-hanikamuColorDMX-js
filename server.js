// server.js

const express = require('express');
const WebSocket = require('ws');
const dgram = require('dgram');
const axios = require('axios');

const app = express();
const port = 3030;
const spectrometerIP = '192.168.0.100';
const client = dgram.createSocket('udp4');

const ARTNET_IP_1 = '192.168.1.200';
const ARTNET_IP_2 = '192.168.1.201';
const ARTNET_PORT = 6454;

app.use(express.static('public'));

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${port}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');

  setInterval(async () => {
    try {
      const response = await axios.get(`http://${spectrometerIP}/data/data.json`);
      const sample = response.data;

      ws.send(JSON.stringify(sample));
    } catch (error) {
      console.error('Error fetching data from spectrometer:', error);
    }
  }, 1000);

  ws.on('message', (message) => {
    const { universe, channels } = JSON.parse(message);
    sendArtNetData(universe, Buffer.from(channels));
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

function sendArtNetData(universe, dmxData) {
  const ARTNET_HEADER = Buffer.from('4172742d4e657400', 'hex');
  const ARTNET_OPCODE = Buffer.from('0050', 'hex');
  const ARTNET_PROTVER = Buffer.from('000e', 'hex');
  const ARTNET_SEQUENCE = Buffer.from('00', 'hex');
  const ARTNET_PHYSICAL = Buffer.from('00', 'hex');
  const UNIVERSE = Buffer.from([universe & 0xff, (universe >> 8) & 0xff]);
  const LENGTH = Buffer.from([0x02, 0x00]); 

  const packet = Buffer.concat([ARTNET_HEADER, ARTNET_OPCODE, ARTNET_PROTVER, ARTNET_SEQUENCE, ARTNET_PHYSICAL, UNIVERSE, LENGTH, dmxData]);

  console.log(packet);
  
  // Determine which IP to send to based on universe
  const targetIP = (universe === 2|| universe === 3) ? ARTNET_IP_2 : ARTNET_IP_1;

  client.send(packet, ARTNET_PORT, targetIP, (err) => {
    if (err) {
      console.error('Error sending Art-Net packet:', err);
    } else {
      console.log(`Art-Net packet sent to ${targetIP} for Universe ${universe}`);
    }
  });
}
