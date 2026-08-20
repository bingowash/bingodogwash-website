import httpServer from "http-server";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const port = 3000;
const root = fileURLToPath(new URL("./public", import.meta.url));

export default async function globalSetup() {
  const server = httpServer.createServer({ root, cache: 3600 });
  const listener = server.server;

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    listener.once("error", onError);
    server.listen(port, host, () => {
      listener.off("error", onError);
      resolve();
    });
  });

  return async () => {
    await new Promise<void>((resolve, reject) => {
      listener.close((error?: Error) => error ? reject(error) : resolve());
    });
  };
}
