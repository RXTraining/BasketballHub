# -*- coding: utf-8 -*-
"""Builds og-card.png — the picture chat apps show when an RX.TRAINING link is pasted.

Run it again whenever the sports you offer change:

    python make-og-card.py "Basketball, Soccer, Tennis, Golf, Track"

Why a script and not a hand-made image: the card has to stay honest about what RX actually
coaches, and something that needs Photoshop to update never gets updated.

Why it is not animated: a link preview is a still image everywhere it matters — WeChat, iMessage,
WhatsApp all render one frame, and most ignore animated GIFs entirely. So instead of cycling the
sports the way the website does, the card shows them all at once, which says the same thing in a
medium that cannot move.
"""
import sys
from PIL import Image, ImageDraw, ImageFont

SPORTS = [s.strip() for s in (sys.argv[1] if len(sys.argv) > 1
          else "Basketball, Soccer, Tennis, Golf, Track").split(",") if s.strip()]

W, H   = 1200, 630
BG     = (255, 255, 255)
INK    = (15, 20, 16)
GREEN  = (58, 110, 20)
OA, OB = (255, 138, 26), (240, 90, 20)
SEAM   = (18, 24, 16)
GF     = "/usr/share/fonts/truetype/google-fonts/"

img = Image.new("RGB", (W, H), BG)
d   = ImageDraw.Draw(img)
F   = lambda p, s: ImageFont.truetype(GF + p, s)
mark, slog, foot, tiny = F("Poppins-Bold.ttf",124), F("Poppins-Medium.ttf",46), F("Poppins-Medium.ttf",29), F("Poppins-Medium.ttf",21)

# ---- the balls, drawn rather than typed: there is no colour emoji font here, and a flat vector
# ---- reads better at this size anyway
def basketball(dr,cx,cy,r):
    dr.ellipse([cx-r,cy-r,cx+r,cy+r],fill=OA,outline=SEAM,width=max(2,int(r*.09)))
    w=max(2,int(r*.09))
    dr.line([cx-r+2,cy,cx+r-2,cy],fill=SEAM,width=w); dr.line([cx,cy-r+2,cx,cy+r-2],fill=SEAM,width=w)
    dr.arc([cx-r*1.50,cy-r,cx-r*.15,cy+r],300,60,fill=SEAM,width=w)
    dr.arc([cx+r*.15,cy-r,cx+r*1.50,cy+r],120,240,fill=SEAM,width=w)
def soccer(dr,cx,cy,r):
    dr.ellipse([cx-r,cy-r,cx+r,cy+r],fill=(255,255,255),outline=SEAM,width=max(2,int(r*.09)))
    k=r*.42
    dr.regular_polygon((cx,cy,k),5,rotation=0,fill=SEAM)
    for a in (18,90,162,234,306):
        import math
        x=cx+math.cos(math.radians(a))*r*.78; y=cy-math.sin(math.radians(a))*r*.78
        dr.regular_polygon((x,y,r*.20),5,rotation=180,fill=SEAM)
def tennis(dr,cx,cy,r):
    dr.ellipse([cx-r,cy-r,cx+r,cy+r],fill=(200,230,60),outline=SEAM,width=max(2,int(r*.09)))
    w=max(2,int(r*.08))
    dr.arc([cx-r*1.9,cy-r,cx+r*.15,cy+r],300,60,fill=(255,255,255),width=w)
    dr.arc([cx-r*.15,cy-r,cx+r*1.9,cy+r],120,240,fill=(255,255,255),width=w)
def golf(dr,cx,cy,r):
    dr.ellipse([cx-r,cy-r,cx+r,cy+r],fill=(255,255,255),outline=SEAM,width=max(2,int(r*.09)))
    step=r*.42
    y=cy-r*.5
    while y<cy+r*.6:
        x=cx-r*.55
        while x<cx+r*.6:
            if (x-cx)**2+(y-cy)**2 < (r*.72)**2:
                dr.ellipse([x-r*.07,y-r*.07,x+r*.07,y+r*.07],fill=(190,198,188))
            x+=step
        y+=step
