const deletable=new Set(['pending','rejected','cancelled']);
export function createOrderManagement({db,body,json,fail,audit,view,transaction,stamp}){
 function list(url){
  const status=url.searchParams.get('status')||'all',q=(url.searchParams.get('q')||'').trim().slice(0,100),deleted=url.searchParams.get('deleted')==='1';
  if(!['all','pending','submitted','approved','rejected','cancelled'].includes(status))fail('订单状态筛选无效');
  const requested=Number(url.searchParams.get('page')||1),pageSize=Number(url.searchParams.get('pageSize')||20);
  if(!Number.isSafeInteger(requested)||requested<1||requested>1000000||![20,50,100].includes(pageSize))fail('分页参数无效');
  const conditions=[deleted?"o.deleted_at<>''":"o.deleted_at=''"],params=[];
  if(status!=='all'){conditions.push('o.status=?');params.push(status);}
  if(q){const term='%'+q.replace(/[\\%_]/g,'\\$&')+'%';conditions.push("(o.id LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\' OR o.reference LIKE ? ESCAPE '\\')");params.push(term,term,term);}
  const from=' FROM member_orders o JOIN users u ON u.id=o.user_id WHERE '+conditions.join(' AND '),total=db.prepare('SELECT count(*) n'+from).get(...params).n;
  const pages=Math.max(1,Math.ceil(total/pageSize)),page=Math.min(requested,pages);
  const items=db.prepare('SELECT o.*,u.email'+from+" ORDER BY CASE o.status WHEN 'submitted' THEN 0 ELSE 1 END,o.created DESC,o.id DESC LIMIT ? OFFSET ?").all(...params,pageSize,(page-1)*pageSize).map(view);
  const counts=Object.fromEntries(db.prepare("SELECT status,count(*) n FROM member_orders WHERE deleted_at='' GROUP BY status").all().map(r=>[r.status,r.n]));
  return {items,total,page,pages,pageSize,status,q,deleted,counts,deletedCount:db.prepare("SELECT count(*) n FROM member_orders WHERE deleted_at<>''").get().n};
 }
 async function route(actor,req,res,url){
  const p=url.pathname,m=req.method;
  if(p==='/api/admin/operations/orders'&&m==='GET'){json(res,list(url));return true;}
  const match=p.match(/^\/api\/admin\/operations\/orders\/([a-f0-9]+)(\/restore)?$/);if(!match)return false;
  const id=match[1];
  if(m==='GET'&&!match[2]){const row=db.prepare('SELECT o.*,u.email FROM member_orders o JOIN users u ON u.id=o.user_id WHERE o.id=?').get(id);if(!row)fail('订单不存在',404);json(res,{order:view(row)});return true;}
  if(m==='DELETE'&&!match[2]){transaction(()=>{const row=db.prepare('SELECT * FROM member_orders WHERE id=?').get(id);if(!row)fail('订单不存在',404);if(row.deleted_at)fail('订单已删除',409);if(!deletable.has(row.status))fail(row.status==='approved'?'已开通会员的订单不能删除':'待审核订单请先审核或取消，再删除',409);db.prepare('UPDATE member_orders SET deleted_at=? WHERE id=?').run(stamp(),id);audit(actor,'delete-membership-order',id,{status:row.status,userId:row.user_id});});json(res,{ok:true});return true;}
  if(m==='POST'&&match[2]){await body(req);transaction(()=>{const row=db.prepare('SELECT * FROM member_orders WHERE id=?').get(id);if(!row)fail('订单不存在',404);if(!row.deleted_at)fail('订单未删除',409);db.prepare("UPDATE member_orders SET deleted_at='' WHERE id=?").run(id);audit(actor,'restore-membership-order',id,{status:row.status,userId:row.user_id});});json(res,{ok:true});return true;}
  return false;
 }
 return {route};
}
