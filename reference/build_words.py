"""Attach Chinese glosses + frequency tags to parsed PET entries from ECDICT."""
import csv, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
csv.field_size_limit(10 ** 9)

entries = json.load(open(os.path.join(HERE, 'pet_entries.json'), encoding='utf-8'))
topics = json.load(open(os.path.join(HERE, 'pet_topics.json'), encoding='utf-8'))

# ---------------------------------------------------------------- overrides
# Words where ECDICT's dominant sense is misleading for a B1 learner.
OVERRIDE = {
    'a/an': '一个', 'a': '一个', 'an': '一个',
    'the': '这；那（定冠词）',
    'be': '是；存在；成为',
    'go': '去；走；进行',
    'take': '拿；带走；花费；乘坐',
    'get': '得到；变得；到达',
    'make': '制作；使得；做出',
    'have': '有；吃；进行',
    'do': '做；干',
    'well': '好地；健康的',
    'good': '好的；擅长的',
    'like': '喜欢；像',
    'back': '后面；回来；背部',
    'run': '跑；经营；运行',
    'set': '放置；设置；一套',
    'turn': '转动；变成；轮流',
    'put': '放；放置',
    'come': '来；到达；出现',
    'give': '给；提供',
    'look': '看；看起来',
    'find': '找到；发现；认为',
    'keep': '保持；保存；继续',
    'leave': '离开；留下；休假',
    'mean': '意思是；意味着；吝啬的',
    'call': '打电话；称呼；喊',
    'play': '玩；演奏；戏剧',
    'work': '工作；起作用；作品',
    'mind': '介意；头脑；注意',
    'matter': '事情；要紧；物质',
    'point': '点；观点；指向',
    'place': '地方；放置；名次',
    'kind': '种类；友善的',
    'right': '正确的；右边；权利',
    'left': '左边；剩下的',
    'light': '光；轻的；点燃',
    'free': '自由的；免费的；空闲的',
    'hard': '困难的；努力地；硬的',
    'last': '最后的；持续',
    'just': '刚刚；只是；公正的',
    'still': '仍然；静止的',
    'even': '甚至；平坦的',
    'own': '自己的；拥有',
    'same': '相同的',
    'such': '这样的；如此的',
    'few': '很少的；几个',
    'little': '小的；很少',
    'much': '许多；非常',
    'many': '许多',
    'more': '更多；更',
    'most': '最多；大多数',
    'other': '其他的；另一个',
    'another': '另一个',
    'every': '每一个',
    'each': '每个',
    'both': '两者都',
    'either': '两者之一；也（否定）',
    'neither': '两者都不',
    'all': '全部；所有的',
    'some': '一些；某个',
    'any': '任何；一些',
    'no': '没有；不',
    'not': '不；没有',
    'one': '一个；一',
    'two': '二',
    'so': '所以；如此；那么',
    'too': '也；太',
    'very': '非常',
    'quite': '相当；十分',
    'rather': '宁可；相当',
    'enough': '足够的；足够地',
    'only': '只；仅；唯一的',
    'also': '也；而且',
    'already': '已经',
    'yet': '还；已经（疑问/否定）',
    'still ': '',
    'ever': '曾经；究竟',
    'never': '从不',
    'always': '总是',
    'often': '经常',
    'sometimes': '有时',
    'usually': '通常',
    'again': '再次',
    'soon': '很快；不久',
    'later': '后来；更晚的',
    'before': '在…之前',
    'after': '在…之后',
    'while': '当…时；然而',
    'until': '直到',
    'since': '自从；因为',
    'during': '在…期间',
    'through': '穿过；通过',
    'across': '穿过；在对面',
    'along': '沿着',
    'around': '在周围；大约',
    'among': '在…之中',
    'between': '在…之间',
    'against': '反对；靠着',
    'without': '没有',
    'within': '在…之内',
    'besides': '除…之外（还有）',
    'except': '除…之外',
    'instead': '代替；反而',
    'however': '然而',
    'although': '虽然',
    'though': '虽然；不过',
    'unless': '除非',
    'whether': '是否',
    'because': '因为',
    'since ': '',
    'therefore': '因此',
    'moreover': '而且',
    'otherwise': '否则',
    'beside': '在…旁边',
    'behind': '在…后面',
    'below': '在…下面',
    'above': '在…上方；超过',
    'over': '在…上方；超过；结束',
    'under': '在…下面；少于',
    'off': '离开；关闭；休息',
    'on': '在…上；关于',
    'in': '在…里；在…期间',
    'at': '在（地点/时间）',
    'by': '通过；在旁边；到…为止',
    'for': '为了；因为；持续',
    'with': '和…一起；用',
    'from': '从；来自',
    'of': '…的',
    'to': '到；向；为了',
    'up': '向上；起来',
    'down': '向下；沿着',
    'out': '出去；向外；熄灭',
    'it': '它',
    'this': '这；这个',
    'that': '那；那个；引导从句',
    'these': '这些',
    'those': '那些',
    'i': '我',
    'you': '你；你们',
    'he': '他',
    'she': '她',
    'we': '我们',
    'they': '他们；它们',
    'me': '我（宾格）',
    'him': '他（宾格）',
    'her': '她；她的',
    'us': '我们（宾格）',
    'them': '他们（宾格）',
    'my': '我的',
    'your': '你的',
    'his': '他的',
    'its': '它的',
    'our': '我们的',
    'their': '他们的',
    'myself': '我自己',
    'yourself': '你自己',
    'himself': '他自己',
    'herself': '她自己',
    'itself': '它自己',
    'ourselves': '我们自己',
    'themselves': '他们自己',
    'can': '能；可以',
    'could': '能（过去）；可以（委婉）',
    'may': '可以；可能',
    'might': '可能（语气更弱）',
    'must': '必须；一定',
    'should': '应该',
    'would': '将会（过去）；愿意',
    'will': '将；会',
    'shall': '将（第一人称）',
    'need': '需要',
    'dare': '敢',
    'ought': '应该',
    'say': '说',
    'tell': '告诉；讲述',
    'speak': '说话；讲（语言）',
    'talk': '谈话；交谈',
    'ask': '问；要求',
    'answer': '回答；答案',
    'think': '想；认为',
    'know': '知道；认识',
    'understand': '理解；明白',
    'remember': '记得',
    'forget': '忘记',
    'learn': '学习；得知',
    'teach': '教',
    'study': '学习；研究',
    'read': '读；阅读',
    'write': '写',
    'hear': '听见',
    'listen': '听',
    'see': '看见；明白',
    'watch': '观看；手表',
    'look': '看；看起来',
    'feel': '感觉；觉得',
    'smell': '闻；气味',
    'taste': '品尝；味道',
    'touch': '触摸',
    'want': '想要',
    'wish': '希望；愿望',
    'hope': '希望',
    'expect': '期望；预料',
    'happen': '发生',
    'become': '变成；成为',
    'begin': '开始',
    'start': '开始；出发',
    'finish': '完成；结束',
    'stop': '停止；车站',
    'continue': '继续',
    'change': '改变；零钱',
    'grow': '生长；变得',
    'increase': '增加',
    'reduce': '减少',
    'improve': '改善；提高',
    'decide': '决定',
    'choose': '选择',
    'agree': '同意',
    'refuse': '拒绝',
    'accept': '接受',
    'allow': '允许',
    'let': '让；允许',
    'help': '帮助',
    'try': '尝试；努力',
    'succeed': '成功',
    'fail': '失败；不及格',
    'win': '赢；获胜',
    'lose': '丢失；输',
    'buy': '买',
    'sell': '卖',
    'pay': '支付；报酬',
    'spend': '花费（时间/钱）',
    'cost': '花费；成本',
    'save': '节省；储蓄；拯救',
    'borrow': '借入',
    'lend': '借出',
    'bring': '带来',
    'carry': '携带；搬运',
    'send': '寄；发送',
    'receive': '收到',
    'arrive': '到达',
    'return': '返回；归还',
    'leave ': '',
    'move': '移动；搬家',
    'stay': '停留；保持',
    'wait': '等待',
    'meet': '遇见；见面',
    'join': '加入；连接',
    'follow': '跟随；遵循',
    'lead': '带领；导致',
    'show': '展示；表明；演出',
    'explain': '解释',
    'describe': '描述',
    'suggest': '建议；暗示',
    'advise': '建议（动词）',
    'warn': '警告',
    'promise': '承诺',
    'offer': '提供；主动提出',
    'provide': '提供',
    'include': '包括',
    'contain': '包含',
    'belong': '属于',
    'depend': '依靠；取决于',
    'prefer': '更喜欢',
    'enjoy': '享受；喜欢',
    'hate': '讨厌',
    'love': '爱；喜爱',
    'dislike': '不喜欢',
    'mind ': '',
    'practise': '练习（动词）',
    'practice': '练习（名词）',
    'advice': '建议（名词）',
    'affect': '影响（动词）',
    'effect': '影响；效果（名词）',
    'rise': '上升（不及物）',
    'raise': '举起；提高（及物）',
    'lie': '躺；说谎',
    'lay': '放置；产卵',
    'wear': '穿；戴',
    'dress': '穿衣；连衣裙',
    'afford': '负担得起',
    'achieve': '实现；达到',
    'require': '需要；要求',
    'avoid': '避免',
    'consider': '考虑；认为',
    'imagine': '想象',
    'realise': '意识到；实现',
    'realize': '意识到；实现',
    'recognise': '认出；承认',
    'recognize': '认出；承认',
    'appear': '出现；似乎',
    'seem': '似乎',
    'remain': '保持；剩下',
    'notice': '注意到；通知',
    'remind': '提醒',
    'prepare': '准备',
    'produce': '生产；产生',
    'invent': '发明',
    'discover': '发现',
    'develop': '发展；开发',
    'deliver': '递送；发表',
    'collect': '收集；接走',
    'share': '分享；共用',
    'compare': '比较',
    'discuss': '讨论',
    'argue': '争论；主张',
    'complain': '抱怨',
    'apologise': '道歉',
    'apologize': '道歉',
    'celebrate': '庆祝',
    'organise': '组织',
    'organize': '组织',
    'attend': '参加；出席',
    'enter': '进入；输入',
    'escape': '逃跑；逃避',
    'hurt': '伤害；疼痛',
    'damage': '损害',
    'destroy': '毁坏',
    'repair': '修理',
    'replace': '替换',
    'solve': '解决',
    'cause': '引起；原因',
    'prevent': '阻止；预防',
    'protect': '保护',
    'support': '支持',
    'encourage': '鼓励',
    'allow ': '',
    'forbid': '禁止',
    'permit': '允许',
    'manage': '管理；设法做到',
    'control': '控制',
    'check': '检查；核对',
    'test': '测试；考试',
    'score': '得分；分数',
    'train': '训练；火车',
    'travel': '旅行',
    'visit': '参观；拜访',
    'invite': '邀请',
    'introduce': '介绍；引进',
    'thank': '感谢',
    'welcome': '欢迎',
    'greet': '问候',
    'shake': '摇动；握手',
    'throw': '扔',
    'catch': '抓住；赶上',
    'hold': '握住；举行',
    'pull': '拉',
    'push': '推',
    'drop': '掉落；放弃',
    'pick': '挑选；捡起',
    'fill': '装满；填写',
    'empty': '空的；倒空',
    'close': '关闭；近的',
    'open': '打开；开放的',
    'cover': '覆盖；封面',
    'cut': '切；削减',
    'break': '打破；休息',
    'build': '建造',
    'burn': '燃烧',
    'cook': '烹饪；厨师',
    'wash': '洗',
    'clean': '清洁的；打扫',
    'tidy': '整洁的；整理',
    'fix': '修理；固定',
    'knock': '敲；撞',
    'ring': '打电话；戒指；响',
    'sound': '声音；听起来',
    'smile': '微笑',
    'laugh': '笑',
    'cry': '哭；喊',
    'shout': '喊叫',
    'whisper': '低语',
    'argue ': '',
    'wear ': '',
    'beat': '打败；敲打',
    'bite': '咬',
    'blow': '吹',
    'breathe': '呼吸',
    'climb': '爬；攀登',
    'dance': '跳舞',
    'dig': '挖',
    'draw': '画；拉',
    'dream': '梦；梦想',
    'drink': '喝；饮料',
    'drive': '驾驶；驱动',
    'eat': '吃',
    'fall': '落下；秋天',
    'feed': '喂养',
    'fight': '打架；战斗',
    'fly': '飞；苍蝇',
    'hide': '隐藏',
    'hit': '打；撞；热门',
    'hunt': '打猎；搜寻',
    'jump': '跳',
    'kick': '踢',
    'kiss': '吻',
    'kneel': '跪',
    'lie ': '',
    'lift': '举起；电梯',
    'lock': '锁',
    'march': '行进；三月',
    'mix': '混合',
    'nod': '点头',
    'paint': '绘画；油漆',
    'park': '停车；公园',
    'plant': '种植；植物',
    'pour': '倒；倾泻',
    'press': '按；新闻界',
    'ride': '骑；乘',
    'rub': '擦',
    'sail': '航行',
    'search': '搜索',
    'sell ': '',
    'sew': '缝',
    'shake ': '',
    'shut': '关闭',
    'sing': '唱歌',
    'sink': '下沉；水槽',
    'sit': '坐',
    'sleep': '睡觉',
    'slide': '滑动；幻灯片',
    'spell': '拼写',
    'spread': '传播；展开',
    'stand': '站立；忍受',
    'steal': '偷',
    'stick': '粘贴；棍子',
    'sting': '刺；叮',
    'stretch': '伸展',
    'swim': '游泳',
    'swing': '摇摆；秋千',
    'tear': '撕；眼泪',
    'tie': '系；领带；平局',
    'translate': '翻译',
    'wake': '醒来；叫醒',
    'wave': '挥手；波浪',
    'weigh': '称重',
    'whistle': '吹口哨',
    'wipe': '擦',
    'wrap': '包裹',
    # --- additions for entries ECDICT lacks ---
    'app': '应用程序',
    'cashpoint': '自动取款机',
    'cheers!': '干杯；谢谢',
    'congratulations!': '恭喜',
    'download': '下载',
    'internet': '互联网',
    'motor-racing': '赛车运动',
    'o’clock': '…点钟',
    "o'clock": '…点钟',
    'online': '在线的；网上',
    'rainforest': '雨林',
    'recycling': '回收利用',
    'upload': '上传',
    'cheers': '干杯；谢谢',
    'congratulations': '恭喜',
    # --- 短语与残留噪声义项校正（第二轮） ---
    'break in': '闯入；打断',
    'break into': '闯入',
    'go off': '（警报）响起；（食物）变质；离开',
    'hitchhike': '搭便车旅行',
    'disc jockey': '（电台/夜店）主持人',
    'extreme sport': '极限运动',
    'part time': '兼职的；部分时间的',
    'dog': '狗',
    'school': '学校',
    'monkey': '猴子',
    'cap': '帽子；盖子',
    'range': '范围；一系列；山脉',
    'wise': '明智的',
    'sheep': '绵羊',
    'recover': '恢复；找回',
    'beneath': '在…下面',
    'disc': '唱片；圆盘',
    'plate': '盘子；碟子',
    'temporary': '临时的',
    'tidy up': '整理；收拾',
    'wash up': '洗碗；洗漱',
    'well made': '做工精良的',
    'out of': '从…出来；用完',
    'made of': '由…制成',
    'be over': '结束',
    'base on': '以…为基础',
    'call for': '需要；要求',
    'call in': '顺路拜访；召来',
    'keep in': '留在室内；抑制',
    'pass on': '传递；转告',
    'step forward': '向前走；站出来',
    'give way': '让步；让路',
    'have got to': '必须',
    'how much': '多少（不可数/价格）',
    'no one': '没有人',
    'face to face': '面对面',
    'in two': '分成两半',
    'in ink': '用墨水写',
    'in pencil': '用铅笔写',
    'on board': '在船上/机上',
    'on request': '应要求',
    'up to date': '最新的',
    'out of date': '过时的',
    'out of order': '（机器）故障',
    'out of work': '失业',
    'focus  on': '集中于',
    'full time': '全职的',
    'part-time': '兼职的',
    'well done!': '干得好！',
    'you know': '你知道的',
    'oh dear!': '哎呀！',
    'while, whilst': '当…时；然而',
    'good afternoon': '下午好',
    'good evening': '晚上好',
    'good morning': '早上好',
    'good night': '晚安',
    'thank you': '谢谢',
    'ID card': '身份证',
    'CD player': 'CD 播放机',
    'DVD player': 'DVD 播放机',
    'French fries': '炸薯条',
    'ice skates': '冰鞋',
    'ice skating': '滑冰',
    'high jump': '跳高',
    'long jump': '跳远',
    'hip hop': '嘻哈（音乐）',
    'navy blue': '藏青色',
    'soap opera': '肥皂剧',
    'chat show': '脱口秀',
    'talk show': '脱口秀',
    'science fiction': '科幻（小说）',
    'social media': '社交媒体',
    'video clip': '视频短片',
    'video game': '电子游戏',
    'web page': '网页',
    'text message': '短信',
    'weather forecast': '天气预报',
    'remote control': '遥控器',
    'seat belt': '安全带',
    'security guard': '保安',
    'shop assistant': '店员',
    'police officer': '警察',
    'police station': '警察局',
    'post office': '邮局',
    'primary school': '小学',
    'public transport': '公共交通',
    'travel agent': '旅行社',
    'traffic jam': '交通堵塞',
    'traffic light': '红绿灯',
    'tour guide': '导游',
    'tourist information centre': '旅游信息中心',
    'sports centre': '体育中心',
    'swimming costume': '泳衣',
    'swimming pool': '游泳池',
    'table tennis': '乒乓球',
    'stomach ache': '胃痛',
    'pocket money': '零花钱',
    'opening hours': '营业时间',
    'living room': '客厅',
    'sitting room': '起居室',
    'waiting room': '候车室',
    'changing room': '更衣室',
    'dining room': '餐厅',
    'washing machine': '洗衣机',
    'frying pan': '煎锅',
    'pencil case': '笔袋',
    'first name': '名字',
    'full stop': '句号',
    'main course': '主菜',
    'mineral water': '矿泉水',
    'fast food': '快餐',
    'ice cream': '冰淇淋',
    'ice hockey': '冰球',
    'credit card': '信用卡',
    'bank account': '银行账户',
    'boarding pass': '登机牌',
    'booking office': '售票处',
    'bottle bank': '玻璃回收箱',
    'brand new': '全新的',
    'bus station': '汽车站',
    'bus stop': '公交站',
    'car park': '停车场',
    'cash machine': '自动取款机',
    'cell phone': '手机',
    'central heating': '中央供暖',
    'chest of drawers': '五斗柜',
    'climate change': '气候变化',
    'department store': '百货商店',
    'driver\u2019s licence': '驾照',
    'driving licence': '驾照',
    'exchange rate': '汇率',
    'extreme sport': '极限运动',
    'film maker': '电影制作人',
    'film star': '电影明星',
    'movie star': '电影明星',
    'movie theater': '电影院',
    'football player': '足球运动员',
    'grocery store': '杂货店',
    'gas station': '加油站',
    'petrol station': '加油站',
    'parking lot': '停车场',
    'trash can': '垃圾桶',
    'global warming': '全球变暖',
    'air conditioning': '空调',
    'air force': '空军',
    'alarm clock': '闹钟',
    'apartment building': '公寓楼',
    'bathing suit': '泳衣',
    'board game': '棋类游戏',
    'bathing suit ': '泳衣',
    'cross out': '划掉',
    'get fit': '变健壮',
    'stay behind': '留下（不走）',
    'of the school': '学校的',
    # --- 第三轮：多义词只保留 B1 常用义 ---
    'ability': '能力；本领',
    'about': '关于；大约',
    'above': '在…上方；超过',
    'accent': '口音；重音',
    'access': '通道；使用权',
    'accident': '事故；意外',
    'accompany': '陪伴；伴随',
    'according to': '根据；按照',
    'account': '账户；描述',
    'ache': '疼痛',
    'achieve': '实现；达到',
    'achievement': '成就；成绩',
    'act': '行动；表演',
    'action': '行动；行为',
    'activity': '活动',
    'actually': '实际上；竟然',
    'add': '添加；补充',
    'address': '地址；演说',
    'admire': '钦佩；欣赏',
    'admit': '承认；准许进入',
    'adult': '成人；成年人',
    'advance': '前进；进展',
    'advantage': '优势；好处',
    'advertise': '做广告；宣传',
    'afternoon': '下午',
    'afterwards': '后来；之后',
    'against': '反对；靠着',
    'age': '年龄；年纪',
    'aged': '…岁的；年老的',
    'air': '空气；空中',
    'alive': '活着的；有活力的',
    'alike': '相似的；同样地',
    'advertisement': '广告',
    'goat': '山羊',
    # --- 第四轮：去掉生僻/专业第二义项 ---
    'breeze': '微风',
    'donkey': '驴',
    'sunset': '日落',
    'sunrise': '日出',
    'mirror': '镜子',
    'port': '港口',
    'ring up': '打电话',
    'use': '使用；用途',
    'comedy': '喜剧',
    'use up': '用完；耗尽',
    'thunder': '雷；雷声',
    'crew': '全体船员/机组人员',
    'tunnel': '隧道',
    'bush': '灌木丛',
    'apartment': '公寓',
    'application': '申请；运用',
    'announce': '宣布；播报',
    'money': '钱；金钱',
    'strange': '奇怪的；陌生的',
    'catch': '抓住；赶上',
    'while': '当…时；然而',
    'breeze ': '微风',
    'typically': '通常；一般地',
    'occasionally': '偶尔',
    'answer': '回答；答案',
    'enemy': '敌人',
    'silent': '沉默的；安静的',
    'employer': '雇主',
    'exiting': '令人兴奋的',
    'exciting': '令人兴奋的',
    'mall': '购物中心',
    'lecturer': '讲师',
    'twin': '双胞胎之一',
    'tooth': '牙齿',
    'broken': '破碎的；坏了的',
    'department': '部门；（大学的）系',
    'quarter': '四分之一；一刻钟',
    'sick': '生病的；恶心的',
    'close': '关闭；靠近的',
    'read': '阅读',
    'fill in': '填写；填满',
    'ferry': '渡船',
    'breath': '呼吸',
    'south': '南方；南方的',
    'warn': '警告',
    'down': '向下；沿着',
}
# 这些是 PDF 分栏残留，不该作为独立词条
DROP = {'step over/in/on/out of'}