def track(dr,cx,cy,r):   # a running track, for Track & Field / Running
    w=max(2,int(r*.09))
    dr.rounded_rectangle([cx-r,cy-r*.66,cx+r,cy+r*.66],radius=r*.66,fill=(206,84,48),outline=SEAM,width=w)
    dr.rounded_rectangle([cx-r*.78,cy-r*.46,cx+r*.78,cy+r*.46],radius=r*.46,
                         outline=(255,255,255),width=max(2,int(r*.07)))
    dr.rounded_rectangle([cx-r*.55,cy-r*.28,cx+r*.55,cy+r*.28],radius=r*.28,
                         fill=(96,150,66),outline=SEAM,width=max(2,int(r*.07)))
def volleyball(dr,cx,cy,r):
    dr.ellipse([cx-r,cy-r,cx+r,cy+r],fill=(255,255,255),outline=SEAM,width=max(2,int(r*.09)))
    w=max(2,int(r*.08))
    dr.arc([cx-r*1.8,cy-r*1.3,cx+r*.4,cy+r*.9],300,20,fill=SEAM,width=w)
    dr.arc([cx-r*.4,cy-r*.9,cx+r*1.8,cy+r*1.3],150,230,fill=SEAM,width=w)
def baseball(dr,cx,cy,r):
    dr.ellipse([cx-r,cy-r,cx+r,cy+r],fill=(255,255,255),outline=SEAM,width=max(2,int(r*.09)))
    w=max(2,int(r*.08))
    dr.arc([cx-r*1.5,cy-r,cx+r*.1,cy+r],300,60,fill=(210,60,50),width=w)
    dr.arc([cx-r*.1,cy-r,cx+r*1.5,cy+r],120,240,fill=(210,60,50),width=w)

DRAW={'basketball':basketball,'soccer':soccer,'football':soccer,'tennis':tennis,'golf':golf,
      'track':track,'track & field':track,'running':track,'volleyball':volleyball,'baseball':baseball}
def emblem(name):
    return DRAW.get(name.strip().lower(), basketball)

# ---- wordmark: RX (ball) TRAINING
def wide(t,f,tr): return sum(d.textlength(c,font=f)+tr for c in t)-tr
def tracked(x,y,t,f,fill,tr):
    for c in t: d.text((x,y),c,font=f,fill=fill); x+=d.textlength(c,font=f)+tr
    return x

ball,gap,tr = 104,46,5
total = wide("RX",mark,tr)+gap+ball+gap+wide("TRAINING",mark,tr)
x,y = (W-total)/2, 150
x = tracked(x,y,"RX",mark,INK,tr)
cx,cy,r = x+gap+ball/2, y+66, ball/2
glow=Image.new("RGBA",(W,H),(0,0,0,0)); gd=ImageDraw.Draw(glow)
gd.ellipse([cx-r*1.42,cy-r*1.42,cx+r*1.42,cy+r*1.42],fill=(214,240,120,80))
img=Image.alpha_composite(img.convert("RGBA"),glow).convert("RGB"); d=ImageDraw.Draw(img)
emblem(SPORTS[0] if SPORTS else "basketball")(d,cx,cy,r)
tracked(cx+r+gap,y,"TRAINING",mark,INK,tr)

# ---- slogan + rule
s="We plant the seed of sport"; sy=y+184
d.text(((W-d.textlength(s,font=slog))/2,sy),s,font=slog,fill=GREEN)
uy,uw=sy+70,248; x0=(W-uw)/2
for i in range(uw):
    t=i/uw
    d.rectangle([x0+i,uy,x0+i+1,uy+9],
      fill=(int(OA[0]+(OB[0]-OA[0])*t),int(OA[1]+(OB[1]-OA[1])*t),int(OA[2]+(OB[2]-OA[2])*t)))

# ---- every sport we coach, side by side. The website cycles them; a still card shows them all.
er, pitch = 30, 168
rowy = uy+96
startx = (W-(len(SPORTS)-1)*pitch)/2
for i,name in enumerate(SPORTS):
    ex=startx+i*pitch
    emblem(name)(d,ex,rowy,er)
    lbl=name if len(name)<=12 else name[:11]+'…'
    d.text((ex-d.textlength(lbl,font=tiny)/2,rowy+er+14),lbl,font=tiny,fill=(96,108,92))

img.save("og-card.png","PNG",optimize=True)
print("og-card.png written —", ", ".join(SPORTS))
