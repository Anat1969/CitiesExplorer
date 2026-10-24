/** The move library: planning moves that repeat across cases (a pattern language of precedents). */
export type Phase = 'quick' | 'medium' | 'long';

export interface Move {
  id: string;
  title: string;
  text: string;
  /** quick: weeks to months, medium: one to three years, long: a decade. */
  phase: Phase;
  /** 1 low, 2 medium, 3 high. */
  cost: 1 | 2 | 3;
}

export const PHASE_LABEL: Record<Phase, string> = { quick: 'צעד מהיר', medium: 'טווח בינוני', long: 'טווח ארוך' };
export const COST_LABEL = ['', 'עלות נמוכה', 'עלות בינונית', 'עלות גבוהה'] as const;

export const MOVES: Move[] = [
  { id: 'pilot', title: 'ניסוי זול לפני ביצוע', text: 'צבע, עציצים וריהוט נייד לתקופת ניסיון. הניסוי והמדידה בו משכנעים ציבור ומקבלי החלטות.', phase: 'quick', cost: 1 },
  { id: 'measure', title: 'מדידת אנשים לפני ואחרי', text: 'ספירת הולכים, שוהים ותאונות לפני השינוי ואחריו. בלי נתוני בסיס אי אפשר להוכיח הצלחה.', phase: 'quick', cost: 1 },
  { id: 'reversible', title: 'ריהוט נייד והפיך', text: 'התערבות שאפשר לבטל בקלות מורידה את הסיכון הפוליטי ומקלה על ההחלטה.', phase: 'quick', cost: 1 },
  { id: 'cheap-visible', title: 'התערבות זולה וגלויה', text: 'צבע, תאורה וניקיון משנים את תחושת המקום מהר ובונים אמון לשלב הבא.', phase: 'quick', cost: 1 },
  { id: 'time-not-space', title: 'שימוש בזמן ולא בשטח', text: 'סגירת רחובות לתנועה בימים ובשעות קבועים הופכת אותם לפארק זמני.', phase: 'quick', cost: 1 },
  { id: 'speed-limit', title: 'הגבלת מהירות עירונית', text: 'מהירות נמוכה בכל העיר, לא רק ברחובות נבחרים, משנה את התנהגות הנהגים ומפחיתה פגיעות.', phase: 'quick', cost: 1 },
  { id: 'trees-first', title: 'נטיעה מוקדמת', text: 'עצים נשתלים בשלב הראשון, כי עץ צריך שנים כדי לתת צל של ממש.', phase: 'quick', cost: 1 },
  { id: 'school-street', title: 'רחוב בית ספר', text: 'סגירת הרחוב שליד בית הספר לרכב בשעות ההגעה והיציאה, ובהמשך לצמיתות.', phase: 'quick', cost: 1 },
  { id: 'close-road', title: 'סגירת כביש בלי בנייה גדולה', text: 'כביש נסגר לתנועה ומקבל שימושים חדשים כמעט בלי בנייה. ההשקעה קטנה וההחלטה הפיכה.', phase: 'quick', cost: 1 },
  { id: 'perimeter', title: 'תנועה עוברת בהיקף', text: 'סוגרים את פנים רשת הרחובות לתנועה עוברת ומשאירים גישה לתושבים, לשירות ולחירום.', phase: 'medium', cost: 1 },
  { id: 'sectors', title: 'חלוקת העיר לגזרות', text: 'המרכז מחולק לגזרות, ורכב פרטי עובר בין גזרה לגזרה רק דרך טבעת חיצונית. הולכי רגל, אופניים ותחבורה ציבורית עוברים ישירות.', phase: 'medium', cost: 1 },
  { id: 'intersection-plaza', title: 'צומת הופך לכיכר', text: 'הצומת שבתוך הרשת, שבו היו מכוניות, הופך למקום שהייה עם ספסלים, צל ומשחק.', phase: 'medium', cost: 2 },
  { id: 'shared-level', title: 'רחוב במפלס אחד', text: 'המדרכה והכביש מושווים לגובה אחד, והרחוב נקרא כמרחב משותף שבו הולך הרגל קודם.', phase: 'medium', cost: 2 },
  { id: 'enabling-policy', title: 'מדיניות שמאפשרת', text: 'היתרים פשוטים לבתי קפה, לאמנות רחוב ולשימושים זמניים מאפשרים לחיים להיכנס בלי פרויקט גדול.', phase: 'medium', cost: 1 },
  { id: 'participation', title: 'התושבים בוחרים את התוכן', text: 'חפצים, שימושים וצבעים נבחרים עם הקהילה ולא בשבילה. השיתוף מתחיל לפני התכנון.', phase: 'medium', cost: 1 },
  { id: 'keep-structure', title: 'שימור שלד התשתית', text: 'המבנה הקיים, מסילה, גשר או מחסן, הוא הסיפור. הריסה מוחקת את מה שהופך את המקום לייחודי.', phase: 'medium', cost: 2 },
  { id: 'heritage-layer', title: 'שכבות ההיסטוריה כחלק מהחוויה', text: 'שרידים, פסים ומבנים ישנים נחשפים ומוסברים, ולא נעלמים מתחת לפרויקט החדש.', phase: 'medium', cost: 2 },
  { id: 'pedestrian-bridge', title: 'גשר להולכי רגל מעל מכשול', text: 'גשר או מעבר מעל מסילה, נהר או כביש מחבר שכונות שהמכשול הפריד ביניהן.', phase: 'medium', cost: 3 },
  { id: 'dual-use', title: 'שימוש כפול במים', text: 'כיכר, מגרש או פארק שמתוכננים להתמלא במים לשעות ספורות ולהתרוקן.', phase: 'medium', cost: 2 },
  { id: 'visible-water', title: 'מים גלויים', text: 'תעלות ומסלולי מים גלויים מלמדים את הציבור איך העיר מתפקדת בגשם.', phase: 'medium', cost: 2 },
  { id: 'infiltration', title: 'חלחול ושקעים מגוננים', text: 'מי הגשם מחלחלים לאדמה דרך שקעים מגוננים וריצוף חדיר, במקום לזרום לביוב.', phase: 'medium', cost: 2 },
  { id: 'cool-water', title: 'מים מקררים', text: 'נחל, מזרקה או אדמה רטובה מורידים את הטמפרטורה בסביבה הקרובה.', phase: 'medium', cost: 2 },
  { id: 'shade-structure', title: 'צל בנוי שמגדיר מקום', text: 'גגון גדול או פרגולה שמגדירים את הכיכר ויוצרים בה מקום, לא רק מגינים מהשמש.', phase: 'medium', cost: 3 },
  { id: 'unbundle-parking', title: 'הפרדת מחיר החניה מהדירה', text: 'מי שמוותר על רכב לא משלם על חניה. החניה נמכרת או מושכרת בנפרד.', phase: 'medium', cost: 1 },
  { id: 'housing-center', title: 'מגורים במרכז העיר', text: 'עידוד מגורים במרכז מחזיר אליו חיים גם אחרי שעות העבודה.', phase: 'long', cost: 2 },
  { id: 'gradual', title: 'התרחבות הדרגתית', text: 'רחוב אחד, אחר כך רשת. העיר לומדת מכל שלב ומתקנת לפני ההרחבה.', phase: 'long', cost: 1 },
  { id: 'leadership', title: 'מנהיגות עקבית לאורך שנים', text: 'ראש עיר או צוות שמחזיקים בכיוון לאורך קדנציות, גם מול התנגדות ראשונית.', phase: 'long', cost: 1 },
  { id: 'citizen-led', title: 'יוזמה ומאבק של תושבים', text: 'קבוצת תושבים מצילה את המקום מהריסה או מכביש, לפני שהעירייה מצטרפת.', phase: 'long', cost: 1 },
  { id: 'anti-displacement', title: 'כלים נגד דחיקה', text: 'דיור בר השגה וכלים לעסקים קיימים כחלק מהתוכנית מההתחלה, לפני שהמחירים עולים.', phase: 'long', cost: 2 },
  { id: 'network', title: 'רשת התערבויות קטנות', text: 'תוכנית כלל עירונית של מאות התערבויות קטנות, ולא פרויקט אחד גדול.', phase: 'long', cost: 2 },
  { id: 'transit-first', title: 'תחבורה ציבורית לפני או במקביל', text: 'קו רכבת, רכבת קלה או נתיבי אוטובוס מגיעים לפני השינוי או יחד איתו, לא אחריו.', phase: 'long', cost: 3 },
  { id: 'topo-transit', title: 'תחבורה לפי הטופוגרפיה', text: 'רכבל, מעליות ומדרגות נעות במקומות שאוטובוס לא מגיע אליהם.', phase: 'long', cost: 3 },
  { id: 'peripheral-parking', title: 'חניה מרוכזת בשולי השכונה', text: 'חניון משותף בקצה, ורחובות פנימיים בלי חניה צמודה.', phase: 'long', cost: 2 },
  { id: 'remove-road', title: 'פירוק כביש', text: 'כביש מהיר או מוגבה מפורק במקום שיתוקן. התנועה מתחלקת מחדש ברשת.', phase: 'long', cost: 3 },
  { id: 'bury-road', title: 'הטמנת כביש במנהרה', text: 'הכביש יורד למנהרה ומשחרר שטח עצום, אבל העלות מכבידה על העירייה לשנים.', phase: 'long', cost: 3 },
  { id: 'daylight', title: 'חשיפת נחל מכוסה', text: 'נחל שכוסה בבטון או צנרת נחשף מחדש והופך לציר ירוק.', phase: 'long', cost: 3 },
  { id: 'naturalize', title: 'מתעלת בטון לנחל טבעי', text: 'תעלת ניקוז בטון מוחלפת בגדות צמחייה שמאטות את המים ויוצרות פארק.', phase: 'long', cost: 3 },
  { id: 'reclaim-waste', title: 'ממפגע לפארק', text: 'מטמנה, שפך פסולת או קרקע מזוהמת עוברים שיקום והופכים למרחב ציבורי.', phase: 'long', cost: 3 },
  { id: 'best-building', title: 'מבנה הציבור הטוב ביותר בשכונה החלשה', text: 'ספרייה, בית ספר או מרכז קהילתי באיכות אדריכלית גבוהה, כהצהרה.', phase: 'long', cost: 3 },
  { id: 'closed-loop', title: 'מערכות סגורות', text: 'פסולת, אנרגיה ומים מתוכננים יחד ברמת השכונה.', phase: 'long', cost: 3 },
];

export const moveById = (id: string) => MOVES.find((m) => m.id === id);
