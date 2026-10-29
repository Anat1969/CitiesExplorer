import { AT, AU, BE, BR, CN, CO, DE, DK, ES, FR, GB, IL, KR, NL, NO, SE, SG, SI, US, AL } from 'country-flag-icons/react/3x2';

const FLAGS: Record<string, typeof IL> = {
  Albania: AL,
  Australia: AU,
  Austria: AT,
  Belgium: BE,
  Brazil: BR,
  China: CN,
  Colombia: CO,
  Denmark: DK,
  France: FR,
  Germany: DE,
  Israel: IL,
  Netherlands: NL,
  Norway: NO,
  Singapore: SG,
  Slovenia: SI,
  'South Korea': KR,
  Spain: ES,
  Sweden: SE,
  'United Kingdom': GB,
  'United States': US,
};

/** The country's flag, drawn as SVG (emoji flags show as letters on Windows). */
export default function Flag({ country, label }: { country: string; label?: string }) {
  const F = FLAGS[country];
  if (!F) return null;
  // The name goes on the wrapper, so the flag never adds words to the text around it.
  return (
    <span className="flag" title={label ?? country} role="img" aria-label={label ?? country}>
      <F aria-hidden />
    </span>
  );
}
