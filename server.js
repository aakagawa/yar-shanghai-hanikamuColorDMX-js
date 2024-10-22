const express = require('express');
const WebSocket = require('ws');
const dgram = require('dgram');
const axios = require('axios'); // For making HTTP requests

const app = express();
const port = 3030;
const spectrometerIP = '192.168.0.100'; // IP address of the spectrometer in AP mode
const client = dgram.createSocket('udp4'); // UDP socket for Art-Net communication

const ARTNET_IP = '192.168.1.200'; // Replace with your DMX controller IP address
const ARTNET_PORT = 6454; // Standard Art-Net port

app.use(express.static('public')); // Serve the static files from the 'public' folder

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${port}`);
});

// WebSocket Server setup
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');

  // Fetch data from the spectrometer periodically
  setInterval(async () => {
    try {
      const response = await axios.get(`http://${spectrometerIP}/data/data.json`); // Fetch spectrometer data
      const sample = response.data;

      // Send spectrometer data to WebSocket clients
      ws.send(JSON.stringify(sample));
    } catch (error) {
      console.error('Error fetching data from spectrometer:', error);
    }
  }, 1000); // Adjust interval as needed

  ws.on('message', (message) => {
    const { universe, channels } = JSON.parse(message); // Expect JSON format {universe, channels}
    sendArtNetData(universe, Buffer.from(channels)); // Send DMX data via Art-Net
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Function to send Art-Net packets
function sendArtNetData(universe, dmxData) {
  const ARTNET_HEADER = Buffer.from('4172742d4e657400', 'hex'); // "Art-Net" header
  const ARTNET_OPCODE = Buffer.from('0050', 'hex'); // OpDmx code
  const ARTNET_PROTVER = Buffer.from('0e00', 'hex'); // Protocol version 14
  const ARTNET_SEQUENCE = Buffer.from('00', 'hex'); // Sequence number (optional)
  const ARTNET_PHYSICAL = Buffer.from('00', 'hex'); // Physical port (optional)
  const UNIVERSE = Buffer.from([universe & 0xff, (universe >> 8) & 0xff]); // Universe number
  const LENGTH = Buffer.from([dmxData.length & 0xff, (dmxData.length >> 8) & 0xff]); // DMX length

  const packet = Buffer.concat([ARTNET_HEADER, ARTNET_OPCODE, ARTNET_PROTVER, ARTNET_SEQUENCE, ARTNET_PHYSICAL, UNIVERSE, LENGTH, dmxData]);

  client.send(packet, ARTNET_PORT, ARTNET_IP, (err) => {
    if (err) {
      console.error('Error sending Art-Net packet:', err);
    } else {
      console.log(`Art-Net packet sent to Universe ${universe}`);
    }
  });
}
