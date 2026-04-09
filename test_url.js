const url1 = 'http://localhost:8003/dist/NiGHTS%20Into%20Dreams...%20(1996-07-05)(Sonic%20Team)(Sega)[SAT].7z'\;
let u = new URL(url1);
let n1 = u.host + '/' + url1.split('/').pop().split('?')[0].split('#')[0];
console.log('n1 before decode:', n1);
console.log('n1 after decode:', decodeURIComponent(n1));

const url2 = 'NiGHTS Into Dreams... (1996-07-05)(Sonic Team)(Sega)[SAT].7z';
let n2 = 'localhost:8003/' + url2;
console.log('n2 after decode:', decodeURIComponent(n2));
