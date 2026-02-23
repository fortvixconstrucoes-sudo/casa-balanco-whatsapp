export default async function handler(req, res) {
  if (req.method === "GET") {
    const verify_token = process.env.WHATSAPP_VERIFY_TOKEN;
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token === verify_token) {
      return res.status(200).send(challenge);
    } else {
      return res.status(403).send("Verification failed");
    }
  }

  if (req.method === "POST") {
    console.log("Webhook recebido:", req.body);
    return res.status(200).json({ status: "ok" });
  }

  res.status(405).end();
}
