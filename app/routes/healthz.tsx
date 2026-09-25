import { readFileSync } from "node:fs";

const { version } = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf-8"),
) as { version: string };

export const loader = () => {
  return Response.json({ estado: "ok", version });
};
