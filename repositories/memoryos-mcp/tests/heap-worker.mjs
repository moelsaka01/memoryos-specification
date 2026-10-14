// Test-only finite allocation loop; the Worker heap limit must stop it.
const retained=[];for(let i=0;i<32;i++)retained.push(new Array(1048576).fill(i));
