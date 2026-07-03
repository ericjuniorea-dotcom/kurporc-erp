import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id:          string;
      email:       string;
      name:        string;
      tenantId:    string;
      tenantSlug:  string;
      farmName:    string;
      plan:        string;
      roles:       number[];
      language:    string;
    };
  }

  interface User {
    id:          string;
    tenantId:    string;
    tenantSlug:  string;
    farmName:    string;
    plan:        string;
    roles:       number[];
    language:    string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id:          string;
    tenantId:    string;
    tenantSlug:  string;
    farmName:    string;
    plan:        string;
    roles:       number[];
    language:    string;
  }
}
