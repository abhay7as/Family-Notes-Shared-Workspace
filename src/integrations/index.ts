

import { supabase } from "./supabase/client";


type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};



      if (result.redirected) {
        return result;
      }

      if (result.error) {
        return result;
      }

      try {
        await supabase.auth.setSession(result.tokens);
      } catch (e) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
      return result;
    },
  },
};
