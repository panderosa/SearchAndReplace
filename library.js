const fs = require("fs");
const path = require("path");
const xpath = require("xpath");
const dom = require('xmldom').DOMParser;
const request = require('request');

listPropertiesXML = function(configPath) {
    regexp = new RegExp('\.xml$','i');
    return new Promise((resolve,reject) => {
        fs.readdir(configPath,(err,files) => {
            if(err) {
                reject(err);
            }
            else {              
                newresult = files.filter(e => {return regexp.test(e);}).map(e => {return path.resolve(configPath,e);});
                resolve(newresult);
            }
        });
    });
}

getPropertiesInfo = function(files,txt) {
    all = files.length;
    array = [];
    completed = 0;
    return new Promise((resolve,reject) => {
        files.forEach(f => {
            fs.readFile(f,(err,buf) => {
                if(err) {
                    reject(err)
                }
                else {
                    content = buf.toString();
                    doc = new dom().parseFromString(content);
                    // Add CPO content Pack Prefix
                    name = 'CPO/' + xpath.select("/systemProperty/name/text()[1]",doc)[0].nodeValue;
                    item = {};
                    item['name'] = name;
                    description = xpath.select("/systemProperty/annotation/text()[1]",doc)[0];
                    if(description) {
                        str = description.nodeValue + "=([^\n\r]*)"
                        rx = new RegExp(str);
                        result = rx.exec(txt);
                        description = (result !== null)? result[1]: "";                   
                    }
                    item['description'] = (description)? description: "";
                    array.push(item);
                    if(completed++ === files.length -1) {
                        resolve(array);
                    }
                }
            });
        });
    });
}

getSystemProperties = function(url,options) {
    return new Promise((resolve, reject) => {
        request.get(url, options, (err, resp, body) => {
            if (err || resp.statusCode !== 200) {
                reject(err || resp.statusMessage);
            }
            else {
                resolve(filterPropertiesInfo(body));
            }
        });
    });
}

filterPropertiesInfo = function (data) {
    dj = JSON.parse(data);
    res = dj.filter(e => {
        return e.type === 'system-properties' && /^CPO\//.test(e.path);
    })
        .map(e => {
            return {
                name: e.name,
                path: e.path,
                value: e.value,
                referencedId: e.referencedId
            };
        });
    return res;
}

getPropertyDescription = function (url, options, path) {
    return new Promise((resolve, reject) => {
        url = url + "/" + path + "?details=true";
        request(url, options, (err, resp, body) => {
            if (err || resp.statusCode !== 200) {
                reject(err || resp.statusMessage);
            }
            else {
                jstring = JSON.parse(body);
                let p = {};
                p.description = jstring.description;
                p.version = jstring.version;
                resolve(p);
            }
        });
    });
}

getProperties = function (url,options,properties) {
    return Promise.all(properties.map( async (p) => {
        let path = p.path;
        res = await getPropertyDescription(url,options,path);
        p.description = res.description;
        p.version = res.version;
        return p;
    })); 
}


search = function(properties,flows,format) {
    result = {};
    completedFiles = 0;   
    rexp = new RegExp('short','i');
    return new Promise((resolve,reject) => {
        flows.forEach(file => {
            fs.readFile(file,(err,buf) => {    
                if( err ) {
                    reject(err);
                }
                else {
                    content = buf.toString();
                    completedProperties = 0;
                    properties.forEach(p => {
                        if( content.indexOf(p) >=0 ) {
                            name = ( rexp.test(format) )? path.basename(file).slice(0,-4): file;
                            if( result.hasOwnProperty(p) ) {
                                result[p].push(name);
                            }
                            else {
                                result[p] = [name];
                            }
                        }
                    });
                    if(completedFiles++ === flows.length -1) {
                        resolve(result);
                    }
                }
            });
        });
    });
}

searchFlows = function(properties,flows) {
    result = {};
    completedFiles = 0;   
    return new Promise((resolve,reject) => {
        flows.forEach(file => {
            fs.readFile(file,(err,buf) => {    
                if( err ) {
                    reject(err);
                }
                else {
                    content = buf.toString();
                    completedProperties = 0;
                    properties.forEach(p => {
                        if( content.indexOf(p.name) >=0 ) {
                            fln = path.basename(file).slice(0,-4);
                            if( result.hasOwnProperty(p.name) ) {
                                result[p.name].push(fln);
                            }
                            else {
                                result[p.name] = [fln];
                            }
                        }
                    });
                    if(completedFiles++ === flows.length -1) {
                        newProperties = properties.map(e => { 
                            e.flows = result[e.name]; 
                            return e;
                        });
                        resolve(newProperties);
                    }
                }
            });
        });
    });
}

