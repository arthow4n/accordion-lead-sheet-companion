import { handleRequest } from "./import.ts";

export default {
  fetch(request, env) {
    return handleRequest(request, env.GOOGLE_GENAI_API_KEY);
  },
} satisfies ExportedHandler<Env & { GOOGLE_GENAI_API_KEY?: string }>;
