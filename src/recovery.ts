// Parse only this project's Supabase recovery link; never navigate to redirect_to.
export function recoveryToken(raw:string){
 let link:URL;try{link=new URL(raw.trim().replaceAll('&amp;','&'))}catch{throw Error('请粘贴邮件中「Reset Password」按钮的完整原始链接')}
 if(link.origin!=='https://lulxfmocuhaspyjzwvdl.supabase.co'||link.username||link.password||!/^\/auth\/v1\/verify\/?$/.test(link.pathname))throw Error('请复制邮件中按钮的原始链接，不是打不开后的页面地址；仅支持本账本的 Supabase 验证链接');
 if(link.searchParams.get('type')!=='recovery')throw Error('这不是重置密码邮件，请使用「忘记密码」收到的最新邮件');
 const hash=link.searchParams.get('token_hash')||link.searchParams.get('token');
 if(!hash||!/^[-a-zA-Z0-9_]{20,256}$/.test(hash))throw Error('链接中的验证信息不完整，请重新复制完整链接');
 return{token_hash:hash,type:'recovery' as const};
}
