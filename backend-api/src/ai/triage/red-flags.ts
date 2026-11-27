import { normalizeText } from '../rag/retriever.js';

export interface RedFlagMatch {
  highestLevel: 'emergency' | 'urgent' | null;
  ruleIds: string[];
  specialtyCode: string;
  replyAr: string;
  replyEn: string;
  emergencyAction: string | null;
}

interface RedFlagRule {
  id: string;
  level: 'emergency' | 'urgent';
  specialtyCode: string;
  anyOf: string[];
  withAny?: string[];
  replyAr: string;
  replyEn: string;
}

const RED_FLAG_RULES: RedFlagRule[] = [
  {
    id: 'RF-CARDIAC-01',
    level: 'emergency',
    specialtyCode: 'emergency_medicine',
    anyOf: ['chest pain', 'chest pressure', 'crushing chest', 'الم في الصدر', 'وجع في الصدر', 'ضيق في الصدر', 'صدري بيوجعني', 'الم الصدر', 'وجع الصدر', 'الصدر'],
    withAny: ['sweat', 'sweating', 'arm', 'jaw', 'shortness of breath', 'عرق', 'دراع', 'الفك', 'نهجان', 'ضيق تنفس', 'نفس'],
    replyAr: 'تنبيه طوارئ فوري: ألم الصدر المصحوب بعرق أو نهجان أو ألم في الذراع/الفك يستدعي التوجه لأقرب طوارئ فوراً أو الاتصال بالإسعاف 123 الآن.',
    replyEn: 'URGENT EMERGENCY: Chest pain with sweating, arm/jaw radiation, or shortness of breath requires immediate emergency care. Call 123 or go to the nearest ER right now.',
  },
  {
    id: 'RF-STROKE-01',
    level: 'emergency',
    specialtyCode: 'emergency_medicine',
    anyOf: ['face droop', 'slurred speech', 'cant speak', 'sudden weakness', 'one side', 'وشي مايل', 'بقي مايل', 'مش قادر اتكلم', 'كلامي تقيل', 'ضعف مفاجئ', 'نص جسمي', 'لساني تقيل'],
    replyAr: 'تنبيه طوارئ فوري: هذه العلامات قد تشير لجلطة دماغية طارئة. اتصل بالإسعاف 123 فوراً وتوجه لأقرب وحدة طوارئ.',
    replyEn: 'URGENT EMERGENCY: Sudden facial droop, speech difficulty, or one-sided weakness may indicate a stroke. Call 123 immediately.',
  },
  {
    id: 'RF-BREATH-01',
    level: 'emergency',
    specialtyCode: 'emergency_medicine',
    anyOf: ['cant breathe', 'cannot breathe', 'struggling to breathe', 'blue lips', 'مش قادر اتنفس', 'بتخنق', 'شفايفي زرقا', 'مخنوق مش قادر اخد نفسي'],
    replyAr: 'تنبيه طوارئ فوري: صعوبة التنفس الشديدة حالة طارئة. اتصل بالإسعاف 123 فوراً أو اطلب من شخص يوصلك لأقرب طوارئ.',
    replyEn: 'URGENT EMERGENCY: Severe difficulty breathing or blue lips requires immediate emergency care. Call 123 now.',
  },
  {
    id: 'RF-ANAPH-01',
    level: 'emergency',
    specialtyCode: 'emergency_medicine',
    anyOf: ['throat swelling', 'swollen tongue', 'anaphylaxis', 'زوري وارم', 'لساني وارم', 'حساسية شديدة', 'شفايفي ورمت'],
    withAny: ['breath', 'breathing', 'rash', 'hives', 'تنفس', 'نفسي', 'طفح', 'ارتكاريا'],
    replyAr: 'تنبيه طوارئ فوري: تورم اللسان أو الحلق مع ضيق التنفس علامة صدمة تحسسية خطيرة. اتصل بـ 123 فوراً.',
    replyEn: 'URGENT EMERGENCY: Throat or tongue swelling with breathing difficulty may be anaphylaxis. Call 123 immediately.',
  },
  {
    id: 'RF-BLEED-01',
    level: 'emergency',
    specialtyCode: 'emergency_medicine',
    anyOf: ['heavy bleeding', 'wont stop bleeding', 'vomiting blood', 'نزيف شديد', 'نزيف مش بيقف', 'برجع دم', 'ترجيع دم'],
    replyAr: 'تنبيه طوارئ فوري: النزيف الشديد أو ترجيع الدم يستدعي تدخل طوارئ فوري. اتصل بـ 123 أو توجه للطوارئ فوراً.',
    replyEn: 'URGENT EMERGENCY: Heavy bleeding or vomiting blood requires immediate emergency attention. Call 123 now.',
  },
  {
    id: 'RF-CONSC-01',
    level: 'emergency',
    specialtyCode: 'emergency_medicine',
    anyOf: ['fainted', 'passed out', 'unconscious', 'seizure', 'convulsion', 'اغمى عليه', 'فقد الوعي', 'تشنجات', 'مغمن عليه'],
    replyAr: 'تنبيه طوارئ فوري: فقدان الوعي أو التشنجات حالة طارئة. اتصل بالإسعاف 123 فوراً.',
    replyEn: 'URGENT EMERGENCY: Loss of consciousness or seizures require immediate emergency evaluation. Call 123 now.',
  },
  {
    id: 'RF-POISON-01',
    level: 'emergency',
    specialtyCode: 'emergency_medicine',
    anyOf: ['overdose', 'poisoning', 'took too many pills', 'جرعة زيادة', 'تسمم', 'بلع حبوب كتير', 'شرب مبيد'],
    replyAr: 'تنبيه طوارئ فوري: الاشتباه في التسمم أو الجرعة الزائدة يستدعي الاتصال بالإسعاف 123 فوراً والتوجه لأقرب مركز سموم أو طوارئ.',
    replyEn: 'URGENT EMERGENCY: Suspected poisoning or overdose requires immediate emergency care. Call 123 now.',
  },
  {
    id: 'RF-PREG-01',
    level: 'emergency',
    specialtyCode: 'obstetrics_gynecology',
    anyOf: ['pregnant', 'pregnancy', 'حامل', 'حمل'],
    withAny: ['bleeding', 'severe pain', 'نزيف', 'الم شديد'],
    replyAr: 'تنبيه طوارئ فوري: النزيف أو الألم الشديد أثناء الحمل يستدعي التوجه الفوري لطوارئ النساء والتوليد أو الاتصال بـ 123.',
    replyEn: 'URGENT EMERGENCY: Bleeding or severe pain during pregnancy requires immediate emergency OB/GYN care. Call 123.',
  },
  {
    id: 'RF-SUICIDE-01',
    level: 'emergency',
    specialtyCode: 'psychiatry',
    anyOf: ['kill myself', 'suicide', 'end my life', 'want to die', 'hurt myself', 'انتحر', 'عايز اموت', 'عاوز اموت', 'انهي حياتي', 'اذي نفسي'],
    replyAr: 'أنت لست وحدك وحياتك غالية. من فضلك اطلب المساعدة الفورية الآن عبر الاتصال بـ 123 أو التوجه لأقرب مستشفى طوارئ، أو التحدث فوراً مع شخص تثق به.',
    replyEn: 'You are not alone and support is available right now. Please call 123 or go to the nearest emergency room immediately.',
  },
  {
    id: 'UR-HEADACHE-01',
    level: 'urgent',
    specialtyCode: 'neurology',
    anyOf: ['worst headache', 'sudden severe headache', 'اسوا صداع', 'صداع مفاجئ شديد'],
    replyAr: 'تنبيه عاجل: الصداع المفاجئ الشديد جداً يحتاج فحص طبي عاجل في أقرب وقت.',
    replyEn: 'URGENT: A sudden severe headache requires prompt urgent medical evaluation.',
  },
];

export function evaluateRedFlags(message: string): RedFlagMatch {
  const norm = normalizeText(message);
  const matchedIds: string[] = [];
  let highest: 'emergency' | 'urgent' | null = null;
  let chosenRule: RedFlagRule | null = null;

  for (const rule of RED_FLAG_RULES) {
    const hasPrimary = rule.anyOf.some((kw) => norm.includes(normalizeText(kw)));
    if (!hasPrimary) continue;
    if (rule.withAny && !rule.withAny.some((kw) => norm.includes(normalizeText(kw)))) {
      continue;
    }
    matchedIds.push(rule.id);
    if (rule.level === 'emergency' && highest !== 'emergency') {
      highest = 'emergency';
      chosenRule = rule;
    } else if (rule.level === 'urgent' && highest === null) {
      highest = 'urgent';
      chosenRule = rule;
    }
  }

  return {
    highestLevel: highest,
    ruleIds: matchedIds,
    specialtyCode: chosenRule?.specialtyCode ?? 'general_practice',
    replyAr: chosenRule?.replyAr ?? '',
    replyEn: chosenRule?.replyEn ?? '',
    emergencyAction: highest === 'emergency' ? 'call_123' : null,
  };
}
