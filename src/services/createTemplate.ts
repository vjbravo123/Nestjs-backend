import * as dotenv from "dotenv";
dotenv.config();

import * as https from "https";

const authKey = process.env.MSG91_AUTH_KEY!;
const INTEGRATED_NUMBER = process.env.MSG91_WHATSAPP_NUMBER!; // <-- ADD THIS IN .env

console.log("Auth key:", authKey);
console.log("WhatsApp Integrated Number:", INTEGRATED_NUMBER);

if (!authKey) {
    throw new Error("❌ MSG91_AUTH_KEY missing in .env");
}

if (!INTEGRATED_NUMBER) {
    throw new Error("❌ MSG91_WHATSAPP_NUMBER missing in .env");
}

const payload = {
    integrated_number: INTEGRATED_NUMBER,
    template_name: "zappy_sms_otp_verification",
    language: "en",
    category: "OTP",
    button_url: "false",
    components: [
        {
            type: "HEADER",
            format: "TEXT",
            text: "OTP Verification",
            example: {
                header_text: ["OTP Verification"]
            }
        },
        {
            type: "BODY",
            text: "Your OTP is {{1}}",
            example: {
                body_text: [["123456"]]
            }
        },
        {
            type: "FOOTER",
            text: "Do not share this OTP with anyone."
        }
    ]
};

// ------------------------------
// CREATE MSG91 WHATSAPP TEMPLATE
// ------------------------------
const options = {
    method: "POST",
    hostname: "api.msg91.com",
    port: null,
    path: "/api/v5/whatsapp/client-panel-template/",
    headers: {
        authkey: authKey,
        "content-type": "application/json"
    }
};

const req = https.request(options, function (res) {
    const chunks: Buffer[] = [];

    res.on("data", function (chunk) {
        chunks.push(chunk);
    });

    res.on("end", function () {
        const body = Buffer.concat(chunks);
        console.log("Response:", body.toString());
    });
});

req.write(JSON.stringify(payload));
req.end();