storeResult = function(mapa,out) {
    options = {
        encoding: 'UTF-8',
        flag: 'w'
    };
    cnt = JSON.stringify(mapa,null,2);
    fs.writeFile(out,cnt,options,(err) => {
        if(err) {
            return Promise.reject(err);
        } else {
            return Promise.resolve("completed");
        }
    });
}


walkSync = function(dir, filelist) {
    filelist = filelist || [];
    fs.readdirSync(dir).forEach(file => { 
      if( fs.statSync(path.join(dir, file)).isDirectory() ) {
        filelist = walkSync(path.join(dir, file), filelist);
      }
      else { 
           filelist = filelist.concat(path.join(dir, file));
      }
    });
  return filelist;
}

parseStrings = function(strings) {
    return new Promise((resolve,reject) => {
        array = strings.split(",");
        if(array.length > 0) {
            resolve(array);
        }
        else {
            reject("no strings to search");
        }
    });
}

getRBProperties = function(file) {
    options = {
        encoding: "UTF-8",
        flag: 'r'
    };
    buffer = fs.readFileSync(file,options);
    return buffer.toString();
}



searchDependencies = function(pattern,dir,out) {
    regexp = (pattern)? new RegExp(pattern): undefined;
    basePath = ( dir.endsWith('\\') ) ? dir + "Content\\Library\\CPO": dir + "\\Content\\Library\\CPO";
    configPath = ( dir.endsWith('\\') ) ? dir + "Content\\Configuration\\System Properties\\CPO": dir + "\\Content\\Configuration\\System Properties\\CPO";
    cpPropPath = ( dir.endsWith('\\') ) ? dir + "resource-bundles\\cp.properties": dir + "\\resource-bundles\\cp.properties";
    items = walkSync(basePath,[]);
    items = (pattern)? items.filter(e => {r = (!regexp)? true: regexp.test(e); return r;}): items;
    cpProps = getRBProperties("c:\\temp\\resource-bundles\\cp.properties");
    
    listPropertiesXML(configPath)
        .then(data => getPropertiesInfo(data,cpProps))
        .then(data => searchFlows(data,items))
        .then(data => storeResult(data,out))
        .catch(err => {console.log(err);});
}



// takes list of system properties from OO Central 
listDependencies = async (pattern,dir,out) => {
    //configurationFilesPath = ( dir.endsWith('\\') ) ? dir + "Content\\Configuration\\System Properties\\CPO": dir + "Content\\Configuration\\System Properties\\CPO";
    url = "https://stgbeslb001.fabric.local/oo/rest/v2/config-items/system-properties";
    options = {
        rejectUnauthorized: false,
        agent: false,
        method: "GET",
        headers: {
            "Accept": "application/json",
            "Authorization": "Basic " + Buffer.from("admin:|CpO?+HCM18").toString("base64")
        }
    }

    let properties = await getSystemProperties(url,options);
    let fp = await getProperties(url,options,properties); 
    console.log(JSON.stringify(fp,null,2));

    //getSystemPropertiesOO().then(parseData).then(body => {fs.writeFileSync("c:\\tmp\\properties.json",body);}).catch(err => {console.log(err);});
    
    //console.log(result);
    /*regexp = (pattern)? new RegExp(pattern): undefined;
    basePath = ( dir.endsWith('\\') ) ? dir + "Content\\Library\\CPO": dir + "\\Content\\Library\\CPO";
    items = walkSync(basePath,[]);
    items = (pattern)? items.filter(e => {r = (!regexp)? true: regexp.test(e); return r;}): items;
    
    
    listPropertiesXML(configPath)
        .then(data => getPropertiesInfo(data,cpProps))
        .then(data => searchFlows(data,items))
        .then(data => storeResult(data,out))
        .catch(err => {console.log(err);});*/
}

searchStrings = function(strings,pattern,dir,out,format) {
    regexp = (pattern)? new RegExp(pattern): undefined;
    basePath = dir;
    items = walkSync(basePath,[]);
    items = (pattern)? items.filter(e => {r = (!regexp)? true: regexp.test(e); return r;}): items;
    //console.log(strings);
    parseStrings(strings).then(data => search(data,items,format)).then(data => storeResult(data,out)).then().catch(err => {console.log(err);});
}

// exports
exports.listDependencies = listDependencies;
exports.searchStrings = searchStrings;





