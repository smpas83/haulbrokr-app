import { createKipApi } from "./server";

const port = Number(process.env.PORT ?? 4020);
const app = createKipApi();

app.listen(port, () => {
  console.log(`KIP API listening on port ${port}`);
});
