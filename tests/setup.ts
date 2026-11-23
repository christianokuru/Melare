import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
delete process.env.RESEND_API_KEY; // never send real email from tests
delete process.env.VAPID_PRIVATE_KEY; // never push to real admin devices from tests