OVERRIDE = {k.strip().lower(): v for k, v in OVERRIDE.items() if k.strip() and v}

# ---------------------------------------------------------------- load ECDICT
need = set()
for e in entries:
    need.add(e['w'].lower())
    for a in e['alias']:
        need.add(a.lower())

dict_rows = {}
with open(os.path.join(HERE, 'ecdict.csv'), newline='', encoding='utf-8') as f:
    for row in csv.DictReader(f):
        w = (row.get('word') or '').strip().lower()
        if w in need and w not in dict_rows:
            dict_rows[w] = row

print('ECDICT 命中', len(dict_rows), '/', len(need))

POS_ORDER = ['n', 'v', 'adj', 'adv', 'prep', 'conj', 'pron', 'det', 'exclam', 'num']
DOMAIN_NOISE = re.compile(r'\[(计|化|医|经|机|电|网络|物|数|生|法|军|农|冶|纺|体)\]')


def parse_senses(tr):
    """ECDICT translation -> [(pos, [sense, ...]), ...] in source order."""
    if not tr:
        return []
    tr = tr.replace('\\n', '\n').replace('\r', '')
    out = []
    for line in tr.split('\n'):
        line = line.strip()
        if not line or line.startswith('['):
            continue
        if DOMAIN_NOISE.search(line):
            line = DOMAIN_NOISE.sub('', line).strip()
            if not line:
                continue
        m = re.match(r'^([a-z]{1,6})\.\s*(.+)$', line)
        pos, body = ('', line)
        if m:
            pos = m.group(1)
            body = m.group(2)
        senses = []
        for p in re.split(r'[；;，,]', body):
            p = p.strip().strip('。.')
            if not p:
                continue
            p = re.sub(r'\(.*?\)|（.*?）', '', p).strip()
            if p and len(p) <= 16:
                senses.append(p)
        if senses:
            out.append((pos, senses))
    return out


