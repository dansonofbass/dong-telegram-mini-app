const origin=process.env.SMOKE_BASE_URL || 'http://localhost:3012';
for (const [path,status,mime] of [
 ['/',200,'text/html'],['/api/health',200,'application/json'],
 ['/api/me',401,'application/json'],['/hangout/example/flow',200,'text/html'],
 ['/api/unknown',401,'application/json']
]) {
 const response=await fetch(origin+path);
 if(response.status!==status || !response.headers.get('content-type')?.includes(mime)) throw Error('Unexpected response for '+path+': '+response.status);
 console.log(path,response.status,mime);
}
