// import { createClient } from "@supabase/supabase-js";
// import { config } from "dotenv";
// config();

// // Use service_role key for server-side operations that bypass RLS or need elevated permissions.
// // NEVER expose this key to the client-side.
// const supabaseUrl =
//   // process.env.NEXT_PUBLIC_SUPABASE_URL ||
//   "https://arqobvxvzmzlowtieoyj.supabase.co"; // Public for client, but used here for consistency
// const supabaseServiceRoleKey =
//   // process.env.SUPABASE_SERVICE_ROLE_KEY ||
//   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFycW9idnh2em16bG93dGllb3lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3MjcwODAsImV4cCI6MjA2NTMwMzA4MH0.0AANCWjkhFJvrzEyFMvr3sFwdZ_EhD5sdmMIDnThiqA";

// if (!supabaseUrl || !supabaseServiceRoleKey) {
//   console.error(
//     "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
//   );
//   // Depending on your setup, you might want to throw an error or handle this differently
// }

// export const serverSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// // const res = await serverSupabase.from("chat_messages").select("role, content");
