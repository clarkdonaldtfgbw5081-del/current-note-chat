"""Render the 0.16.0 feature illustration locally; no private notes or AI requests.

Python 3 + Pillow; FFmpeg supplied by imageio-ffmpeg 0.6.0.
Run with --preview for cover/stills only, or without arguments for the MP4.
"""
from pathlib import Path
from functools import lru_cache
import argparse
import hashlib
import json
import math
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / 'media-tools'))
import imageio_ffmpeg

W, H, FPS, SECONDS = 1920, 1080, 30, 45
MOVIE = ROOT / 'Screen-and-File-QA-0.16.0-45s.mp4'
PAPER = '#F3F2EB'
INK = '#18392F'
MUTED = '#697C73'
LINE = '#D8E0D9'
GREEN = '#276B52'
MINT = '#E0F1E7'
LIME = '#D9ED9B'
WHITE = '#FFFFFF'
FONTS = Path('C:/Windows/Fonts')

SCENES = [
    (0, 4, 'intro', '把问题留下，把理解练出来。'),
    (4, 10, 'qa', '对当前文件或屏幕提问，对话自动保存。'),
    (10, 17, 'queue', '回答没结束，也能继续排队提问。'),
    (17, 24, 'source', '问题与可选回答写回原笔记，截图保存为附件。'),
    (24, 29, 'knowledge', '把回答归入「AI 知识库」中的主题笔记。'),
    (29, 35, 'feynman', '自己解释、完成应用题，再讲给初学者。'),
    (35, 40, 'reviews', '按 1、3、7、14 天安排本地复习。'),
    (40, 45, 'outro', 'Screen and File QA · 免费开源 · 桌面 Obsidian'),
]

@lru_cache(maxsize=100)
def font(size, bold=False):
    return ImageFont.truetype(str(FONTS / ('msyhbd.ttc' if bold else 'msyh.ttc')), size)

def text(d, xy, value, size=30, fill=INK, bold=False):
    d.text(xy, value, font=font(size, bold), fill=fill, anchor='lt')

def center(d, box, value, size=26, fill=INK, bold=False):
    f = font(size, bold)
    width = d.textlength(value, font=f)
    x, y, w, h = box
    text(d, (x + (w-width)/2, y+(h-size)/2-2), value, size, fill, bold)

def rr(d, box, fill=WHITE, radius=22, outline=None, width=1):
    x, y, w, h = box
    d.rounded_rectangle((x, y, x+w, y+h), radius, fill=fill, outline=outline, width=width)

def rule(d, x, y, w, fill=LINE, width=2):
    d.line((x,y,x+w,y), fill, width)

def lines(d, xy, values, size=30, gap=48, fill=INK, bold=False):
    for i, value in enumerate(values):
        text(d, (xy[0],xy[1]+i*gap), value, size, fill, bold)

