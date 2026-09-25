// Print names only, never inherited values.
process.stdout.write(JSON.stringify({pid:process.pid,parent:process.ppid,environmentNames:Object.keys(process.env).sort()})+'\n');
setTimeout(()=>{},1000);
