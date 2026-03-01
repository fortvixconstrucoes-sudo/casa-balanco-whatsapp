export default function handler(req, res) {
  const VERIFY_TOKEN = "fortvix_verify_2026";

  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    } else {
      return res.status(403).send("Verification failed");
    }
  }

  if (req.method === "POST") {
    console.log("Webhook recebido:", req.body);
    return res.status(200).json({ status: "ok" });
  }

  return res.status(405).end();
}
