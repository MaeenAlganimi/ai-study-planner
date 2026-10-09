import { config as loadEnv } from "dotenv";
import { createApp } from "./app";
import { readConfig } from "./config";
import { createLlmProvider } from "./llm/createProvider";
import { resolvePaths } from "./paths";

const paths = resolvePaths(import.meta.url);
loadEnv({ path: paths.envFile });

const config = readConfig(process.env, paths);
const llm = createLlmProvider(process.env);
const app = createApp({ config, llm });

app.listen(config.port, () => {
  console.log(`Atrium API listening on :${config.port} (${llm.name})`);
});