# 明显不适合 B1 学习者的义项（工具书里的生僻/专业义）
BAD_SENSE = {
    '打桩锤', '坏蛋', '鱼群', '门派', '粗粉', '打赌', '保释金', '种马',
    '总线', '累加器', '加法器', '遗传', '组氨酸', '迈尔', '信息论',
    '输入端', '作废字符', '地址转换器', '异常传输', '自动订票',
    '胡德', '引擎盖', '腓肠', '袍', '雉', '山鹑', '獾',
}

def _int_safe(v):
    try:
        return int(v or 0)
    except (TypeError, ValueError):
        return 0


POS_EQ = {'n': {'n'}, 'v': {'v', 'vt', 'vi', 'aux'}, 'adj': {'a', 'adj'},
          'adv': {'adv', 'ad'}, 'prep': {'prep'}, 'conj': {'conj'},
          'pron': {'pron'}, 'det': {'art', 'det'}, 'exclam': {'int'}}


def pick_gloss(tr, official_pos, limit=3):
    """Choose the senses that match the official part of speech."""
    groups = parse_senses(tr)
    if not groups:
        return '', []
    want = []
    for p in official_pos.split(','):
        p = p.strip()
        want += list(POS_EQ.get(p, set()))
    matched, rest = [], []
    for pos, senses in groups:
        (matched if pos in want else rest).append((pos, senses))
    ordered = matched + rest
    gloss, flat = [], []
    for pos, senses in ordered:
        for s in senses:
            if s in flat or s in BAD_SENSE:
                continue
            flat.append(s)
            if len(gloss) < limit:
                gloss.append(s)
        if len(gloss) >= limit:
            break
    return '；'.join(gloss), flat


