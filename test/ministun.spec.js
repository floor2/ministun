"use strict";

const assert = require("assert");
const p = require("child_process");
const Ministun = require("../src/ministun.js");
const { MStunMsg } = require("../src/mmsg.js");
const { MStunHeader } = require("../src/mhdr.js");

function udpTest(v) {
	let saddr, golden;

	if (v === 4) {
		// ipv4
		saddr = "127.0.0.1";
		golden = Buffer.from([
			0x01, 0x01, 0x00, 0x2C, 0x21, 0x12, 0xA4, 0x42, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 
			0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x00, 0x20, 0x00, 0x08, 0x00, 0x01, 0x5B, 0x7B, 0x5E, 0x12, 
			0xA4, 0x43, 0x80, 0x22, 0x00, 0x1C, 0x6D, 0x69, 0x6E, 0x69, 0x73, 0x74, 0x75, 0x6E, 0x20, 
			0x62, 0x79, 0x20, 0x4E, 0x6F, 0x61, 0x68, 0x20, 0x4C, 0x65, 0x76, 0x65, 0x6E, 0x73, 0x6F, 
			0x6E, 0x00, 0x00, 0x00
		]);
	} else if (v === 6) {
		// ipv6
		saddr = "::1";
		golden = Buffer.from([
			0x01, 0x01, 0x00, 0x38, 0x21, 0x12, 0xA4, 0x42, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 
			0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x00, 0x20, 0x00, 0x14, 0x00, 0x02, 0x5B, 0x7B, 0x21, 0x12, 
			0xA4, 0x42, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0D, 0x80, 
			0x22, 0x00, 0x1C, 0x6D, 0x69, 0x6E, 0x69, 0x73, 0x74, 0x75, 0x6E, 0x20, 0x62, 0x79, 0x20, 
			0x4E, 0x6F, 0x61, 0x68, 0x20, 0x4C, 0x65, 0x76, 0x65, 0x6E, 0x73, 0x6F, 0x6E, 0x00, 0x00,
			0x00
		]);
	} else if (v === "m") {
		// ipv4 mapped ipv6
		v = 4
		saddr = "127.0.0.1";
		golden = Buffer.from([
			0x01, 0x01, 0x00, 0x38, 0x21, 0x12, 0xA4, 0x42, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 
			0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x00, 0x20, 0x00, 0x14, 0x00, 0x02, 0x5B, 0x7B, 0x21, 0x12, 
			0xA4, 0x42, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0xF8, 0xF7, 0x76, 0x0A, 0x0B, 0x0D, 0x80, 
			0x22, 0x00, 0x1C, 0x6D, 0x69, 0x6E, 0x69, 0x73, 0x74, 0x75, 0x6E, 0x20, 0x62, 0x79, 0x20, 
			0x4E, 0x6F, 0x61, 0x68, 0x20, 0x4C, 0x65, 0x76, 0x65, 0x6E, 0x73, 0x6F, 0x6E, 0x00, 0x00,
			0x00
		]);
	} else {
		throw new Error("v must be equal to 4, 6, or 'm'");
	}

	return new Promise((resolve, reject) => {
		setTimeout(() => {
			// Receive a binding request
			const rhdr = new MStunHeader({
				type: MStunHeader.K_MSG_TYPE.BINDING_REQUEST, 
				len: 0, 
				id: Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C])
			});

			const rmsg = new MStunMsg({hdr: rhdr});

			p.exec(`echo ${rmsg.serialize().toString("hex")} | xxd -r -p | nc -u${v} -w 3 -p 31337 ${saddr} 3478 | xxd -p -c 256`, (err, stdout, stderr) => {
				if (err) {
					throw new Error("Couldn't send test message via netcat");
				}

				const res = Buffer.from(stdout, "hex");
				assert.strictEqual(res.length, golden.length);

				for (let i = 0; i < res.length; i += 1) {
					assert.strictEqual(res[i], golden[i]);
				}

				// Receive a buffer of bad data
				const badstuff = Buffer.from([0x01, 0x01, 0x00, 0x29, 0x21, 0x12, 0xA4, 0x42, 0x00, 0x00, 0xFF, 0xFF, 0xDA, 0x10, 0x00, 0x03, 0xFF, 0x73, 0x20, 0x19]);
				
				p.exec(`echo ${badstuff.toString("hex")} | xxd -r -p | nc -u${v} -w 3 -p 31337 ${saddr} 3478 | xxd -p -c 256`, (err, stdout, stderr) => {
					if (err) {
						throw new Error("Couldn't send test message via netcat");
					}

					const res = Buffer.from(stdout, "hex");
					assert.strictEqual(res.length, 0);

					// TODO: receive a binding request with bad attrs

					resolve();
				});
			});
		}, 2000);
	});
}

(async function runTests() {
	const udp4server = new Ministun({udp4: true, udp6: false});
	await udp4server.start();
	await udpTest(4);
	await udp4server.stop();

	// Travis CI doesn't support IPv6
	// const udp6server = new Ministun({udp4: false, udp6: true});
	// await udp6server.start();
	// await udpTest(6);
	// await udp6server.stop();

	const udp4n6server = new Ministun({udp4: true, udp6: true});
	await udp4n6server.start();
	await udpTest("m");
	await udp4n6server.stop();
})();