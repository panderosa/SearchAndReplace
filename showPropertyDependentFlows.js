//node .\showPropertyDependentFlows.js -d "c:\\temp\\" -o "c:\\tmp\\dependency.json" -r "\xml$"
const library = require("./library.js");
const args = require("minimist")(process.argv.slice(2));

dir = args.d; 
out = args.o; 
pattern = args.r;
source = args.s;

library.listDependencies().catch(console.err);