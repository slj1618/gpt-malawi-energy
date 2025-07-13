import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const serverSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL_LC_CHATBOT || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export default serverSupabase;
