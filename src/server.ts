import fastify from "fastify";

const app = fastify()

app.listen({port: 4000}).then(() => {
  console.log("Server Running!")
})