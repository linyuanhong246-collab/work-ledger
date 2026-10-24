import{createClient}from'@supabase/supabase-js';
import type{State}from'./domain';
export const supabase=createClient('https://lulxfmocuhaspyjzwvdl.supabase.co','sb_publishable_b3EgGOsuqGZbci3e98iihA_sb36ZBl-');
export const emptyState=():State=>({bosses:[],works:[],wages:[],expenses:[],receipts:[],allocations:[]});
export async function loadCloud(){const{data,error}=await supabase.rpc('load_ledger');if(error)throw error;if(!data?.state)throw Error('请重新登录');return data as{state:State;revision:number};}
export async function saveCloud(state:State,revision:number){const{data,error}=await supabase.rpc('save_ledger',{p_state:state,p_expected:revision});if(error)throw error;return Number(data)}
export function downloadBackup(state:State){const blob=new Blob([JSON.stringify({app:'work-ledger',version:1,exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='工作账本_备份_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
