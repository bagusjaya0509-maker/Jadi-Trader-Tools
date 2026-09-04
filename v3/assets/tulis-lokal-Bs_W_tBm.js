function r(t,n){t.catch(o=>{const i=o instanceof Error?o.message:"Gagal menyimpan";console.warn("[tulis-latar] tulisan ditolak:",i),n==null||n(i)})}export{r as t};
