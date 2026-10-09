import { launchChrome, connect } from "./cdp.mjs";
const T = new URL("../takes/", import.meta.url).pathname;
launchChrome({ camFile: T + `cam/${process.argv[2] ?? "slide"}.y4m`, profileDir: T + "profile" });
await connect();
console.log("chrome up on 9431");
process.exit(0);