def cefr_tag(row):
    """按真实语料词频分三档 —— 备考价值 = 你多大概率在考卷上遇到它。

    旧逻辑把「中考/高考大纲词 或 Oxford3000 或 Collins>=3」都算 core，
    结果 83% 的词都是 core，等于没有分档，无法回答「先背哪些」。

    新逻辑以 ECDICT 的 frq（COCA 语料词频，数字越小越常见）为主轴：
      b1  = frq <= 1000        卷面高频，必须脱口而出（约 800 词）
      b2  = 1000 < frq <= 5000 中频，阅读与写作的主力（约 1370 词）
      b3  = 其余                低频，认识即可（约 940 词）
    没进语料表的词一律归 b3（生僻词居多）。
    「大纲词」只作为同档内的小幅加权，不再单独决定档位。
    """
    def _int(v):
        try:
            return int(v or 0)
        except ValueError:
            return 0

    frq = _int(row.get('frq'))
    bnc = _int(row.get('bnc'))
    # 两个语料库取更可信的那个（数值更小的通常更常用）
    score = min([x for x in (frq, bnc) if x] or [0])

    tags = (row.get('tag') or '').strip().split()
    is_syllabus = bool({'zk', 'gk', 'cet4', 'cet6'} & set(tags)) or \
        row.get('oxford') in ('1', '1.0')

    if not score:
        # 无词频数据：大纲词降一档看待，其余归最低档
        return 'b2' if is_syllabus else 'b3'
    if score <= 1000:
        return 'b1'
    if score <= 5000:
        return 'b2'
    # 5000 以上：大纲内的高频长尾词仍算中频，避免把常用词误判为低频
    if is_syllabus and score <= 20000:
        return 'b2'
    return 'b3'


