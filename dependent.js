const lib = require("./library.js");
const args = require("minimist")(process.argv.slice(2));

dir = String(args.d); 
out = String(args.o);
lib.searchDependencies(dir,out);