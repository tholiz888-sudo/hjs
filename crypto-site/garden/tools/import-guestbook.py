"""Extract only visible archived guestbook records; never infer masked content/accounts."""
import pathlib,json,re,hashlib,html
root=pathlib.Path(__file__).resolve().parents[1]/'data'
manifest=json.loads((root/'manifest.json').read_text());items={};pages=0;unparsed=[]
def text(value):
 value=re.sub(r'<(?:script|style)\b[^>]*>.*?</(?:script|style)>','',value,flags=re.I|re.S)
 value=re.sub(r'<br\s*/?>','\n',value,flags=re.I)
 return html.unescape(re.sub(r'<[^>]*>','',value)).replace('\xa0',' ').strip()
for r in manifest['records']:
 if not re.match(r'^http://www\.yini\.org/liuyan/default\.asp(?:\?page=\d*)?$',r['url']) or not r.get('file') or r.get('status')!=200:continue
 b=(root/'original'/r['file']).read_bytes()
 try:s=b.decode('utf-8')
 except UnicodeDecodeError:s=b.decode('gb18030',errors='replace')
 headers=list(re.finditer(r'标题:\s*<strong>(.*?)</strong>.*?<strong>(.*?)</strong>.*?发表于(\d+年\d+月\d+日\d+时\d+分\d+秒)',s,re.S));pages+=1
 for i,h in enumerate(headers):
  chunk=s[h.end():headers[i+1].start() if i+1<len(headers) else s.find('<form',h.end()) if s.find('<form',h.end())!=-1 else len(s)]
  body=re.search(r'<div\s+style="margin:0;padding:0;overflow:auto;width:100%"[^<]*(?:<span[^>]*>)?(.*?)</td>',chunk,re.S)
  if not body:unparsed.append(r['url']);continue
  title,nickname,created=text(h[1]),text(h[2]),h[3];content=text(body[1]);masked=any(x in content for x in ['该留言尚未通过审核','悄悄话','此留言尚未通过审核'])
  if not content:continue
  nums=list(map(int,re.findall(r'\d+',created)));iso=f'{nums[0]:04}-{nums[1]:02}-{nums[2]:02}T{nums[3]:02}:{nums[4]:02}:{nums[5]:02}+08:00'
  avatar=re.search(r'<img\s+src="(images/[^"<>]+)"',chunk)
  key=hashlib.sha256(json.dumps([title,nickname,iso],ensure_ascii=False).encode()).hexdigest()[:24]
  record=dict(id='legacy-'+key,title=title,nickname=nickname,created=iso,body=content,avatar='/liuyan/'+avatar[1] if avatar else '',status='hidden' if masked else 'published',recoverable=not masked,source_page=r['url'].split('www.yini.org')[1])
  if key not in items or (not items[key]['recoverable'] and not masked):items[key]=record
assert pages>0 and not unparsed,unparsed[:10]
result=sorted(items.values(),key=lambda x:x['created'],reverse=True)
(root/'guestbook.json').write_text(json.dumps({'version':1,'items':result},ensure_ascii=False,separators=(',',':'))+'\n')
print(json.dumps({'pages':pages,'uniqueMessages':len(result),'masked':sum(not x['recoverable'] for x in result),'bytes':(root/'guestbook.json').stat().st_size}))
