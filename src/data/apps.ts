import type { AppLink } from './cases';

/** Anat's related apps: where to take a case next. */
export const APPS: Record<AppLink, { name: string; url: string; why: string }> = {
  n360: { name: 'שכונה 360', url: 'https://pro-metrics-vue.lovable.app/', why: 'למדוד את המקום שלך לפני שמעתיקים פתרון' },
  renewal: { name: 'פינוי בינוי', url: 'https://renew-path-finder.lovable.app/', why: 'לבדוק את מסלול ההתחדשות שבו הפתרון ייכנס' },
  biomimicry: { name: 'ביומימטיקה', url: 'https://id-preview--3acc0904-1516-4dfa-a269-ee4044eeb558.lovable.app/', why: 'איך הטבע פותר בעיה דומה של מים, חום או צל' },
  interior: { name: 'סגנונות עיצוב פנים', url: 'https://ai-design-buddy-68.lovable.app/login', why: 'שפת חומר וצבע ברמת הפרט' },
};

export const DEV_SESSION_URL = 'https://claude.ai/code/session_01WvHPNm88Hckg4a2XooHsSb';
