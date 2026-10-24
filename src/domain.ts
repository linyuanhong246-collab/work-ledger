export type Boss={id:string;name:string;rate:number;note:string};
export type Work={id:string;bossId:string;date:string;days:number;content:string};
export type Wage={id:string;workId:string;rate:number;amount:number};
export type Expense={id:string;workId?:string;bossId:string;date:string;amount:number;purpose:string};
export type Receipt={id:string;bossId:string;date:string;amount:number;note:string;voided?:boolean};
export type Allocation={id:string;receiptId:string;kind:'wage'|'expense';targetId:string;amount:number};
export type State={bosses:Boss[];works:Work[];wages:Wage[];expenses:Expense[];receipts:Receipt[];allocations:Allocation[]};
export const uid=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
export const money=(c:number)=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(c/100);
export function cents(v:string|number){const s=String(v);if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('金额请输入非负数字，最多两位小数');const n=Math.round(Number(s)*100);if(!Number.isSafeInteger(n)||n>1e11)throw Error('金额过大');return n;}
export function paid(s:State,kind:Allocation['kind'],id:string){return s.allocations.filter(a=>a.kind===kind&&a.targetId===id&&!s.receipts.find(r=>r.id===a.receiptId)?.voided).reduce((t,a)=>t+a.amount,0)}
export function remaining(s:State,kind:Allocation['kind'],id:string){const row=kind==='wage'?s.wages.find(x=>x.id===id):s.expenses.find(x=>x.id===id);return row?row.amount-paid(s,kind,id):0}
export function workDays(rows:Work[]){const days=new Map<string,number>();rows.forEach(w=>days.set(w.date,(days.get(w.date)||0)+w.days));return [...days.values()].reduce((a,b)=>a+Math.min(b,1),0)}
export function saveWork(s:State,input:{id?:string;bossId:string;date:string;days:number;rate:number;content:string;expenses?:{amount:number;purpose:string}[]}):State {
 if(!s.bosses.some(b=>b.id===input.bossId)||!input.date||![.5,1].includes(input.days)||!Number.isSafeInteger(input.rate)||input.rate<0)throw Error('请填写完整的工作信息');
 const id=input.id||uid(),old=s.works.find(w=>w.id===id),wage=s.wages.find(w=>w.workId===id);const amount=Math.round(input.rate*input.days);
 if(wage&&amount<paid(s,'wage',wage.id))throw Error('应得工资不能低于已结工资，请先撤销关联收款');
 const hasPaid=(wage&&paid(s,'wage',wage.id)>0)||s.expenses.some(e=>e.workId===id&&paid(s,'expense',e.id)>0);
 if(old&&hasPaid&&(old.bossId!==input.bossId||old.date!==input.date))throw Error('这条工作已有结算，不能更换老板或日期，请先撤销关联收款');
 const work:Work={id,bossId:input.bossId,date:input.date,days:input.days,content:input.content.trim()};
 const wg:Wage={id:wage?.id||uid(),workId:id,rate:input.rate,amount};
 const extra=(input.expenses||[]).map(e=>({id:uid(),workId:id,bossId:input.bossId,date:input.date,amount:e.amount,purpose:e.purpose.trim()}));
 if(extra.some(e=>e.amount<=0||!e.purpose))throw Error('请填写每笔垫付的金额和用途');
 return {...s,works:[...s.works.filter(w=>w.id!==id),work],wages:[...s.wages.filter(w=>w.workId!==id),wg],expenses:[...s.expenses.map(e=>e.workId===id?{...e,bossId:input.bossId,date:input.date}:e),...extra]};
}
export function deleteWork(s:State,id:string){const wage=s.wages.find(w=>w.workId===id);if((wage&&paid(s,'wage',wage.id))||s.expenses.some(e=>e.workId===id&&paid(s,'expense',e.id)))throw Error('这条工作有关联收款，请先撤销收款后再删除');return {...s,works:s.works.filter(w=>w.id!==id),wages:s.wages.filter(w=>w.workId!==id),expenses:s.expenses.filter(e=>e.workId!==id)}}
export function saveExpense(s:State,e:Expense){if(!s.bosses.some(b=>b.id===e.bossId)||!e.date||!e.purpose.trim()||!Number.isSafeInteger(e.amount)||e.amount<=0)throw Error('请填写日期、老板、正数金额和用途');const old=s.expenses.find(x=>x.id===e.id),p=paid(s,'expense',e.id);if(e.amount<p)throw Error('垫付金额不能低于已报销金额');if(old&&p&&(old.bossId!==e.bossId||old.date!==e.date))throw Error('已有报销，不能修改老板或日期');return {...s,expenses:[...s.expenses.filter(x=>x.id!==e.id),e]}}
export function deleteExpense(s:State,id:string){if(paid(s,'expense',id)>0)throw Error('这笔垫付已有报销，请先撤销关联收款');return {...s,expenses:s.expenses.filter(e=>e.id!==id)}}
export function settle(s:State,input:{bossId:string;date:string;amount:number;note:string;lines:{kind:Allocation['kind'];targetId:string;amount:number}[]}):State{
 if(!input.date||!Number.isSafeInteger(input.amount)||input.amount<=0)throw Error('请填写收款日期和正数金额');
 if(input.lines.some(l=>!Number.isSafeInteger(l.amount)||l.amount<0))throw Error('分配金额必须为非负金额');
 const lines=input.lines.filter(l=>l.amount>0);if(!lines.length)throw Error('请至少选择一笔工资或垫付');const keys=new Set<string>();
 for(const l of lines){const key=l.kind+l.targetId;if(keys.has(key))throw Error('同一记录不能重复分配');keys.add(key);const row=l.kind==='wage'?s.wages.find(w=>w.id===l.targetId):s.expenses.find(e=>e.id===l.targetId);const bossId=l.kind==='wage'?s.works.find(w=>w.id===(row as Wage)?.workId)?.bossId:(row as Expense)?.bossId;if(!row||bossId!==input.bossId||!Number.isSafeInteger(l.amount)||l.amount>remaining(s,l.kind,l.targetId))throw Error('分配金额不能超过该记录的未结金额');}
 if(lines.reduce((t,l)=>t+l.amount,0)!==input.amount)throw Error('分配合计必须等于本次实收金额');
 const receipt:Receipt={id:uid(),bossId:input.bossId,date:input.date,amount:input.amount,note:input.note};return {...s,receipts:[...s.receipts,receipt],allocations:[...s.allocations,...lines.map(l=>({...l,id:uid(),receiptId:receipt.id}))]};
}
export function seed():State{let s:State={bosses:[{id:'b1',name:'张老板',rate:35000,note:'装修 · 电话尾号 6688'},{id:'b2',name:'李老板',rate:40000,note:'设备安装'},{id:'b3',name:'王老板',rate:32000,note:'临时帮工'}],works:[],wages:[],expenses:[],receipts:[],allocations:[]};const month=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,7);for(const [i,d,b,days,rate,content] of [[1,3,'b1',1,35000,'客厅墙面找平'],[2,6,'b2',1,40000,'空调设备安装'],[3,10,'b1',1,35000,'厨房贴砖'],[4,13,'b1',.5,36000,'阳台收尾'],[5,16,'b2',1,42000,'管线安装'],[6,18,'b3',.5,32000,'现场清理'],[7,20,'b1',1,38000,'卧室墙面施工'],[8,22,'b2',.5,40000,'设备调试'],[9,22,'b1',1,36000,'收尾验收'],[10,23,'b1',1,38000,'厨房防水施工']] as const){s=saveWork(s,{id:'w'+i,date:month+'-'+String(d).padStart(2,'0'),bossId:b,days,rate,content,expenses:i===10?[{amount:6800,purpose:'防水材料'},{amount:2500,purpose:'停车费'}]:i===7?[{amount:12000,purpose:'购买辅料'}]:i===5?[{amount:8500,purpose:'打车到工地'}]:[]});} const a=s.wages[0],b=s.wages[2];s=settle(s,{bossId:'b1',date:month+'-15',amount:50000,note:'微信转账，部分结清',lines:[{kind:'wage',targetId:a.id,amount:a.amount},{kind:'wage',targetId:b.id,amount:15000}]});return s;}