out = []
for e in entries:
    w = e['w']
    key = w.lower()
    row = dict_rows.get(key)
    tr = (row or {}).get('translation') or ''
    phonetic = ((row or {}).get('phonetic') or '').strip()
    tag = cefr_tag(row) if row else 'ext'

    if key in OVERRIDE:
        zh = OVERRIDE[key]
    elif tr:
        zh, _ = pick_gloss(tr, e['pos'], 2)
    else:
        zh = ''

    if not zh:
        for cand in [a.lower() for a in e['alias']]:
            if cand in OVERRIDE:
                zh = OVERRIDE[cand]
                break
            r2 = dict_rows.get(cand)
            if r2 and r2.get('translation'):
                zh, _ = pick_gloss(r2['translation'], e['pos'], 2)
                if zh:
                    break

    if not zh and e['type'] == 'phrase':
        parts = []
        for t in re.findall(r"[A-Za-z][A-Za-z'\-]*", w):
            tk = t.lower()
            if tk in OVERRIDE:
                parts.append(OVERRIDE[tk].split('；')[0])
                continue
            r3 = dict_rows.get(tk)
            if r3 and r3.get('translation'):
                g, _ = pick_gloss(r3['translation'], '', 1)
                if g:
                    parts.append(g.split('；')[0])
        if parts:
            zh = '（' + ' + '.join(parts[:3]) + '）'

    if w.lower() in DROP:
        continue
    # 通用清洗：丢掉结尾的 1–2 字生僻义项（如 埠 / 写真 / 煤屑）
    if zh and '；' in zh:
        parts = [p2.strip() for p2 in zh.split('；') if p2.strip()]
        KEEP2 = {'也', '很', '更', '再', '才', '就', '都', '能', '会', '要', '做', '去', '来'}
        if len(parts) > 1 and len(parts[-1]) <= 2 and parts[-1] not in KEEP2:
            parts = parts[:-1]
        zh = '；'.join(parts) if parts else zh

    out.append({
        'w': w, 'pos': e['pos'], 'posZh': e['posZh'], 'type': e['type'],
        'zh': zh, 'tag': tag, 'ph': phonetic, 'alias': e['alias'],
        'ex': e['ex'][:2], 'topics': [],
        'frq': (dict_rows.get(key) and _int_safe(dict_rows[key].get('frq'))) or 0,
    })
    if out[-1]['tag'] not in ('b1', 'b2', 'b3'):
        out[-1]['tag'] = 'b3'

byname = {o['w'].lower(): o for o in out}
for t in topics:
    for w in t['words']:
        o = byname.get(w.lower())
        if o:
            o['topics'].append(t['id'])

miss = [o for o in out if not o['zh']]
print('无释义', len(miss), [o['w'] for o in miss][:20])

json.dump(out, open(os.path.join(HERE, 'pet_words.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=0)
json.dump(topics, open(os.path.join(HERE, 'pet_topics.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)

b1 = sum(1 for o in out if o['tag'] == 'b1')
b2 = sum(1 for o in out if o['tag'] == 'b2')
b3 = sum(1 for o in out if o['tag'] == 'b3')
other = len(out) - b1 - b2 - b3
print(f"高频 b1 {b1} | 中频 b2 {b2} | 低频 b3 {b3}" + (f" | 未分档 {other}" if other else "") + f" | 总计 {len(out)}")
