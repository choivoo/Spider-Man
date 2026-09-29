import type { CharacterResponse, ChatRequest } from './schema'

/**
 * Tiny rule-based brain used when no ANTHROPIC_API_KEY is configured ("demo mode") so the
 * character, transformations and UI are fully explorable without a backend key.
 * It is intentionally simple and always flagged as `source: "offline"` in the UI.
 */

const has = (t: string, ...words: string[]) => words.some((w) => t.includes(w))
const pickOne = <T,>(arr: T[], seed: number) => arr[Math.abs(seed) % arr.length]

function hash(s: string) {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

const base = (o: Partial<CharacterResponse>): CharacterResponse => ({
  dialogue: '…', emotion: 'neutral', emotionIntensity: 0.4, gesture: 'none', face: 'neutral',
  eyeExpression: 'normal', lookAtUser: true, animation: 'talk_01', suitAction: 'none', armAction: 'none',
  memoryCandidate: null, ...o,
})

export function offlineReply(req: ChatRequest): CharacterResponse {
  const last = [...req.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  const t = last.toLowerCase()
  const ko = /[가-힣]/.test(last) || (req.locale ?? '').startsWith('ko')
  const seed = hash(last) + req.messages.length
  const spider = req.form === 'spider'
  const L = (koText: string[], enText: string[]) => pickOne(ko ? koText : enText, seed)

  if (has(t, '슈트 벗', '변신 해제', 'suit down', 'suit off', 'change back', '원래대로'))
    return base({
      dialogue: spider ? L(['알겠어, 벗을게. 이거 은근히 땀 차거든.', '좋아, 잠깐만. 나노 입자 회수 중.'], ['Okay, suiting down. It gets warm in here, honestly.', 'Sure. Recalling the nanites.']) : L(['이미 평상복인데? 아, 농담이지?', '지금 이미 벗은 상태야.'], ["I'm already in normal clothes. Wait, was that a joke?"]),
      emotion: 'happy', emotionIntensity: 0.5, face: 'smile', gesture: 'nod', suitAction: spider ? 'suit_down' : 'none', animation: 'suit_down_01',
    })
  if (has(t, '슈트', '변신', 'suit up', 'transform', 'spider-man', 'spiderman', '스파이더맨'))
    return base({
      dialogue: spider ? L(['이미 입고 있는데? 거울 볼래?', '지금 입고 있어. 멋있지?'], ["I'm already wearing it. Cool, right?"]) : L(['좋아, 잠깐 뒤로 물러서 봐. 처음엔 좀 간지러워.', '오케이. 나노 코어 점화한다.'], ["Okay, stand back a little. It tickles at first.", 'Alright. Igniting the nano core.']),
      emotion: 'excited', emotionIntensity: 0.65, face: 'smile', suitAction: spider ? 'none' : 'suit_up', animation: 'suit_up_01',
    })
  if (has(t, '마스크', 'mask'))
    return base({
      dialogue: spider ? L(['마스크? 알았어. 얼굴 보여줄게.', '잠깐, 마스크 조정할게.'], ['The mask? Sure, one sec.']) : L(['마스크는 슈트를 입어야 쓰지!'], ['I need the suit first for the mask.']),
      emotion: 'neutral', suitAction: spider ? (req.maskOpen ? 'mask_close' : 'mask_open') : 'none',
    })
  if (has(t, '팔', '거미 팔', 'arms', 'legs', '다리'))
    return base({
      dialogue: spider ? L(['짜잔. 이거 네 개나 있는데 아직도 적응이 안 돼.', '전개! 어, 조심해, 좀 넓어.'], ['Ta-da. Four arms and I still bump into things.']) : L(['슈트 없이는 못 꺼내지. 팔이 두 개뿐이야.'], ['Not without the suit. I only have two arms right now.']),
      emotion: 'excited', emotionIntensity: 0.6, armAction: spider ? (req.armsDeployed ? 'retract' : 'deploy') : 'none',
    })
  if (has(t, '거미줄', 'web', '웹슈터'))
    return base({ dialogue: spider ? L(['자, 받아라!'], ['Thwip!']) : L(['웹슈터는 슈트 입을 때만 나와.'], ['Web shooters only come with the suit.']), emotion: 'confident', suitAction: spider ? 'web_shoot' : 'none' })
  if (has(t, '스파이더 센스', 'spider sense', 'spider-sense'))
    return base({ dialogue: L(['어, 방금 뒷목이 찌릿했어. 진짜야.'], ['Whoa — tingle. Something is off.']), emotion: 'surprised', emotionIntensity: 0.7, face: 'surprised', suitAction: 'spider_sense' })
  if (has(t, '안녕', 'hello', 'hi ', 'hey', '하이') || t === 'hi')
    return base({ dialogue: L(['어, 안녕! 왔구나. 반가워.', '안녕! 마침 심심했는데.'], ['Oh — hey! Good timing.', 'Hi! I was just tinkering with something.']), emotion: 'happy', emotionIntensity: 0.6, face: 'smile', gesture: 'wave', animation: 'greet_01' })
  if (has(t, '이름', 'your name', 'who are you', '누구'))
    return base({ dialogue: L(['나는 피터야. 뭐, 적어도 지금은.', '피터. 피터 파커 스타일의 그냥 평범한… 아마 평범한 친구.'], ["I'm Peter. Or, you know, Peter-ish."]), emotion: 'embarrassed', emotionIntensity: 0.4, face: 'embarrassed', gesture: 'scratch_head' })
  if (has(t, '고마', 'thanks', 'thank you'))
    return base({ dialogue: L(['별거 아냐. 나도 재밌었어.', '에이, 그 정도야 뭐.'], ["Anytime. Really, it was fun."]), emotion: 'happy', face: 'smile', gesture: 'nod' })
  if (has(t, '?', '뭐', '왜', '어떻게', 'how', 'why', 'what'))
    return base({ dialogue: L(['음… 좋은 질문인데. 지금은 데모 모드라서 깊게 생각은 못 해. API 키를 연결하면 진짜로 대답해 줄게.', '잠깐, 생각 좀. 아, 지금 오프라인 데모 두뇌야. 키가 연결되면 훨씬 똑똑해져.'], ["Good question. I'm on my offline demo brain right now — connect an API key and I'll actually think it through."]), emotion: 'thinking', emotionIntensity: 0.55, face: 'curious', gesture: 'think_chin', lookAtUser: false })
  return base({
    dialogue: L(['음, 그렇구나. 더 얘기해 줘.', '오, 흥미로운데? 그다음은?', '어… 잠깐, 다시 말해 줄래?'], ['Huh, okay. Tell me more.', 'Interesting. And then?', 'Wait, say that again?']),
    emotion: 'curious', emotionIntensity: 0.45, face: 'curious', gesture: seed % 3 === 0 ? 'nod' : 'none',
  })
}
