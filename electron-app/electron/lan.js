'use strict';
// LAN IP detection helper.
// Picks the machine's primary IPv4 LAN address so we can build "share" links
// (e.g. http://192.168.1.42:3001) that teammates on the same network can open,
// even though the admin's own window uses http://localhost.

const os = require('node:os');

/**
 * Returns the best-guess LAN IPv4 address for this machine, or '127.0.0.1'
 * if none can be found (e.g. the machine is offline).
 *
 * Heuristics:
 *  - skip internal (loopback) interfaces
 *  - skip IPv6
 *  - skip common virtual adapters (Docker, VMware, VirtualBox, WSL, Hyper-V)
 *  - prefer private ranges (192.168.x / 10.x / 172.16-31.x)
 */
function getLanIp() {
  const ifaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    // Skip obviously-virtual adapters by name.
    if (/^(vEthernet|VMware|VirtualBox|docker|br-|veth|WSL|Loopback)/i.test(name)) {
      continue;
    }
    for (const addr of addrs) {
      // Node <18 uses the string 'IPv4'; Node >=18 also allows the number 4.
      const isV4 = addr.family === 'IPv4' || addr.family === 4;
      if (!isV4 || addr.internal) continue;
      candidates.push(addr.address);
    }
  }

  if (candidates.length === 0) return '127.0.0.1';

  // Prefer typical home/office private ranges over anything else.
  const preferred = candidates.find((ip) => /^(192\.168\.|10\.)/.test(ip))
    || candidates.find((ip) => /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip));

  return preferred || candidates[0];
}

module.exports = { getLanIp };
