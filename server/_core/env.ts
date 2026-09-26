export const ENV = {
  databaseUrl: process.env.TURSO_DATABASE_URL ?? "",
  adminEmail: process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "",
  isProduction: process.env.NODE_ENV === "production",
};
