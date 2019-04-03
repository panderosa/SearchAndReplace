//node .\searchStrings.js -s "ba6d55f9-608b-4957-9c7f-77b57864498f" -d "c:\\temp" -o "c:\\tmp\\search.json" -f "long" -r "\.xml$"
const lib = require("./library.js");
const args = require("minimist")(process.argv.slice(2));

strings = args.s;
dir = args.d; 
out = args.o; 
format = args.f; 
pattern = args.r;

console.log(pattern);
//pattern = undefined;
lib.searchStrings(strings,pattern,dir,out,format);