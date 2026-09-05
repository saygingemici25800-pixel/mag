# MAG — hero fotoğrafını 4 yatay dilime keser. Yeni ürün geldiğinde CUTS'a satır ekle.
# Kullanım: python3 kes.py   (kaynak: cut3/<id>.webp, çıktı: dilim/<id>-<n>.webp)
from PIL import Image
import numpy as np, json, os
CUTS = {'smooky':[214,289,384], 'berry':[255,290,362], 'brisket':[237,300,352],
        'caesar':[216,272,360], 'jalapeno':[240,300,375]}
AMP=[7,6,5]; PHASE=[0.4,2.1,4.0]; FEATHER=3.0
NAMES=['1-ust-ekmek','2-malzeme','3-kofte-peynir','4-alt-ekmek']
def smoothstep(e0,e1,x):
    t=np.clip((x-e0)/(e1-e0),0,1); return t*t*(3-2*t)
os.makedirs('dilim',exist_ok=True); meta={}
for pid,cuts in CUTS.items():
    im=Image.open(f'cut3/{pid}.webp').convert('RGBA'); W,H=im.size
    arr=np.asarray(im).astype(np.float32); alpha=arr[:,:,3]
    xs=np.arange(W,dtype=np.float32); yy=np.arange(H,dtype=np.float32)[:,None]
    cv=[c+AMP[i]*np.sin(2*np.pi*(xs/W)+PHASE[i]) for i,c in enumerate(cuts)]
    centers=[]
    for i,name in enumerate(NAMES):
        m=np.ones((H,W),dtype=np.float32)
        if i>0: m*=smoothstep(cv[i-1][None,:]-FEATHER,cv[i-1][None,:]+FEATHER,yy)
        if i<3: m*=1.0-smoothstep(cv[i][None,:]-FEATHER,cv[i][None,:]+FEATHER,yy)
        a=alpha*m
        Image.fromarray(np.dstack([arr[:,:,0],arr[:,:,1],arr[:,:,2],a]).astype(np.uint8),'RGBA')\
             .save(f'dilim/{pid}-{name}.webp',quality=95,method=6)
        ys,_=np.nonzero(a>8); centers.append(round(float((ys.min()+ys.max())/2)/H*100,1))
    meta[pid]={'size':[W,H],'cuts':cuts,'bandCenterPct':centers}
json.dump(meta,open('dilim/meta.json','w'),indent=1,ensure_ascii=False)
print('ok')
