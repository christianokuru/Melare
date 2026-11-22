import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
delete process.env.RESEND_API_KEY; // never send real email from tests