def pill(d, x, y, value, fill=MINT, color=GREEN, size=24, padding=22, h=46):
    w = d.textlength(value, font=font(size, True)) + padding*2
    rr(d, (x,y,w,h), fill, h//2)
    center(d, (x,y,w,h), value, size, color, True)
    return w

def check(d, x, y, number=None):
    d.ellipse((x,y,x+35,y+35), fill=GREEN)
    if number is None:
        d.line((x+9,y+18,x+15,y+24,x+26,y+11), WHITE, 3)
    else:
        center(d, (x,y,35,35), str(number), 20, WHITE, True)

def note_icon(d, x, y, scale=1, color=GREEN):
    d.rounded_rectangle((x,y,x+25*scale,y+31*scale), 4*scale, outline=color, width=max(2,int(2*scale)))
    for i in range(3):
        d.line((x+6*scale,y+(9+i*6)*scale,x+19*scale,y+(9+i*6)*scale), color,max(2,int(2*scale)))

def base(index):
    im = Image.new('RGB', (W,H), PAPER)
    d = ImageDraw.Draw(im)
    rr(d, (90,62,46,46), INK, 13)
    note_icon(d, 103,71,0.75,WHITE)
    text(d, (154,68), 'Screen and File QA', 29, INK, True)
    pill(d, 1535,61, 'OBSIDIAN · 0.16.0', WHITE, GREEN, 23, 22, 46)
    rule(d,90,139,1740)
    if index not in (0,7):
        text(d, (94,205), f'{index:02d} / 学习流程', 22, MUTED, True)
    return im

def heading(d, title, sub, tag=None):
    lines(d, (90,286), title, 64, 87, INK, True)
    lines(d, (94,505), sub, 30, 49, MUTED)
    if tag:
        pill(d,94,663,tag,LIME,INK,23)

def app(d, title, subtitle=None):
    # Purposefully simplified UI, clearly identified as an illustration in every frame.
    rr(d,(800,202,1040,686),'#E6EAE3',28)
    rr(d,(790,190,1040,686),WHITE,28,LINE)
    rr(d,(790,190,1040,75),'#EDF2EC',28)
    d.rectangle((790,230,1830,265),fill='#EDF2EC')
    note_icon(d,817,214,0.75)
    text(d,(849,213),title,25,INK,True)
    if subtitle:
        text(d,(1455,215),subtitle,19,MUTED)
    rule(d,791,265,1038)

def small_label(d, x, y, a, b):
    text(d,(x,y),a,19,MUTED,True)
    text(d,(x,y+32),b,25,INK,True)

def intro(d, stage):
    pill(d,94,215,'0.16.0 更新',LIME,INK,24)
    lines(d,(90,309),['把问题留下。','把理解练出来。'],78,109,INK,True)
    lines(d,(96,583),['连续提问 · 自动写回 · 主题归档','费曼学习 · 间隔复习'],30,49,MUTED)
    pill(d,95,746,'免费开源 / 桌面插件',WHITE,GREEN,25)
    rr(d,(1015,242,784,568),INK,34)
    text(d,(1067,291),'从一个问题，开始一条学习链',30,WHITE,True)
    rows = [('01','提问与连续追问','当前文件 / 屏幕'),('02','留下可回看的笔记','原笔记 / AI 知识库'),('03','解释与复习','费曼学习 / 间隔练习')]
    for i,(n,a,b) in enumerate(rows):
        y = 376 + i*129
        rr(d,(1060,y,694,105),'#254B3D',18)
        center(d,(1080,y+23,58,58),n,28,LIME,True)
        text(d,(1160,y+23),a,30,WHITE,True)
        text(d,(1161,y+63),b,22,'#BFD4C8')

def qa(d, stage):
    heading(d,['想问的，','就在眼前。'],['对当前文件或屏幕提问','同一个对话，自动保存到同一篇笔记'],'保存方式可在设置中调整')
    app(d,'问答 · 概率与独立性','示例对话')
    pill(d,821,284,'文件问答',GREEN,WHITE,22)
    pill(d,1002,284,'屏幕问答',PAPER,MUTED,22)
    rr(d,(1160,356,631,84),MINT,18)
    text(d,(1184,382),'独立性和互斥有什么区别？',28,INK)
    rr(d,(819,468,972,191),PAPER,20)
    text(d,(845,493),'AI 解答',24,GREEN,True)
    lines(d,(845,539),['独立：一个事件发生，不改变另一个的概率。','互斥：两个事件不能同时发生。'],26,45)
    rr(d,(821,699,971,87),WHITE,16,LINE)
    text(d,(844,725),'继续追问，或请 AI 修改笔记…',26,MUTED)
    pill(d,822,812,'对话笔记已保存',MINT,GREEN,21,h=38)
    text(d,(1579,818),'发送',23,GREEN,True)

def queue(d, stage):
    heading(d,['问题来了，','不用等回答。'],['普通问答期间继续输入','最多排队 5 条，按顺序执行'],'0.16.0 新增 · 连续提问')
    app(d,'连续提问','正在回答')
    rr(d,(820,286,970,122),PAPER,18)
    text(d,(845,311),'正在解释：独立性和互斥的区别',28,INK,True)
    text(d,(846,357),'回答进行中…',24,MUTED)
    text(d,(825,443),'排队问题',26,INK,True)
    pill(d,1647,431,f'{min(stage+1,3)} / 5',MINT,GREEN,22)
    questions = ['举一个掷骰子的例子','两个独立事件能互斥吗？','给我一道应用题检验理解']
    for i,q in enumerate(questions):
        y = 490+i*84
        if i <= stage:
            rr(d,(820,y,970,68),MINT if i==stage else '#F6F8F4',14)
            check(d,842,y+17,i+1)
            text(d,(900,y+20),q,27,INK)
            text(d,(1665,y+25),'待发送',20,MUTED)
        else:
            rr(d,(820,y,970,68),'#F6F8F4',14)
    rule(d,822,758,969)
    text(d,(825,793),'停止或请求失败 → 暂停队列，主动继续再发送',25,GREEN,True)

def source(d, stage):
    heading(d,['答案，回到','你的原笔记。'],['问题、可选回答与对话链接','截图保存为仓库中的 PNG 附件'],'0.16.0 新增 · 原笔记写回')
    app(d,'概率与独立性.md','笔记示意')
    text(d,(829,290),'独立性',35,INK,True)
    text(d,(831,345),'我的课堂笔记：独立性描述事件之间的概率关系。',25,MUTED)
    rule(d,830,399,957)
    if stage >= 0:
        rr(d,(821,423,971,188),MINT,16)
        text(d,(846,446),'?  提问',25,GREEN,True)
        text(d,(847,495),'两个独立事件能互斥吗？',27,INK)
        text(d,(847,550),'截图附件 · 已保存到仓库',22,MUTED)
        rr(d,(1510,450,253,125),WHITE,12,LINE)
        text(d,(1531,471),'课堂截图',20,GREEN,True)
        rule(d,1530,512,177)
        text(d,(1531,532),'P(A ∩ B) = 0',22,INK)
    if stage >= 1:
        text(d,(831,645),'AI 解答',27,GREEN,True)
        text(d,(833,694),'若 P(A)、P(B) 都大于 0，独立与互斥不能同时成立。',24,INK)
        text(d,(833,737),'独立要求 P(A ∩ B) = P(A)P(B) > 0。',25,INK)
    if stage >= 2:
        text(d,(833,810),'完整对话  ↗  独立与互斥的区别',23,GREEN,True)

def knowledge(d, stage):
    heading(d,['答案有去处，','知识有主题。'],['AI 在指定知识目录内寻找主题','同主题归纳到已有笔记'],'低置信度内容进入「待整理」')
    app(d,'AI 知识库','主题归档示意')
    d.rectangle((791,266,1112,850),fill='#F4F6F0')
    text(d,(822,296),'AI 知识库',27,INK,True)
    entries = ['数学','  概率与独立性','  插值多项式','学习方法','待整理']
    for i,label in enumerate(entries):
        y=365+i*69
        if i==1:
            rr(d,(810,y-12,281,55),MINT,10)
        text(d,(829,y),label,23,GREEN if i==1 else MUTED,i==1)
    text(d,(1150,303),'概率与独立性',34,INK,True)
    pill(d,1148,365,'独立性',MINT,GREEN,20,h=38)
    pill(d,1294,365,'互斥事件',PAPER,MUTED,20,h=38)
    lines(d,(1151,445),['独立：事件间不改变彼此的概率。','互斥：事件不能同时发生。'],25,46)
    rule(d,1151,560,635)
    text(d,(1151,593),'例子与补充',25,GREEN,True)
    lines(d,(1151,641),['独立且概率均大于 0 的事件不互斥。','保留原笔记中的手写内容。'],24,44)
    rr(d,(1138,752,654,73),PAPER,13)
    text(d,(1156,776),'来源：独立与互斥的区别 ↗',24,GREEN,True)

def feynman(d, stage):
    heading(d,['换成自己的话，','试着讲清楚。'],['解释 → 应用 → 再次复述','用反馈找到还没讲明白的地方'],'费曼学习 · 检验理解')
    app(d,'费曼学习 · 独立性','示例练习')
    for i,label in enumerate(['1 解释','2 应用','3 复述']):
        x=819+i*330
        rr(d,(x,289,310,55),GREEN if i==stage else PAPER,13)
        center(d,(x,289,310,55),label,24,WHITE if i==stage else MUTED,True)
    prompts=['用自己的话解释「独立事件」，不要照抄定义。','两个独立事件概率都大于 0，它们能互斥吗？','请把这个知识点讲给一个刚接触概率的人。']
    rr(d,(820,379,970,128),PAPER,18)
    text(d,(846,405),'AI 引导',24,GREEN,True)
    text(d,(846,453),prompts[stage],26,INK)
    rr(d,(820,546,970,148),WHITE,18,LINE)
    text(d,(846,573),'在这里写下你的解释或解题思路…',26,MUTED)
    rule(d,846,641,506)
    rr(d,(820,728,970,94),MINT,16)
    text(d,(846,752),'反馈与提示',23,GREEN,True)
    text(d,(846,787),'补充例子、检查推理，再继续下一步。',24,INK)

def reviews(d, stage):
    heading(d,['过几天，','再讲一遍。'],['完成学习后，安排本地复习','在不同时间重新解释与练习'],'1 / 3 / 7 / 14 天')
    app(d,'学习与复习','本地复习计划')
    text(d,(829,299),'独立性 · 学习报告',34,INK,True)
    text(d,(833,359),'解释 / 应用 / 复述：记录本次学习反馈',26,MUTED)
    text(d,(833,436),'间隔复习',26,GREEN,True)
    for i,day in enumerate([1,3,7,14]):
        x=831+i*243
        rr(d,(x,490,215,144),GREEN if i==0 else PAPER,17)
        center(d,(x,509,215,68),f'{day}',49,WHITE if i==0 else INK,True)
        center(d,(x,581,215,35),'天后',23,'#D4EBDD' if i==0 else MUTED)
    rr(d,(820,679,970,145),MINT,18)
    text(d,(847,706),'复习时，再回答一遍',27,INK,True)
    text(d,(848,755),'为什么独立事件不一定互斥？用一个例子说明。',26,GREEN)

def outro(d, stage):
    pill(d,95,216,'从下一个问题开始',LIME,INK,26)
    lines(d,(91,313),['Screen and','File QA'],82,108,INK,True)
    text(d,(97,582),'在 Obsidian 社区插件中搜索',31,MUTED)
    pill(d,95,655,'Screen and File QA',WHITE,GREEN,30,h=61)
    text(d,(97,772),'桌面 Obsidian 1.13.0+  ·  免费开源',27,INK,True)
    rr(d,(1050,232,748,558),INK,32)
    text(d,(1101,280),'0.16.0',28,LIME,True)
    for i,label in enumerate(['继续排队提问','问题与回答写回原笔记','截图保存为附件','知识归档 · 费曼学习 · 复习']):
        y=368+i*85
        check(d,1102,y+2)
        text(d,(1158,y),label,31,WHITE,True)
    text(d,(1053,832),'AI 服务自行配置，可能收费；答案与评估请核对。',24,MUTED)

DRAWERS = [intro,qa,queue,source,knowledge,feynman,reviews,outro]

@lru_cache(maxsize=30)
def scene(index,stage=2):
    im=base(index)
    DRAWERS[index](ImageDraw.Draw(im),stage)
    return im

def ease(a):
    a=max(0,min(1,a))
    return 1-(1-a)**3

def render(t):
    index=next(i for i,(a,b,_,_) in enumerate(SCENES) if a<=t<b)
    a,b,key,caption=SCENES[index]
    local=t-a
    stage=2
    if key=='queue': stage=min(2,int(max(0,local-0.6)//1.6))
    if key=='source': stage=min(2,int(max(0,local-0.5)//1.7))
    if key=='feynman': stage=min(2,int(local//2))
    im=scene(index,stage).copy()
    if local<0.42:
        prior=scene(index-1,2) if index else base(0)
        im=Image.blend(prior,im,ease(local/0.42))
    d=ImageDraw.Draw(im)
    # Moving status dots/progress retain motion within static explanatory shots.
    if key=='queue':
        for j in range(3):
            color=GREEN if int(local*3)%3==j else LINE
            d.ellipse((1740+j*15,374,1748+j*15,382),fill=color)
    rr(d,(90,928,1740,72),INK,20)
    center(d,(90,928,1740,72),caption,29,WHITE,True)
    rule(d,90,1019,1740,LINE,3)
    rule(d,90,1019,int(1740*t/SECONDS),GREEN,3)
    text(d,(93,1038),'0.16.0 功能示意 · 模拟内容 · 非 Obsidian 实机录屏',20,MUTED)
    text(d,(1637,1037),f'{int(t):02d} / 45 秒',21,MUTED,True)
    return im

def cover():
    im=Image.new('RGB',(W,H),PAPER)
    d=ImageDraw.Draw(im)
    rr(d,(95,85,285,59),INK,18)
    center(d,(95,85,285,59),'OBSIDIAN 插件',25,WHITE,True)
    pill(d,415,92,'0.16.0',LIME,INK,23)
    lines(d,(91,254),['AI 回答，','回到你的笔记。'],88,125,INK,True)
    text(d,(98,603),'连续提问 / 自动写回 / 知识归档',32,MUTED)
    pill(d,97,709,'费曼学习 + 间隔复习',WHITE,GREEN,31,h=65)
    text(d,(96,930),'Screen and File QA',36,INK,True)
    text(d,(98,992),'免费开源 · 桌面 Obsidian',25,MUTED)
    rr(d,(1086,208,743,682),INK,34)
    text(d,(1133,261),'提问 → 笔记 → 理解',36,WHITE,True)
    items=[('01','继续提问','最多排队 5 条'),('02','写回原笔记','问题 / 可选回答 / 截图附件'),('03','练出理解','费曼学习 / 本地复习')]
    for i,(n,title,desc) in enumerate(items):
        y=365+i*157
        rr(d,(1131,y,653,130),'#254B3D',18)
        center(d,(1148,y+35,74,58),n,29,LIME,True)
        text(d,(1245,y+28),title,32,WHITE,True)
        text(d,(1246,y+77),desc,23,'#C5D9CC')
    im.save(ROOT/'封面.png')

def make_subtitles():
    def stamp(t):
        return f'00:00:{int(t):02d},000'
    chunks=[f'{i+1}\n{stamp(a)} --> {stamp(b)}\n{caption}\n' for i,(a,b,_,caption) in enumerate(SCENES)]
    (ROOT/'中文字幕.srt').write_text('\n'.join(chunks),encoding='utf-8')

def previews():
    (ROOT/'stills').mkdir(exist_ok=True)
    thumbs=[]
    for i,(a,b,key,caption) in enumerate(SCENES):
        t=(a+b)/2 if key!='source' else b-0.8
        frame=render(t)
        frame.save(ROOT/'stills'/f'{i+1:02d}-{key}.png')
        thumb=frame.resize((640,360),Image.Resampling.LANCZOS)
        thumbs.append(thumb)
    sheet=Image.new('RGB',(1280,1440),WHITE)
    for i,thumb in enumerate(thumbs):sheet.paste(thumb,((i%2)*640,(i//2)*360))
    sheet.save(ROOT/'分镜总览.jpg',quality=94)
    cover()
    make_subtitles()

def encode():
    exe=imageio_ffmpeg.get_ffmpeg_exe()
    cmd=[exe,'-y','-hide_banner','-loglevel','warning','-f','rawvideo','-vcodec','rawvideo',
         '-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-',
         '-an','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p',
         '-movflags','+faststart','-metadata','title=Screen and File QA 0.16.0',str(MOVIE)]
    with (ROOT/'encoding.log').open('w',encoding='utf-8') as log:
        proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
        try:
            for i in range(FPS*SECONDS):
                proc.stdin.write(render(i/FPS).tobytes())
                if i%150==0:print(f'Rendered {i}/{FPS*SECONDS} frames',flush=True)
            proc.stdin.close()
            result=proc.wait()
        except BaseException:
            proc.kill();proc.wait();raise
    if result:raise RuntimeError(f'FFmpeg failed with exit code {result}; see encoding.log')
    print(f'Exported {MOVIE.name} ({MOVIE.stat().st_size} bytes)',flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--preview',action='store_true')
    args=parser.parse_args()
    previews()
    if not args.preview:encode()
