import dotEnv from "dotenv";
import path from "path";
dotEnv.config();

import http from "http";
import { send } from "../queue";

import fs from "fs";
import logger from "../helpers/winston";

const server = http.createServer((req, res) => {
  if (req.method === "POST") {
    return handlePostRequest(req, res);
  }

  if (req.method === "GET") {
    return handleGetRequest(req, res);
  }
});

const handlePostRequest = async (
  req: http.IncomingMessage,
  res: http.ServerResponse<http.IncomingMessage>
) => {
  if (req.url === "/trigger-puppeteer") {
    const body: any[] = [];
    // we can access HTTP headers
    req.on("data", (chunk) => {
      body.push(chunk);
    });
    req.on("end", async () => {
      //end of data

      const data = JSON.parse(body.toString());
      await send(data);
    });
  }

  res.setHeader("Content-Type", "application/json;charset=utf-8");
  res.end(JSON.stringify("Demo"));
};

const handleGetRequest = async (
  req: http.IncomingMessage,
  res: http.ServerResponse<http.IncomingMessage>
) => {
  const file = fs.readFileSync(path.resolve("public/index.html"));
  logger.info(`Fetched from ${process.env.NODE_ENV}`);
  res.setHeader("Content-Type", "text/html");
  res.end(file);
};

server.listen(process.env.PORT, () =>
  logger.info(`Sever Running! port- ${process.env.PORT}`)
);
