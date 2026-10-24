"""Read-only pixel audit. Requires Pillow and numpy; no image editing is performed."""
import pathlib,json,hashlib
from PIL import Image
import numpy as np
root=pathlib.Path(__file__).resolve().parents[1]/'data'
manifest=json.loads((root/'cleaned/manifest.json').read_text())
for item in manifest['images']:
 original=(root/'original'/item['original']).read_bytes();clean=(root/'cleaned'/item['file']).read_bytes()
 assert hashlib.sha256(original).hexdigest()==item['originalSha256'],item['original']
 assert hashlib.sha256(clean).hexdigest()==item['sha256'],item['file']
 a=np.asarray(Image.open(root/'original'/item['original']).convert('RGB'));b=np.asarray(Image.open(root/'cleaned'/item['file']).convert('RGB'));assert a.shape==b.shape
 m=item['region'];allowed=np.zeros(a.shape[:2],dtype=bool);allowed[m['y']:m['y']+m['h'],m['x']:m['x']+m['w']]=True
 assert not np.any(np.any(a!=b,axis=2)&~allowed),item['file']
print('PASS',len(manifest['images']),'images: original hashes, dimensions, and every pixel outside repair regions preserved')
