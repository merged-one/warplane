import Fastify from "fastify";

const app = Fastify({ logger: true });

app.get("/healthz", async () => ({ status: "ok" }));

app.get("/api/v1/chains", async () => ({
  chains: [],
  message: "No chains registered yet",
}));

const port = Number(process.env["PORT"] ?? 3100);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
