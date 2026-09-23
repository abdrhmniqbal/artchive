import { createServerFn } from "@tanstack/react-start";
import { getSessionUser } from "./server";

export const getIsAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser();
  return !!user && user.role === "admin";
});
