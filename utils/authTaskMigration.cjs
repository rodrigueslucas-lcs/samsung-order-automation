const path=require('node:path');const{taskAction}=require('./authKeepAliveTask.cjs');
function knownTaskAction(actual,options){
 if(!actual)return false;
 const expected=taskAction(options),equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
 if(!equal(actual.workingDirectory,expected.workingDirectory))return false;
 if(equal(actual.command,expected.command)&&actual.arguments===expected.arguments)return true;
 const shell=path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
 if(!equal(actual.command,shell))return false;
 const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
 const script=path.resolve(options.root||process.cwd(),'scripts',options.script);
 const modern='& '+[options.executable||process.execPath,script,...options.args].map(quote).join(' ')+'; exit $LASTEXITCODE';
 const variants=[modern];
 if(options.script==='auth-keepalive-once.cjs')variants.push('& '+quote(options.executable||process.execPath)+' '+quote(script)+' '+options.args.join(' ')+'; exit $LASTEXITCODE');
 return variants.some(action=>actual.arguments==='-NoProfile -NonInteractive -WindowStyle Hidden -Command "'+action+'"');
}
module.exports={knownTaskAction};
