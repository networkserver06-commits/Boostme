export const startLogin = () => {
  if (typeof window !== "undefined") window.location.assign("/auth");
};
